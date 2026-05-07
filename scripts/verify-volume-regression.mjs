import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const sourcePath = new URL("../src/lib/base-wallet-score.ts", import.meta.url);
const source = readFileSync(sourcePath, "utf8");
const { code } = transformSync(source, {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;

const address = "0x1111111111111111111111111111111111111111";
const oldWindowWei = 1_500_000_000_000_000_000n;
const olderWei = 6_000_000_000_000_000_000n;
const txCount = 450;

function legacyTx(value, timestampSeconds) {
  return {
    timeStamp: String(timestampSeconds),
    value: String(value),
    isError: "0",
    txreceipt_status: "1",
    input: "0x",
    to: "0x2222222222222222222222222222222222222222",
  };
}

const newest400 = Array.from({ length: 400 }, (_, i) =>
  legacyTx(i === 0 ? oldWindowWei : 0n, 1_700_000_000 - i * 60),
);
const full450 = [...newest400, ...Array.from({ length: 50 }, (_, i) =>
  legacyTx(i === 0 ? olderWei : 0n, 1_699_000_000 - i * 60),
)];

const requestedOffsets = [];
globalThis.fetch = async (url) => {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith("/counters")) {
    return Response.json({ transactions_count: String(txCount), token_transfers_count: "0" });
  }
  if (parsed.hostname === "api.warpcast.com") {
    throw new Error("social unavailable in regression test");
  }
  if (parsed.pathname === "/api" && parsed.searchParams.get("action") === "txlist") {
    const offset = Number(parsed.searchParams.get("offset") || 0);
    requestedOffsets.push(offset);
    return Response.json({ status: "1", message: "OK", result: offset > 400 ? full450 : newest400 });
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

const { calculateBaseWalletScore } = await import(moduleUrl);
const result = await calculateBaseWalletScore(address);

if (!requestedOffsets.includes(400)) throw new Error(`Missing scoring window fetch: ${requestedOffsets.join(",")}`);
if (!requestedOffsets.some((n) => n > 400)) throw new Error(`Missing deep volume fetch: ${requestedOffsets.join(",")}`);
if (result.totalVolumeEth !== 7.5) throw new Error(`Expected 7.5 ETH total volume, got ${result.totalVolumeEth}`);
if (result.sampleSize !== 400) throw new Error(`Expected scoring sample to stay 400, got ${result.sampleSize}`);

console.log(JSON.stringify({ totalVolumeEth: result.totalVolumeEth, sampleSize: result.sampleSize, requestedOffsets }, null, 2));

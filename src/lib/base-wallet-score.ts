export interface BaseWalletScoreBreakdown {
  walletAgeScore: number;
  txCountScore: number;
  activityScore: number;
  volumeScore: number;
  marketScore: number;
  totalScore: number;
}

export interface BaseWalletScoreResult {
  address: string;
  chain: "base";
  txCount: number;
  walletAgeDays: number;
  activeDays30: number;
  totalVolumeEth: number;
  dexVolume24hUsd: number;
  breakdown: BaseWalletScoreBreakdown;
  tier: "Dormant" | "Active" | "Power" | "Whale";
}

type BaseScanTx = {
  timeStamp: string;
  value: string;
};

type BaseScanResponse<T> = {
  status: string;
  message: string;
  result: T;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function tierFromScore(score: number): BaseWalletScoreResult["tier"] {
  if (score >= 850) return "Whale";
  if (score >= 650) return "Power";
  if (score >= 350) return "Active";
  return "Dormant";
}

async function fetchBaseScanTxs(address: string, apiKey: string): Promise<BaseScanTx[]> {
  const url = new URL("https://api.basescan.org/api");
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", address);
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "99999999");
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "10000");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`BaseScan HTTP ${res.status}`);
  const json = (await res.json()) as BaseScanResponse<BaseScanTx[] | string>;

  if (json.status === "0" && typeof json.result === "string" && json.result.includes("No transactions")) {
    return [];
  }

  if (!Array.isArray(json.result)) {
    throw new Error(`BaseScan error: ${json.message || "unknown"}`);
  }

  return json.result;
}

async function fetchDexVolume24hUsd(): Promise<number> {
  const res = await fetch("https://api.llama.fi/overview/dexs/base", { cache: "no-store" });
  if (!res.ok) return 0;
  const json = (await res.json()) as { total24h?: number; total48hto24h?: number };
  return Number(json.total24h ?? 0);
}

export async function calculateBaseWalletScore(address: string, apiKey: string): Promise<BaseWalletScoreResult> {
  const normalizedAddress = address.toLowerCase();
  const txs = await fetchBaseScanTxs(normalizedAddress, apiKey);
  const dexVolume24hUsd = await fetchDexVolume24hUsd();

  const txCount = txs.length;
  const firstTs = txCount > 0 ? Number(txs[0].timeStamp) * 1000 : Date.now();
  const now = Date.now();
  const walletAgeDays = Math.max(0, Math.floor((now - firstTs) / 86_400_000));

  const days = new Set<string>();
  const days30Cutoff = now - 30 * 86_400_000;
  let activeDays30 = 0;
  let totalWei = 0n;

  for (const tx of txs) {
    const tsMs = Number(tx.timeStamp) * 1000;
    const day = new Date(tsMs).toISOString().slice(0, 10);
    days.add(day);
    if (tsMs >= days30Cutoff) activeDays30 += 1;

    try {
      totalWei += BigInt(tx.value || "0");
    } catch {
      // ignore bad value
    }
  }

  const totalVolumeEth = Number(totalWei) / 1e18;

  // Score components (0..1000 total)
  const walletAgeScore = clamp(Math.round((walletAgeDays / 365) * 250), 0, 250);
  const txCountScore = clamp(Math.round((Math.log10(txCount + 1) / Math.log10(10000)) * 300), 0, 300);
  const activityScore = clamp(Math.round((Math.min(activeDays30, 30) / 30) * 250), 0, 250);
  const volumeScore = clamp(Math.round((Math.log10(totalVolumeEth + 1) / Math.log10(1000)) * 150), 0, 150);

  // market score from Base DEX activity
  const marketScore = clamp(Math.round((Math.log10(dexVolume24hUsd + 1) / Math.log10(5_000_000_000)) * 50), 0, 50);

  const totalScore = clamp(walletAgeScore + txCountScore + activityScore + volumeScore + marketScore, 0, 1000);

  return {
    address: normalizedAddress,
    chain: "base",
    txCount,
    walletAgeDays,
    activeDays30,
    totalVolumeEth: Number(totalVolumeEth.toFixed(4)),
    dexVolume24hUsd,
    breakdown: {
      walletAgeScore,
      txCountScore,
      activityScore,
      volumeScore,
      marketScore,
      totalScore,
    },
    tier: tierFromScore(totalScore),
  };
}

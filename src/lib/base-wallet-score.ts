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

type BlockscoutTx = {
  timestamp?: string;
  value?: string;
};

type BlockscoutResponse = {
  items?: BlockscoutTx[];
  next_page_params?: { block_number?: number; index?: number } | null;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function tierFromScore(score: number): BaseWalletScoreResult["tier"] {
  if (score >= 850) return "Whale";
  if (score >= 650) return "Power";
  if (score >= 350) return "Active";
  return "Dormant";
}

function parseIsoToMs(iso?: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

async function fetchBlockscoutTxs(address: string, maxPages = 3): Promise<BlockscoutTx[]> {
  const items: BlockscoutTx[] = [];
  let nextParams: BlockscoutResponse["next_page_params"] = null;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`https://base.blockscout.com/api/v2/addresses/${address}/transactions`);
    url.searchParams.set("items_count", "50");

    if (nextParams?.block_number !== undefined) {
      url.searchParams.set("block_number", String(nextParams.block_number));
    }
    if (nextParams?.index !== undefined) {
      url.searchParams.set("index", String(nextParams.index));
    }

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Blockscout HTTP ${res.status}`);
    const json = (await res.json()) as BlockscoutResponse;
    const pageItems = Array.isArray(json.items) ? json.items : [];

    items.push(...pageItems);
    nextParams = json.next_page_params ?? null;

    if (!nextParams || pageItems.length === 0) break;
  }

  return items;
}

async function fetchDexVolume24hUsd(): Promise<number> {
  const res = await fetch("https://api.llama.fi/overview/dexs/base", { cache: "no-store" });
  if (!res.ok) return 0;
  const json = (await res.json()) as { total24h?: number };
  return Number(json.total24h ?? 0);
}

export async function calculateBaseWalletScore(address: string): Promise<BaseWalletScoreResult> {
  const normalizedAddress = address.toLowerCase();
  const txs = await fetchBlockscoutTxs(normalizedAddress, 4);
  const dexVolume24hUsd = await fetchDexVolume24hUsd();

  const txCount = txs.length;
  const txTimes = txs.map((tx) => parseIsoToMs(tx.timestamp)).filter((n) => n > 0).sort((a, b) => a - b);

  const firstTs = txTimes.length > 0 ? txTimes[0] : Date.now();
  const now = Date.now();
  const walletAgeDays = Math.max(0, Math.floor((now - firstTs) / 86_400_000));

  const days30Cutoff = now - 30 * 86_400_000;
  let activeDays30 = 0;
  let totalWei = 0n;

  for (const tx of txs) {
    const tsMs = parseIsoToMs(tx.timestamp);
    if (tsMs >= days30Cutoff) activeDays30 += 1;

    try {
      totalWei += BigInt(tx.value || "0");
    } catch {
      // ignore malformed value
    }
  }

  const totalVolumeEth = Number(totalWei) / 1e18;

  const walletAgeScore = clamp(Math.round((walletAgeDays / 365) * 250), 0, 250);
  const txCountScore = clamp(Math.round((Math.log10(txCount + 1) / Math.log10(10000)) * 300), 0, 300);
  const activityScore = clamp(Math.round((Math.min(activeDays30, 30) / 30) * 250), 0, 250);
  const volumeScore = clamp(Math.round((Math.log10(totalVolumeEth + 1) / Math.log10(1000)) * 150), 0, 150);
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

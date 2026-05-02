export interface BaseWalletScoreBreakdown {
  walletAgeScore: number;
  txCountScore: number;
  activityScore: number;
  consistencyScore: number;
  volumeScore: number;
  diversityScore: number;
  trustScore: number;
  penaltyScore: number;
  totalScore: number;
}

export interface BaseWalletScoreResult {
  address: string;
  chain: "base";
  txCount: number;
  walletAgeDays: number;
  activeDays30: number;
  activeDays90: number;
  uniqueContracts: number;
  totalVolumeEth: number;
  confidence: number;
  sampleSize: number;
  source: "blockscout";
  scoringVersion: "base-score-v2";
  breakdown: BaseWalletScoreBreakdown;
  tier: "Dormant" | "Active" | "Power" | "Whale";
  insights: string[];
}

type BlockscoutAddressRef = {
  hash?: string;
  is_contract?: boolean;
  reputation?: string;
};

type BlockscoutTx = {
  timestamp?: string;
  value?: string;
  result?: string;
  status?: string;
  method?: string;
  raw_input?: string;
  to?: BlockscoutAddressRef | null;
  from?: BlockscoutAddressRef | null;
  created_contract?: BlockscoutAddressRef | null;
};

type BlockscoutResponse = {
  items?: BlockscoutTx[];
  next_page_params?: { block_number?: number; index?: number } | null;
};

type BlockscoutCountersResponse = {
  transactions_count?: string;
  token_transfers_count?: string;
};

const MAX_TRANSACTION_PAGES = 8;
const PAGE_SIZE = 50;

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

function safeNumber(value: string | undefined): number {
  const n = Number(value ?? "0");
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function logScore(value: number, capAt: number, maxScore: number): number {
  if (value <= 0) return 0;
  return Math.round(clamp((Math.log10(value + 1) / Math.log10(capAt + 1)) * maxScore, 0, maxScore));
}

function scoreActiveDays(activeDays: number, maxScore: number): number {
  // Diminishing returns: 18+ active days/month is excellent without over-rewarding spam.
  return Math.round(clamp(Math.sqrt(Math.min(activeDays, 30) / 18) * maxScore, 0, maxScore));
}

function addressHash(ref?: BlockscoutAddressRef | null): string | null {
  const hash = ref?.hash;
  return hash && /^0x[a-fA-F0-9]{40}$/.test(hash) ? hash.toLowerCase() : null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": "BaseScore/1.0",
    },
  });

  if (!res.ok) throw new Error(`Blockscout HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchBlockscoutTxs(address: string, maxPages = MAX_TRANSACTION_PAGES): Promise<BlockscoutTx[]> {
  const items: BlockscoutTx[] = [];
  let nextParams: BlockscoutResponse["next_page_params"] = null;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`https://base.blockscout.com/api/v2/addresses/${address}/transactions`);
    url.searchParams.set("items_count", String(PAGE_SIZE));

    if (nextParams?.block_number !== undefined) {
      url.searchParams.set("block_number", String(nextParams.block_number));
    }
    if (nextParams?.index !== undefined) {
      url.searchParams.set("index", String(nextParams.index));
    }

    const json = await fetchJson<BlockscoutResponse>(url.toString());
    const pageItems = Array.isArray(json.items) ? json.items : [];

    items.push(...pageItems);
    nextParams = json.next_page_params ?? null;

    if (!nextParams || pageItems.length === 0) break;
  }

  return items;
}

async function fetchBlockscoutCounters(address: string): Promise<BlockscoutCountersResponse> {
  const url = `https://base.blockscout.com/api/v2/addresses/${address}/counters`;
  return fetchJson<BlockscoutCountersResponse>(url);
}

function buildInsights(params: {
  totalScore: number;
  confidence: number;
  txCount: number;
  activeDays30: number;
  uniqueContracts: number;
  penaltyScore: number;
}): string[] {
  const insights: string[] = [];

  if (params.confidence >= 85) insights.push("High-confidence score from a deep Blockscout sample.");
  else if (params.confidence >= 65) insights.push("Medium-confidence score; more history improves precision.");
  else insights.push("Low-confidence score because the wallet has limited indexed activity.");

  if (params.activeDays30 >= 12) insights.push("Strong recent Base consistency.");
  else if (params.activeDays30 <= 2) insights.push("Recent activity is light, so consistency is capped.");

  if (params.uniqueContracts >= 20) insights.push("Healthy contract diversity across Base apps.");
  else if (params.txCount >= 20) insights.push("Activity exists, but protocol diversity is still narrow.");

  if (params.penaltyScore > 0) insights.push("Burst or repetitive patterns reduced the final score.");
  if (params.totalScore >= 850) insights.push("Top-tier onchain footprint detected.");

  return insights.slice(0, 4);
}

export async function calculateBaseWalletScore(address: string): Promise<BaseWalletScoreResult> {
  const normalizedAddress = address.toLowerCase();
  const [txs, counters] = await Promise.all([
    fetchBlockscoutTxs(normalizedAddress),
    fetchBlockscoutCounters(normalizedAddress).catch(() => ({} as BlockscoutCountersResponse)),
  ]);

  const sampledTxCount = txs.length;
  const txCountFromCounters = safeNumber(counters.transactions_count);
  const txCount = Math.max(txCountFromCounters, sampledTxCount);
  const tokenTransferCount = safeNumber(counters.token_transfers_count);

  const txTimes = txs
    .map((tx) => parseIsoToMs(tx.timestamp))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  const firstSampleTs = txTimes.length > 0 ? txTimes[0] : Date.now();
  const newestSampleTs = txTimes.length > 0 ? txTimes[txTimes.length - 1] : 0;
  const now = Date.now();
  const walletAgeDays = Math.max(0, Math.floor((now - firstSampleTs) / 86_400_000));

  const days30Cutoff = now - 30 * 86_400_000;
  const days90Cutoff = now - 90 * 86_400_000;
  const activeDates30 = new Set<string>();
  const activeDates90 = new Set<string>();
  const contractSet = new Set<string>();
  const valueDates90 = new Set<string>();
  const dailyCounts = new Map<string, number>();
  let totalWei = 0n;
  let failedTxCount = 0;
  let contractInteractions = 0;

  for (const tx of txs) {
    const tsMs = parseIsoToMs(tx.timestamp);
    const dateKey = tsMs > 0 ? new Date(tsMs).toISOString().slice(0, 10) : "unknown";

    if (tsMs >= days30Cutoff) activeDates30.add(dateKey);
    if (tsMs >= days90Cutoff) activeDates90.add(dateKey);
    if (tsMs > 0) dailyCounts.set(dateKey, (dailyCounts.get(dateKey) ?? 0) + 1);

    if (tx.result && tx.result !== "success") failedTxCount += 1;
    if (tx.status && tx.status !== "ok") failedTxCount += 1;

    const toHash = addressHash(tx.to);
    const createdHash = addressHash(tx.created_contract);
    if (toHash && toHash !== normalizedAddress) contractSet.add(toHash);
    if (createdHash) contractSet.add(createdHash);
    if (tx.to?.is_contract || tx.created_contract) contractInteractions += 1;

    try {
      const wei = BigInt(tx.value || "0");
      totalWei += wei;
      if (wei > 0n && tsMs >= days90Cutoff) valueDates90.add(dateKey);
    } catch {
      // ignore malformed value
    }
  }

  const activeDays30 = activeDates30.size;
  const activeDays90 = activeDates90.size;
  const uniqueContracts = contractSet.size;
  const totalVolumeEth = Number(totalWei) / 1e18;
  const sampleCoverage = txCount > 0 ? Math.min(1, sampledTxCount / Math.min(txCount, MAX_TRANSACTION_PAGES * PAGE_SIZE)) : 0;
  const sampleSpanDays = newestSampleTs > 0 ? Math.max(1, Math.floor((newestSampleTs - firstSampleTs) / 86_400_000) + 1) : 0;
  const confidence = Math.round(clamp(35 + sampleCoverage * 35 + Math.min(sampledTxCount / 120, 1) * 20 + Math.min(sampleSpanDays / 60, 1) * 10, 0, 100));

  const maxDailyTx = Math.max(0, ...dailyCounts.values());
  const burstRatio = sampledTxCount > 0 ? maxDailyTx / sampledTxCount : 0;
  const failedRatio = sampledTxCount > 0 ? failedTxCount / sampledTxCount : 0;
  const repetitiveRatio = sampledTxCount >= 30 && uniqueContracts <= 2 ? 0.35 : 0;

  const walletAgeScore = Math.round(clamp(Math.sqrt(walletAgeDays / 730) * 160, 0, 160));
  const txCountScore = logScore(txCount, 5000, 220);
  const activityScore = scoreActiveDays(activeDays30, 170);
  const consistencyScore = Math.round(clamp((activeDays90 / 45) * 120 + Math.min(valueDates90.size, 12) * 2, 0, 140));
  const volumeScore = logScore(totalVolumeEth, 250, 110);
  const diversityScore = Math.round(clamp(logScore(uniqueContracts, 120, 120) + logScore(tokenTransferCount, 1000, 20), 0, 140));
  const trustScore = Math.round(clamp(confidence * 0.6 + Math.min(contractInteractions, 50) * 0.8, 0, 90));
  const penaltyScore = Math.round(clamp(
    Math.max(0, burstRatio - 0.45) * 120 + failedRatio * 80 + repetitiveRatio * 100,
    0,
    140,
  ));

  const totalScore = clamp(
    walletAgeScore + txCountScore + activityScore + consistencyScore + volumeScore + diversityScore + trustScore - penaltyScore,
    0,
    1000,
  );

  return {
    address: normalizedAddress,
    chain: "base",
    txCount,
    walletAgeDays,
    activeDays30,
    activeDays90,
    uniqueContracts,
    totalVolumeEth: Number(totalVolumeEth.toFixed(4)),
    confidence,
    sampleSize: sampledTxCount,
    source: "blockscout",
    scoringVersion: "base-score-v2",
    breakdown: {
      walletAgeScore,
      txCountScore,
      activityScore,
      consistencyScore,
      volumeScore,
      diversityScore,
      trustScore,
      penaltyScore,
      totalScore,
    },
    tier: tierFromScore(totalScore),
    insights: buildInsights({ totalScore, confidence, txCount, activeDays30, uniqueContracts, penaltyScore }),
  };
}

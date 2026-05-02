export interface BaseWalletScoreBreakdown {
  walletAgeScore: number;
  txCountScore: number;
  activityScore: number;
  consistencyScore: number;
  volumeScore: number;
  diversityScore: number;
  trustScore: number;
  socialScore: number;
  penaltyScore: number;
  totalScore: number;
}

export type ProtocolCategory =
  | "swap"
  | "bridge"
  | "nft"
  | "social"
  | "builder"
  | "defi"
  | "gaming"
  | "stablecoin"
  | "transfer"
  | "contract"
  | "unknown";

export interface BaseProtocolBreakdown {
  categoryCounts: Record<ProtocolCategory, number>;
  categoryDiversity: number;
  primaryCategory: ProtocolCategory | "none";
  topCategories: { category: ProtocolCategory; count: number; weight: number }[];
}

export interface FarcasterSocialSignal {
  fid: number;
  username?: string;
  followers: number;
  castsSampled: number;
  likesSampled: number;
  activeDays30: number;
  score: number;
  confidence: number;
  source: "warpcast-public";
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
  protocolBreakdown: BaseProtocolBreakdown;
  farcasterSocial?: FarcasterSocialSignal;
  breakdown: BaseWalletScoreBreakdown;
  tier: "Dormant" | "Active" | "Power" | "Whale";
  insights: string[];
}

type BlockscoutAddressRef = {
  hash?: string;
  is_contract?: boolean;
  reputation?: string;
  name?: string;
  ens_domain_name?: string;
};

type BlockscoutTx = {
  timestamp?: string | number;
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

type BlockscoutLegacyTx = {
  timeStamp?: string;
  value?: string;
  isError?: string;
  txreceipt_status?: string;
  methodId?: string;
  input?: string;
  to?: string;
  contractAddress?: string;
};

type BlockscoutLegacyResponse = {
  status?: string;
  message?: string;
  result?: BlockscoutLegacyTx[] | string;
};

type WarpcastUserResponse = {
  result?: {
    user?: {
      fid?: number;
      username?: string;
      followerCount?: number;
      followingCount?: number;
    };
  };
};

type WarpcastCastsResponse = {
  result?: {
    casts?: {
      timestamp?: string | number;
      reactions?: { count?: number };
    }[];
  };
};

// Keep the first load fast in Mini App clients. Counters still provide full tx totals,
// while the latest 150 indexed transactions are enough for recency/protocol signals.
const MAX_TRANSACTION_PAGES = 3;
const PAGE_SIZE = 50;
const FARCASTER_CAST_LIMIT = 25;

const PROTOCOL_CATEGORY_ORDER: ProtocolCategory[] = [
  "swap",
  "bridge",
  "nft",
  "social",
  "builder",
  "defi",
  "gaming",
  "stablecoin",
  "transfer",
  "contract",
  "unknown",
];

const SWAP_SELECTORS = new Set([
  "0x38ed1739",
  "0x04e45aaf",
  "0x414bf389",
  "0x7ff36ab5",
  "0x18cbafe5",
  "0x5c11d795",
  "0x128acb08",
  "0x3593564c",
]);

const NFT_SELECTORS = new Set([
  "0xa0712d68",
  "0x40c10f19",
  "0x1249c58b",
  "0x6a627842",
  "0x9dbb844d",
]);

const TRANSFER_SELECTORS = new Set(["0xa9059cbb", "0x23b872dd", "0x095ea7b3"]);

const CATEGORY_KEYWORDS: { category: ProtocolCategory; keywords: string[] }[] = [
  { category: "bridge", keywords: ["bridge", "portal", "l1standardbridge", "optimismportal", "deposit", "withdraw"] },
  { category: "swap", keywords: ["swap", "uniswap", "aerodrome", "velodrome", "pancake", "odos", "1inch", "router", "quoter"] },
  { category: "nft", keywords: ["mint", "collect", "nft", "erc721", "erc1155", "zora", "opensea", "manifold", "sound"] },
  { category: "social", keywords: ["farcaster", "warpcast", "frames", "frame", "paragraph", "hypersub", "friendtech", "social"] },
  { category: "builder", keywords: ["create", "deploy", "factory", "proxy", "clone", "safe", "module", "contract"] },
  { category: "defi", keywords: ["lend", "borrow", "stake", "staking", "vault", "pool", "deposit", "withdraw", "aave", "compound", "morpho", "yearn"] },
  { category: "gaming", keywords: ["game", "gaming", "quest", "loot", "match", "tournament"] },
  { category: "stablecoin", keywords: ["usdc", "usdbc", "dai", "usdt", "stable"] },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function tierFromScore(score: number): BaseWalletScoreResult["tier"] {
  if (score >= 850) return "Whale";
  if (score >= 650) return "Power";
  if (score >= 350) return "Active";
  return "Dormant";
}

function parseIsoToMs(value?: string | number): number {
  if (!value) return 0;
  const t = typeof value === "number" ? value : new Date(value).getTime();
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

function methodSelector(tx: BlockscoutTx): string {
  const input = tx.raw_input?.toLowerCase();
  return input && input.length >= 10 ? input.slice(0, 10) : "";
}

function searchableText(tx: BlockscoutTx): string {
  return [
    tx.method,
    tx.to?.name,
    tx.to?.ens_domain_name,
    tx.to?.reputation,
    tx.created_contract?.name,
    tx.created_contract?.reputation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function classifyProtocol(tx: BlockscoutTx): ProtocolCategory {
  if (tx.created_contract) return "builder";

  const selector = methodSelector(tx);
  if (SWAP_SELECTORS.has(selector)) return "swap";
  if (NFT_SELECTORS.has(selector)) return "nft";
  if (TRANSFER_SELECTORS.has(selector)) return "transfer";

  const text = searchableText(tx);
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) return rule.category;
  }

  const valueWei = (() => {
    try {
      return BigInt(tx.value || "0");
    } catch {
      return 0n;
    }
  })();

  if (!tx.to?.is_contract && valueWei > 0n) return "transfer";
  if (tx.to?.is_contract || selector) return "contract";
  return "unknown";
}

function emptyCategoryCounts(): Record<ProtocolCategory, number> {
  return PROTOCOL_CATEGORY_ORDER.reduce((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {} as Record<ProtocolCategory, number>);
}

function buildProtocolBreakdown(categoryCounts: Record<ProtocolCategory, number>): BaseProtocolBreakdown {
  const ranked = PROTOCOL_CATEGORY_ORDER
    .map((category) => ({ category, count: categoryCounts[category] ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const totalClassified = ranked.reduce((sum, item) => sum + item.count, 0);
  const meaningfulCategories = ranked.filter((item) => item.category !== "unknown" && item.category !== "contract" && item.count > 0);

  return {
    categoryCounts,
    categoryDiversity: meaningfulCategories.length,
    primaryCategory: ranked[0]?.category ?? "none",
    topCategories: ranked.slice(0, 4).map((item) => ({
      ...item,
      weight: totalClassified > 0 ? Number((item.count / totalClassified).toFixed(2)) : 0,
    })),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": "BaseScore/1.0",
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function normalizeLegacyTx(tx: BlockscoutLegacyTx): BlockscoutTx {
  const toHash = /^0x[a-fA-F0-9]{40}$/.test(tx.to ?? "") ? tx.to : undefined;
  const contractHash = /^0x[a-fA-F0-9]{40}$/.test(tx.contractAddress ?? "") ? tx.contractAddress : undefined;

  return {
    timestamp: tx.timeStamp ? Number(tx.timeStamp) * 1000 : undefined,
    value: tx.value,
    result: tx.isError === "1" ? "failed" : "success",
    status: tx.txreceipt_status === "0" ? "failed" : "ok",
    raw_input: tx.input,
    method: tx.methodId,
    to: toHash ? { hash: toHash, is_contract: Boolean(tx.input && tx.input !== "0x") } : null,
    created_contract: contractHash ? { hash: contractHash, is_contract: true } : null,
  };
}

async function fetchBlockscoutTxs(address: string): Promise<BlockscoutTx[]> {
  // The legacy account endpoint is much faster for the newest tx sample than paging v2.
  // v2 remains available as a fallback when legacy output is empty or temporarily unavailable.
  try {
    const url = new URL("https://base.blockscout.com/api");
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "txlist");
    url.searchParams.set("address", address);
    url.searchParams.set("startblock", "0");
    url.searchParams.set("endblock", "99999999");
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", String(MAX_TRANSACTION_PAGES * PAGE_SIZE));
    url.searchParams.set("sort", "desc");

    const legacy = await fetchJson<BlockscoutLegacyResponse>(url.toString());
    if (Array.isArray(legacy.result) && legacy.result.length > 0) {
      return legacy.result.map(normalizeLegacyTx);
    }
  } catch {
    // Fall through to v2 fallback.
  }

  const items: BlockscoutTx[] = [];
  let nextParams: BlockscoutResponse["next_page_params"] = null;

  for (let page = 0; page < MAX_TRANSACTION_PAGES; page += 1) {
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

async function fetchFarcasterSocialSignal(fid?: number): Promise<FarcasterSocialSignal | undefined> {
  if (!fid || !Number.isInteger(fid) || fid <= 0) return undefined;

  try {
    const [userPayload, castsPayload] = await Promise.all([
      fetchJson<WarpcastUserResponse>(`https://api.warpcast.com/v2/user-by-fid?fid=${fid}`),
      fetchJson<WarpcastCastsResponse>(`https://api.warpcast.com/v2/casts?fid=${fid}&limit=${FARCASTER_CAST_LIMIT}`),
    ]);

    const user = userPayload.result?.user;
    const casts = Array.isArray(castsPayload.result?.casts) ? castsPayload.result.casts : [];
    const followers = safeNumber(String(user?.followerCount ?? 0));
    const following = safeNumber(String(user?.followingCount ?? 0));
    const likesSampled = casts.reduce((sum, cast) => sum + safeNumber(String(cast.reactions?.count ?? 0)), 0);
    const now = Date.now();
    const days30Cutoff = now - 30 * 86_400_000;
    const activeDays = new Set<string>();

    for (const cast of casts) {
      const tsMs = parseIsoToMs(cast.timestamp);
      if (tsMs >= days30Cutoff) activeDays.add(new Date(tsMs).toISOString().slice(0, 10));
    }

    const followerScore = logScore(followers, 5000, 24);
    const castScore = logScore(casts.length, 100, 12);
    const engagementScore = logScore(likesSampled, 1000, 12);
    const activeScore = Math.round(clamp((activeDays.size / 12) * 12, 0, 12));
    const graphPenalty = following > Math.max(80, followers * 8) ? 8 : 0;
    const score = Math.round(clamp(followerScore + castScore + engagementScore + activeScore - graphPenalty, 0, 60));
    const confidence = Math.round(clamp(45 + Math.min(casts.length / FARCASTER_CAST_LIMIT, 1) * 35 + (followers > 0 ? 20 : 0), 0, 100));

    return {
      fid,
      username: user?.username,
      followers,
      castsSampled: casts.length,
      likesSampled,
      activeDays30: activeDays.size,
      score,
      confidence,
      source: "warpcast-public",
    };
  } catch {
    return undefined;
  }
}

function buildInsights(params: {
  totalScore: number;
  confidence: number;
  txCount: number;
  activeDays30: number;
  uniqueContracts: number;
  penaltyScore: number;
  protocolBreakdown: BaseProtocolBreakdown;
  farcasterSocial?: FarcasterSocialSignal;
}): string[] {
  const insights: string[] = [];

  if (params.confidence >= 85) insights.push("High-confidence score from a deep Blockscout sample.");
  else if (params.confidence >= 65) insights.push("Medium-confidence score; more history improves precision.");
  else insights.push("Low-confidence score because the wallet has limited indexed activity.");

  if (params.protocolBreakdown.categoryDiversity >= 4) insights.push("Protocol mix spans multiple Base categories.");
  else if (params.txCount >= 20) insights.push("Activity exists, but protocol category diversity is still narrow.");

  if (params.farcasterSocial?.score) insights.push("Farcaster activity adds an identity-backed social boost.");
  else insights.push("Farcaster social signal was unavailable, so scoring stayed onchain-first.");

  if (params.activeDays30 >= 12) insights.push("Strong recent Base consistency.");
  else if (params.activeDays30 <= 2) insights.push("Recent activity is light, so consistency is capped.");

  if (params.uniqueContracts >= 20 && params.protocolBreakdown.categoryDiversity >= 3) insights.push("Healthy contract and protocol diversity across Base apps.");
  if (params.penaltyScore > 0) insights.push("Burst or repetitive patterns reduced the final score.");
  if (params.totalScore >= 850) insights.push("Top-tier onchain footprint detected.");

  return insights.slice(0, 4);
}

export async function calculateBaseWalletScore(address: string, options: { fid?: number } = {}): Promise<BaseWalletScoreResult> {
  const normalizedAddress = address.toLowerCase();
  const [txs, counters, farcasterSocial] = await Promise.all([
    fetchBlockscoutTxs(normalizedAddress),
    fetchBlockscoutCounters(normalizedAddress).catch(() => ({} as BlockscoutCountersResponse)),
    fetchFarcasterSocialSignal(options.fid),
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
  const categoryCounts = emptyCategoryCounts();
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

    const category = classifyProtocol(tx);
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;

    try {
      const wei = BigInt(tx.value || "0");
      totalWei += wei;
      if (wei > 0n && tsMs >= days90Cutoff) valueDates90.add(dateKey);
    } catch {
      // ignore malformed value
    }
  }

  const protocolBreakdown = buildProtocolBreakdown(categoryCounts);
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
  const narrowProtocolPenalty = sampledTxCount >= 40 && protocolBreakdown.categoryDiversity <= 1 ? 0.18 : 0;

  const walletAgeScore = Math.round(clamp(Math.sqrt(walletAgeDays / 730) * 145, 0, 145));
  const txCountScore = logScore(txCount, 5000, 205);
  const activityScore = scoreActiveDays(activeDays30, 160);
  const consistencyScore = Math.round(clamp((activeDays90 / 45) * 112 + Math.min(valueDates90.size, 12) * 2, 0, 132));
  const volumeScore = logScore(totalVolumeEth, 250, 105);
  const protocolDiversityScore = Math.round(clamp((protocolBreakdown.categoryDiversity / 7) * 55, 0, 55));
  const diversityScore = Math.round(clamp(logScore(uniqueContracts, 120, 92) + logScore(tokenTransferCount, 1000, 18) + protocolDiversityScore, 0, 165));
  const trustScore = Math.round(clamp(confidence * 0.5 + Math.min(contractInteractions, 50) * 0.65 + protocolBreakdown.categoryDiversity * 5, 0, 88));
  const socialScore = farcasterSocial?.score ?? 0;
  const penaltyScore = Math.round(clamp(
    Math.max(0, burstRatio - 0.45) * 120 + failedRatio * 80 + repetitiveRatio * 100 + narrowProtocolPenalty * 100,
    0,
    140,
  ));

  const totalScore = clamp(
    walletAgeScore + txCountScore + activityScore + consistencyScore + volumeScore + diversityScore + trustScore + socialScore - penaltyScore,
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
    protocolBreakdown,
    farcasterSocial,
    breakdown: {
      walletAgeScore,
      txCountScore,
      activityScore,
      consistencyScore,
      volumeScore,
      diversityScore,
      trustScore,
      socialScore,
      penaltyScore,
      totalScore,
    },
    tier: tierFromScore(totalScore),
    insights: buildInsights({ totalScore, confidence, txCount, activeDays30, uniqueContracts, penaltyScore, protocolBreakdown, farcasterSocial }),
  };
}

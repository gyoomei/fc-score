"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { base } from "viem/chains";
import { createPublicClient, createWalletClient, custom, encodeDeployData, http, type Hex } from "viem";
import { ScoreLoading } from "@/features/app/components/score-loading";
import { useFarcasterUser } from "@/neynar-farcaster-sdk/mini";
import { ERC20_TOKEN_ABI, ERC20_TOKEN_BYTECODE } from "@/features/app/erc20-token-artifact";

type TierName = "Dormant" | "Active" | "Power" | "Whale";
type AppTab = "score" | "deploy";
type MiniEthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: MiniEthereumProvider;
  }
}

type ProtocolCategory =
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

type ApiResult = {
  address: string;
  chain: "base";
  txCount: number;
  walletAgeDays: number;
  activeDays30: number;
  activeDays90?: number;
  uniqueContracts?: number;
  totalVolumeEth: number;
  confidence?: number;
  sampleSize?: number;
  source?: string;
  scoringVersion?: string;
  protocolBreakdown?: {
    categoryDiversity: number;
    primaryCategory: ProtocolCategory | "none";
    topCategories: { category: ProtocolCategory; count: number; weight: number }[];
  };
  farcasterSocial?: {
    fid: number;
    username?: string;
    followers: number;
    castsSampled: number;
    likesSampled: number;
    activeDays30: number;
    score: number;
    confidence: number;
    source: "warpcast-public";
  };
  insights?: string[];
  breakdown: {
    walletAgeScore: number;
    txCountScore: number;
    activityScore: number;
    consistencyScore?: number;
    volumeScore: number;
    diversityScore?: number;
    trustScore?: number;
    socialScore?: number;
    penaltyScore?: number;
    totalScore: number;
  };
  tier: TierName;
};

function getFarcasterFid(user: unknown): number | undefined {
  const fid = typeof user === "object" && user && "fid" in user ? Number((user as { fid?: unknown }).fid) : NaN;
  return Number.isInteger(fid) && fid > 0 ? fid : undefined;
}

function formatProtocolLabel(category: ProtocolCategory | "none"): string {
  if (category === "none") return "None";
  return category === "defi" ? "DeFi" : category === "nft" ? "NFT" : category.replace(/^./, (char) => char.toUpperCase());
}

const TIER_STEPS: { name: TierName; range: string; hint: string }[] = [
  { name: "Dormant", range: "0–349", hint: "Low activity" },
  { name: "Active", range: "350–649", hint: "Consistent usage" },
  { name: "Power", range: "650–849", hint: "High engagement" },
  { name: "Whale", range: "850–1000", hint: "Top onchain signal" },
];

function shortenAddress(value: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function MiniApp() {
  const { data: fcUser, isLoading: userLoading } = useFarcasterUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string>("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("score");
  const hasAutoFetchedRef = useRef(false);

  const isValidAddress = useMemo(
    () => /^0x[a-fA-F0-9]{40}$/.test(resolvedAddress.trim()),
    [resolvedAddress],
  );

  async function fetchScore(addr: string) {
    setLoading(true);
    setError(null);

    try {
      const fid = getFarcasterFid(fcUser);
      const scoreUrl = fid ? `/api/score/base/${addr}?fid=${fid}` : `/api/score/base/${addr}`;
      const res = await fetch(scoreUrl, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to calculate score");
      setResult(json as ApiResult);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (hasAutoFetchedRef.current) return;
    if (userLoading) return;

    const pickAddressFromUnknown = (input: unknown): string | null => {
      if (!input) return null;
      if (typeof input === "string") {
        return /^0x[a-fA-F0-9]{40}$/.test(input) ? input : null;
      }
      if (Array.isArray(input)) {
        for (const item of input) {
          const found = pickAddressFromUnknown(item);
          if (found) return found;
        }
        return null;
      }
      if (typeof input === "object") {
        const obj = input as Record<string, unknown>;
        for (const key of [
          "address",
          "addr",
          "ethAddress",
          "ethereumAddress",
          "custodyAddress",
          "walletAddress",
        ]) {
          const found = pickAddressFromUnknown(obj[key]);
          if (found) return found;
        }
      }
      return null;
    };

    const getCandidateAddress = async () => {
      const u = (fcUser ?? {}) as Record<string, unknown>;

      const fromUserFields = pickAddressFromUnknown([
        u["custodyAddress"],
        u["verifications"],
        u["verifiedAddresses"],
        u["ethAddresses"],
      ]);
      if (fromUserFields) return fromUserFields;

      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (provider?.request) {
          try {
            const accountsSilentRaw = (await provider.request({
              method: "eth_accounts",
            })) as unknown;
            const fromSilent = pickAddressFromUnknown(accountsSilentRaw);
            if (fromSilent) return fromSilent;
          } catch {
            // Silent wallet lookup can fail outside Farcaster; explicit request below handles it.
          }

          try {
            const accountsRaw = (await provider.request({
              method: "eth_requestAccounts",
            })) as unknown;
            const fromRequest = pickAddressFromUnknown(accountsRaw);
            if (fromRequest) return fromRequest;
          } catch {
            // User may reject the score auto-connect request; score view can stay empty.
          }
        }
      } catch {
        // Wallet SDK may be unavailable outside Mini App clients.
      }

      return null;
    };

    void (async () => {
      const candidate = await getCandidateAddress();

      if (!candidate) {
        setError("Base wallet was not found from your Farcaster context or verified addresses.");
        return;
      }

      setResolvedAddress(candidate);
      hasAutoFetchedRef.current = true;
      void fetchScore(candidate);
    })();
  }, [fcUser, userLoading]);

  const handleShare = async () => {
    if (!result) return;

    setShareError(null);
    setSharing(true);

    const score = result.breakdown.totalScore;
    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
    const text = `My Base wallet score is ${score} (${result.tier}) ⚡\nBuilt from live Base activity, consistency, diversity, and trust signals.\nCan you beat my score? 👇`;
    const handle = (fcUser as { username?: string } | null)?.username || "base-user";
    const avatar = (fcUser as { pfpUrl?: string } | null)?.pfpUrl || "";
    const shareVersion = Date.now().toString();
    const shareParams = new URLSearchParams({
      personalize: "true",
      score: String(score),
      tier: result.tier,
      username: handle.replace(/^@/, ""),
      address: shortenAddress(result.address),
      tx: String(result.txCount),
      active: String(result.activeDays30),
      volume: String(result.totalVolumeEth),
      v: shareVersion,
    });
    if (avatar) shareParams.set("pfp", avatar);
    const sharePageUrl = appUrl ? `${appUrl}/?${shareParams.toString()}` : "";

    const embeds: [] | [string] = sharePageUrl ? ([sharePageUrl] as [string]) : [];

    try {
      await sdk.actions.composeCast({
        text,
        embeds,
      });
    } catch {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text.trim());
        }
      } catch {
        // Clipboard fallback is best-effort only.
      }

      if (typeof window !== "undefined") {
        const fallbackText = encodeURIComponent(text.trim());
        const fallbackEmbed = sharePageUrl ? `&embeds[]=${encodeURIComponent(sharePageUrl)}` : "";
        window.open(`https://warpcast.com/~/compose?text=${fallbackText}${fallbackEmbed}`, "_blank", "noopener,noreferrer");
      }

      setShareError("Native composer failed, so Warpcast fallback was opened.");
    } finally {
      setSharing(false);
    }
  };

  const showLoading = !result && (userLoading || loading);
  const shortAddress = isValidAddress ? `${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}` : "Auto-detect wallet";
  const currentTierIndex = result ? TIER_STEPS.findIndex((item) => item.name === result.tier) : -1;

  return (
    <PageShell>
      <Header subtitle={activeTab === "score" && result ? `Wallet: ${shortAddress}` : "Base reputation • token deploy"} />
      <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "deploy" ? (
        <DeployTokenPanel />
      ) : showLoading ? (
        <ScoreLoading />
      ) : error && !result ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
      ) : !isValidAddress || !result ? null : (
      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
        <div className="group relative isolate overflow-hidden rounded-[28px] border border-white/15 bg-[linear-gradient(155deg,rgba(139,92,246,0.26),rgba(31,41,55,0.20)_45%,rgba(251,191,36,0.18))] p-6 shadow-[0_20px_80px_rgba(76,29,149,0.34)] ring-1 ring-inset ring-white/10 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_30px_95px_rgba(124,58,237,0.42)]
        ">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.25),transparent_35%)]" />
          <div className="pointer-events-none absolute -top-14 -right-10 h-36 w-36 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="pointer-events-none absolute right-6 top-6 h-2 w-2 animate-ping rounded-full bg-violet-200/80" />

          <p className="text-gray-200/90 text-[11px] font-extrabold uppercase tracking-[0.26em]">Total Score</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="bg-gradient-to-r from-white via-violet-100 to-amber-100 bg-clip-text text-6xl font-black leading-none text-transparent drop-shadow-[0_2px_22px_rgba(124,58,237,0.52)]">
              <AnimatedNumber value={result.breakdown.totalScore} duration={1100} />
            </p>
            <div className="mb-1 rounded-xl border border-white/15 bg-black/20 px-3 py-1 text-right backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-300">Reputation Index</p>
              <p className="text-xs font-extrabold text-emerald-200">Verified Onchain</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-violet-100 transition-all duration-300 group-hover:scale-[1.03]">Tier {result.tier}</p>
            <span className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">Live Base</span>
          </div>
          <div className="pointer-events-none mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent ${ready ? "animate-[shimmerX_2.2s_ease-in-out_infinite]" : ""}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Metric delay={0} label="Tx Count" value={result.txCount.toLocaleString()} />
          <Metric delay={70} label="Wallet Age" value={`${result.walletAgeDays} days`} />
          <Metric delay={140} label="Active Days" value={`${result.activeDays30} / 30d`} />
          <Metric delay={210} label="Contracts" value={(result.uniqueContracts ?? 0).toLocaleString()} />
          <Metric delay={280} label="Volume" value={`${result.totalVolumeEth} ETH`} />
          <Metric delay={350} label="Confidence" value={`${result.confidence ?? 0}%`} />
          <Metric delay={420} label="Protocols" value={`${result.protocolBreakdown?.categoryDiversity ?? 0} types`} />
          <Metric
            delay={490}
            label="Farcaster"
            value={result.farcasterSocial ? `+${result.breakdown.socialScore ?? 0}` : "Onchain only"}
          />
        </div>

        {result.protocolBreakdown || result.farcasterSocial ? (
          <div className="grid gap-2.5 md:grid-cols-2">
            <SignalCard
              eyebrow="Protocol Mix"
              title={formatProtocolLabel(result.protocolBreakdown?.primaryCategory ?? "none")}
              value={`${result.protocolBreakdown?.categoryDiversity ?? 0} categories`}
              detail={
                result.protocolBreakdown?.topCategories?.length
                  ? result.protocolBreakdown.topCategories
                      .slice(0, 3)
                      .map((item) => `${formatProtocolLabel(item.category)} ${Math.round(item.weight * 100)}%`)
                      .join(" · ")
                  : "No classified protocol activity yet"
              }
            />
            <SignalCard
              eyebrow="Social Signal"
              title={result.farcasterSocial?.username ? `@${result.farcasterSocial.username}` : "Onchain-first"}
              value={result.farcasterSocial ? `+${result.breakdown.socialScore ?? 0} score` : "Optional"}
              detail={
                result.farcasterSocial
                  ? `${result.farcasterSocial.followers.toLocaleString()} followers · ${result.farcasterSocial.activeDays30}/30d active`
                  : "Open in Farcaster to add public social context"
              }
            />
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 backdrop-blur-md shadow-[0_14px_44px_rgba(0,0,0,0.30)] ring-1 ring-inset ring-white/10">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-gray-400">Breakdown</p>
            <span className="text-[11px] font-semibold text-violet-200/80">Auto weighted</span>
          </div>
          <BreakRow label="Wallet Age" value={result.breakdown.walletAgeScore} max={160} />
          <BreakRow label="Tx Count" value={result.breakdown.txCountScore} max={220} />
          <BreakRow label="Activity" value={result.breakdown.activityScore} max={170} />
          <BreakRow label="Consistency" value={result.breakdown.consistencyScore ?? 0} max={140} />
          <BreakRow label="Volume" value={result.breakdown.volumeScore} max={110} />
          <BreakRow label="Diversity" value={result.breakdown.diversityScore ?? 0} max={165} />
          <BreakRow label="Trust" value={result.breakdown.trustScore ?? 0} max={90} />
          {(result.breakdown.socialScore ?? 0) > 0 ? <BreakRow label="Farcaster" value={result.breakdown.socialScore ?? 0} max={60} /> : null}
          {(result.breakdown.penaltyScore ?? 0) > 0 ? (
            <BreakRow label="Penalty" value={-(result.breakdown.penaltyScore ?? 0)} max={140} tone="danger" />
          ) : null}
        </div>


        <div className="rounded-2xl border border-violet-300/24 bg-[linear-gradient(160deg,rgba(124,58,237,0.10),rgba(255,255,255,0.02))] p-4 backdrop-blur-md shadow-[0_14px_36px_rgba(76,29,149,0.24)] ring-1 ring-inset ring-white/10">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-violet-200">Tier Ladder</p>
            <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-2 py-0.5 text-[11px] font-semibold text-violet-100">
              Current: {result.tier}
            </span>
          </div>

          <div className="space-y-2">
            {TIER_STEPS.map((tier, index) => {
              const isCurrent = tier.name === result.tier;
              const isUnlocked = currentTierIndex >= index;

              return (
                <div
                  key={tier.name}
                  className={`relative overflow-hidden rounded-xl border px-3 py-2 transition-all duration-300 ${
                    isCurrent
                      ? "border-amber-300/55 bg-gradient-to-r from-amber-300/14 via-violet-400/16 to-violet-300/12 shadow-[0_10px_24px_rgba(245,158,11,0.18)]"
                      : isUnlocked
                        ? "border-violet-300/25 bg-violet-400/8"
                        : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  {isCurrent ? (
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.18),transparent_45%)]" />
                  ) : null}
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-white">{tier.name}</p>
                      <p className="text-[11px] font-semibold text-gray-400">{tier.hint}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-bold text-gray-200">
                        {tier.range}
                      </span>
                      <span className={`text-xs font-black ${isUnlocked ? "text-emerald-300" : "text-gray-500"}`}>
                        {isCurrent ? "YOU" : isUnlocked ? "✓" : "•"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="w-full rounded-2xl border border-violet-300/35 bg-gradient-to-r from-violet-500/85 via-fuchsia-500/80 to-amber-400/80 px-4 py-3 text-sm font-extrabold text-white shadow-[0_12px_35px_rgba(124,58,237,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(124,58,237,0.45)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {sharing ? "Opening composer..." : "Share Score"}
          </button>
          {shareError ? (
            <p className="text-center text-xs font-semibold text-amber-300">{shareError}</p>
          ) : null}
        </div>
      </div>
      )}
    </PageShell>
  );
}

function TabSwitcher({ activeTab, onChange }: { activeTab: AppTab; onChange: (tab: AppTab) => void }) {
  const tabs: { id: AppTab; label: string; hint: string }[] = [
    { id: "score", label: "Base Score", hint: "Reputation" },
    { id: "deploy", label: "Deploy Token", hint: "ERC20" },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/12 bg-white/[0.04] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.25)] backdrop-blur-md">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`group relative overflow-hidden rounded-xl px-3 py-3 text-left transition-all duration-300 ${
              active
                ? "border border-amber-300/35 bg-gradient-to-r from-amber-300/18 via-violet-400/18 to-white/8 shadow-[0_12px_28px_rgba(245,158,11,0.18)]"
                : "border border-transparent bg-transparent hover:border-white/12 hover:bg-white/[0.04]"
            }`}
          >
            {active ? <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(255,255,255,0.16),transparent_45%)]" /> : null}
            <span className={`relative block text-xs font-black uppercase tracking-[0.13em] ${active ? "text-amber-100" : "text-gray-400"}`}>{tab.label}</span>
            <span className={`relative mt-0.5 block text-[10px] font-bold ${active ? "text-violet-100" : "text-gray-500"}`}>{tab.hint}</span>
          </button>
        );
      })}
    </div>
  );
}


function DeployTokenPanel() {
  const [tokenName, setTokenName] = useState("Base Token");
  const [tokenSymbol, setTokenSymbol] = useState("BASE");
  const [initialSupply, setInitialSupply] = useState("1000000");
  const [walletAddress, setWalletAddress] = useState("");
  const [txHash, setTxHash] = useState<Hex | "">("");
  const [contractAddress, setContractAddress] = useState<`0x${string}` | "">("");
  const [deploying, setDeploying] = useState(false);
  const [status, setStatus] = useState("Ready to deploy ERC20 on Base Mainnet.");
  const [deployError, setDeployError] = useState<string | null>(null);

  const canDeploy = tokenName.trim() && tokenSymbol.trim() && /^\d+$/.test(initialSupply.trim()) && BigInt(initialSupply || "0") > 0n;
  const shortWallet = walletAddress ? shortenAddress(walletAddress) : "Not connected";
  const shortTx = txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : "—";
  const shortContract = contractAddress ? shortenAddress(contractAddress) : "—";

  async function getMiniAppProvider() {
    try {
      const farcasterProvider = await sdk.wallet.getEthereumProvider();
      if (farcasterProvider?.request) return farcasterProvider as MiniEthereumProvider;
    } catch {
      // Fallback to injected browser wallet when Farcaster provider is unavailable.
    }

    if (typeof window !== "undefined" && window.ethereum?.request) return window.ethereum;
    throw new Error("Wallet provider not found. Open in Farcaster or connect a Base wallet.");
  }

  async function switchToBase(provider: MiniEthereumProvider) {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? (error as { code?: number }).code : undefined;
      if (code !== 4902) throw error;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x2105",
            chainName: "Base Mainnet",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://mainnet.base.org"],
            blockExplorerUrls: ["https://basescan.org"],
          },
        ],
      });
    }
  }

  async function connectWallet() {
    const provider = await getMiniAppProvider();
    await switchToBase(provider);
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const account = accounts.find((item) => /^0x[a-fA-F0-9]{40}$/.test(item));
    if (!account) throw new Error("No wallet account returned.");
    setWalletAddress(account);
    setStatus(`Connected: ${shortenAddress(account)}`);
    return { provider, account: account as `0x${string}` };
  }

  async function handleDeploy() {
    setDeployError(null);
    setContractAddress("");
    setTxHash("");

    if (!canDeploy) {
      setDeployError("Fill token name, symbol, and a whole-number supply greater than 0.");
      return;
    }

    setDeploying(true);
    try {
      setStatus("Connecting wallet and switching to Base...");
      const { provider, account } = await connectWallet();
      const transport = custom(provider);
      const walletClient = createWalletClient({ account, chain: base, transport });
      const publicClient = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });

      setStatus(`Preparing ${tokenName.trim()} (${tokenSymbol.trim().toUpperCase()}) deployment...`);
      const data = encodeDeployData({
        abi: ERC20_TOKEN_ABI,
        bytecode: ERC20_TOKEN_BYTECODE as Hex,
        args: [tokenName.trim(), tokenSymbol.trim().toUpperCase(), BigInt(initialSupply.trim())],
      });

      const hash = await walletClient.sendTransaction({ account, chain: base, data, gas: 3_500_000n, to: undefined });
      setTxHash(hash);
      setStatus("Transaction sent. Waiting for Base confirmation...");

      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("Deployment failed or contract address was not returned.");

      setContractAddress(receipt.contractAddress);
      setStatus(`Token deployed: ${shortenAddress(receipt.contractAddress)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDeployError(message);
      setStatus("Deployment failed. Check wallet and gas, then retry.");
    } finally {
      setDeploying(false);
    }
  }

  async function copyContract() {
    if (!contractAddress || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(contractAddress);
    setStatus("Contract address copied.");
  }

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
      <div className="relative isolate overflow-hidden rounded-[28px] border border-amber-300/25 bg-[linear-gradient(150deg,rgba(245,158,11,0.17),rgba(124,58,237,0.16)_48%,rgba(255,255,255,0.04))] p-5 shadow-[0_20px_70px_rgba(245,158,11,0.14)] ring-1 ring-inset ring-white/10">
        <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-100">Deploy Token</p>
            <h2 className="mt-2 bg-gradient-to-r from-white via-amber-100 to-violet-100 bg-clip-text text-3xl font-black leading-tight text-transparent">ERC20 on Base</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-300">Focused ERC20 launch flow with wallet connect, Base switch, and live deploy status.</p>
          </div>
          <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-extrabold text-emerald-200">Base Mainnet</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <DeployMiniStat label="Wallet" value={shortWallet} />
          <DeployMiniStat label="Supply" value={initialSupply || "—"} />
          <DeployMiniStat label="Contract" value={shortContract} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 shadow-[0_14px_44px_rgba(0,0,0,0.30)] ring-1 ring-inset ring-white/10 backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-gray-400">Token Setup</p>
          <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-100">18 decimals</span>
        </div>
        <div className="space-y-3">
          <DeployInput label="Token Name" value={tokenName} onChange={setTokenName} placeholder="Base Token" />
          <DeployInput label="Symbol" value={tokenSymbol} onChange={(value) => setTokenSymbol(value.toUpperCase().slice(0, 12))} placeholder="BASE" />
          <DeployInput label="Initial Supply" value={initialSupply} onChange={(value) => setInitialSupply(value.replace(/\D/g, ""))} placeholder="1000000" inputMode="numeric" />
        </div>
      </div>

      <div className="rounded-2xl border border-violet-300/20 bg-[linear-gradient(160deg,rgba(124,58,237,0.10),rgba(255,255,255,0.02))] p-4 shadow-[0_14px_36px_rgba(76,29,149,0.20)] ring-1 ring-inset ring-white/10 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-violet-200">Deploy Status</p>
          <span className={`h-2 w-2 rounded-full ${deploying ? "animate-ping bg-amber-300" : contractAddress ? "bg-emerald-300" : "bg-gray-500"}`} />
        </div>
        <p className="text-sm font-semibold text-gray-300">{status}</p>
        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs font-semibold text-gray-400">
          <div className="flex justify-between gap-3"><span>Tx</span><span className="text-right text-gray-200">{shortTx}</span></div>
          <div className="flex justify-between gap-3"><span>Address</span><span className="text-right text-gray-200">{shortContract}</span></div>
        </div>
        {deployError ? <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-200">{deployError}</p> : null}
      </div>

      <button
        type="button"
        onClick={handleDeploy}
        disabled={deploying}
        className="w-full rounded-2xl border border-amber-300/35 bg-gradient-to-r from-amber-400/90 via-violet-500/85 to-fuchsia-500/80 px-4 py-3.5 text-sm font-black text-white shadow-[0_14px_40px_rgba(245,158,11,0.26)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(124,58,237,0.42)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {deploying ? "Deploying on Base..." : "Deploy ERC20 Token"}
      </button>

      {contractAddress ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={copyContract} className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-xs font-extrabold text-white transition hover:bg-white/[0.08]">Copy Address</button>
          <a href={`https://basescan.org/address/${contractAddress}`} target="_blank" rel="noreferrer" className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-center text-xs font-extrabold text-amber-100 transition hover:bg-amber-400/15">Open Basescan</a>
        </div>
      ) : null}
    </div>
  );
}

function DeployInput({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; inputMode?: "numeric" }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none ring-0 transition placeholder:text-gray-600 focus:border-amber-300/45 focus:bg-black/35 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.10)]"
      />
    </label>
  );
}

function DeployMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/12 bg-black/20 p-2.5 backdrop-blur-sm">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p className="mt-1 truncate text-[11px] font-extrabold text-white">{value}</p>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-font="sora-base-score"
      className="font-sora-base-score relative min-h-dvh w-full overflow-hidden px-4 pb-10"
      style={{
        background: "radial-gradient(1200px 500px at 50% -10%, rgba(124,58,237,0.2), transparent), linear-gradient(180deg, #090912 0%, #0a0a0f 45%, #07070b 100%)",
        fontFamily: "var(--font-sora)",
      }}
    >
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx global>{`
        @keyframes shimmerX {
          0% {
            transform: translateX(-120%);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: translateX(260%);
            opacity: 0;
          }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(124,58,237,0.14),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(245,158,11,0.08),transparent_30%)]" />
      <div className="mx-auto max-w-md pt-8">{children}</div>
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-6 text-center animate-in fade-in-0 zoom-in-95 duration-500">
      <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-amber-300/35 bg-black/55 p-1.5 shadow-[0_0_55px_rgba(245,158,11,0.28)] ring-1 ring-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/app-logo-v3.png?v=logo20260502"
          alt="Base Score gold logo"
          className="h-full w-full rounded-full object-cover drop-shadow-[0_0_22px_rgba(251,191,36,0.42)]"
        />
      </div>
      <p className="mb-2 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100">
        Onchain Reputation
      </p>
      <h1 className="bg-gradient-to-r from-white via-amber-100 to-yellow-300 bg-clip-text text-3xl font-black tracking-tight text-transparent">
        Base Wallet Score
      </h1>
      <p className="mt-1 text-sm font-semibold text-gray-400">{subtitle}</p>
    </div>
  );
}

function Metric({ label, value, delay = 0 }: { label: string; value: string; delay?: number }) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300/35 hover:shadow-[0_14px_34px_rgba(124,58,237,0.22)] animate-in fade-in-0 slide-in-from-bottom-2"
      style={{ animationDelay: `${delay}ms`, animationDuration: "500ms" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.12),transparent_45%)]" />
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">{label}</p>
      <p className="mt-1.5 text-[15px] font-extrabold text-white">{value}</p>
    </div>
  );
}

function SignalCard({ eyebrow, title, value, detail }: { eyebrow: string; title: string; value: string; detail: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-violet-300/18 bg-[linear-gradient(150deg,rgba(124,58,237,0.12),rgba(255,255,255,0.035))] p-4 shadow-[0_14px_38px_rgba(0,0,0,0.25)] ring-1 ring-inset ring-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-300/28">
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-amber-300/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200/85">{eyebrow}</p>
      <div className="relative mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-white">{title}</p>
          <p className="mt-1 text-[11px] font-semibold text-gray-400">{detail}</p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[11px] font-extrabold text-amber-100">
          {value}
        </span>
      </div>
    </div>
  );
}

function BreakRow({ label, value, max, tone = "default" }: { label: string; value: number; max: number; tone?: "default" | "danger" }) {
  const absValue = Math.abs(value);
  const pct = Math.max(0, Math.min(100, Math.round((absValue / max) * 100)));
  const barClass = tone === "danger"
    ? "h-full rounded-full bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300 transition-all duration-1000"
    : "h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-400 transition-all duration-1000";
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs text-gray-400">
        <span className="font-bold tracking-wide">{label}</span>
        <span className={`font-semibold ${tone === "danger" ? "text-rose-300" : ""}`}>
          {value < 0 ? "-" : ""}<AnimatedNumber value={absValue} duration={900} />/{max}
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={barClass}
          style={{ width: `${pct}%` }}
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white/40 to-transparent blur-[2px]" style={{ transform: `translateX(calc(${pct}% - 2.5rem))` }} />
      </div>
    </div>
  );
}

function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{displayValue.toLocaleString()}</>;
}

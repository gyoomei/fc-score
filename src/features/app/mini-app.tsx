"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { ScoreLoading } from "./components/score-loading";
import { useFarcasterUser } from "@/neynar-farcaster-sdk/mini";

type TierName = "Dormant" | "Active" | "Power" | "Whale";

type ApiResult = {
  address: string;
  chain: "base";
  txCount: number;
  walletAgeDays: number;
  activeDays30: number;
  totalVolumeEth: number;
  breakdown: {
    walletAgeScore: number;
    txCountScore: number;
    activityScore: number;
    volumeScore: number;
    totalScore: number;
  };
  tier: TierName;
};

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
  const hasAutoFetchedRef = useRef(false);

  const isValidAddress = useMemo(
    () => /^0x[a-fA-F0-9]{40}$/.test(resolvedAddress.trim()),
    [resolvedAddress],
  );

  async function fetchScore(addr: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/score/base/${addr}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal menghitung score");
      setResult(json as ApiResult);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

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
          } catch {}

          try {
            const accountsRaw = (await provider.request({
              method: "eth_requestAccounts",
            })) as unknown;
            const fromRequest = pickAddressFromUnknown(accountsRaw);
            if (fromRequest) return fromRequest;
          } catch {}
        }
      } catch {}

      return null;
    };

    void (async () => {
      const candidate = await getCandidateAddress();

      if (!candidate) {
        setError("Wallet Base tidak ditemukan dari context/verifikasi Farcaster");
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
    const text = `I got ${score} (${result.tier}) on Base Wallet Score ⚡\n${appUrl}\nCheck yours 👇`;
    const handle = (fcUser as { username?: string } | null)?.username || "base-user";
    const avatar = (fcUser as { pfpUrl?: string } | null)?.pfpUrl || "";
    const shareCardUrl =
      appUrl && result
        ? `${appUrl}/api/share-card?score=${encodeURIComponent(String(score))}&handle=${encodeURIComponent(handle)}&address=${encodeURIComponent(shortenAddress(result.address))}&tx=${encodeURIComponent(String(result.txCount))}&active=${encodeURIComponent(String(result.activeDays30))}&volume=${encodeURIComponent(String(result.totalVolumeEth))}&pfp=${encodeURIComponent(avatar)}`
        : "";

    const embeds: [] | [string] | [string, string] = shareCardUrl
      ? ([appUrl, shareCardUrl] as [string, string])
      : appUrl
        ? ([appUrl] as [string])
        : [];

    try {
      await sdk.actions.composeCast({
        text,
        embeds,
      });
    } catch {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(`${text}\n${appUrl}`.trim());
        }
      } catch {}

      if (typeof window !== "undefined") {
        const fallbackText = encodeURIComponent(`${text}\n${appUrl}`.trim());
        window.open(`https://warpcast.com/~/compose?text=${fallbackText}`, "_blank", "noopener,noreferrer");
      }

      setShareError("Compose native gagal, fallback Warpcast dibuka.");
    } finally {
      setSharing(false);
    }
  };

  const showLoading = !result && (userLoading || loading);

  if (showLoading) {
    return (
      <PageShell>
        <Header subtitle="Auto-detect wallet • analyze onchain signal" />
        <ScoreLoading />
      </PageShell>
    );
  }

  if (error && !result) {
    return (
      <PageShell>
        <Header subtitle="Auto-detect wallet • analyze onchain signal" />
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
      </PageShell>
    );
  }

  if (!isValidAddress || !result) return null;

  const shortAddress = `${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`;
  const currentTierIndex = TIER_STEPS.findIndex((item) => item.name === result.tier);

  return (
    <PageShell>
      <Header subtitle={`Wallet: ${shortAddress}`} />

      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
        <div className="group relative isolate overflow-hidden rounded-[28px] border border-white/15 bg-[linear-gradient(155deg,rgba(139,92,246,0.26),rgba(31,41,55,0.20)_45%,rgba(251,191,36,0.18))] p-6 shadow-[0_20px_80px_rgba(76,29,149,0.34)] ring-1 ring-inset ring-white/10 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_30px_95px_rgba(124,58,237,0.42)]
        ">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.25),transparent_35%)]" />
          <div className="pointer-events-none absolute -top-14 -right-10 h-36 w-36 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="pointer-events-none absolute right-6 top-6 h-2 w-2 animate-ping rounded-full bg-violet-200/80" />

          <p className="text-gray-200/90 text-[11px] font-extrabold uppercase tracking-[0.26em]">Total Score</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="bg-gradient-to-r from-white via-violet-100 to-amber-100 bg-clip-text text-6xl font-black leading-none text-transparent drop-shadow-[0_2px_22px_rgba(124,58,237,0.52)]">{result.breakdown.totalScore}</p>
            <div className="mb-1 rounded-xl border border-white/15 bg-black/20 px-3 py-1 text-right backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-300">Reputation Index</p>
              <p className="text-xs font-extrabold text-emerald-200">Verified Onchain</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-violet-100">Tier {result.tier}</p>
            <span className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">Live Base</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="Tx Count" value={result.txCount.toLocaleString()} />
          <Metric label="Wallet Age" value={`${result.walletAgeDays} days`} />
          <Metric label="Active 30d" value={`${result.activeDays30} tx`} />
          <Metric label="Volume" value={`${result.totalVolumeEth} ETH`} />
        </div>

        <div className="rounded-2xl border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 backdrop-blur-md shadow-[0_14px_44px_rgba(0,0,0,0.30)] ring-1 ring-inset ring-white/10">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-gray-400">Breakdown</p>
            <span className="text-[11px] font-semibold text-violet-200/80">Auto weighted</span>
          </div>
          <BreakRow label="Wallet Age" value={result.breakdown.walletAgeScore} max={250} />
          <BreakRow label="Tx Count" value={result.breakdown.txCountScore} max={300} />
          <BreakRow label="Activity" value={result.breakdown.activityScore} max={300} />
          <BreakRow label="Volume" value={result.breakdown.volumeScore} max={150} />
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
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full overflow-hidden px-4 pb-10" style={{ background: "radial-gradient(1200px 500px at 50% -10%, rgba(124,58,237,0.2), transparent), linear-gradient(180deg, #090912 0%, #0a0a0f 45%, #07070b 100%)" }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(124,58,237,0.14),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(245,158,11,0.08),transparent_30%)]" />
      <div className="mx-auto max-w-md pt-8">{children}</div>
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-6 text-center animate-in fade-in-0 zoom-in-95 duration-500">
      <p className="mb-2 inline-flex rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-100">
        Onchain Reputation
      </p>
      <h1 className="bg-gradient-to-r from-white via-violet-200 to-amber-200 bg-clip-text text-3xl font-black tracking-tight text-transparent">
        Base Wallet Score
      </h1>
      <p className="mt-1 text-sm font-semibold text-gray-400">{subtitle}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300/35 hover:shadow-[0_14px_34px_rgba(124,58,237,0.22)]">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.12),transparent_45%)]" />
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">{label}</p>
      <p className="mt-1.5 text-[15px] font-extrabold text-white">{value}</p>
    </div>
  );
}

function BreakRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs text-gray-400">
        <span className="font-bold tracking-wide">{label}</span>
        <span className="font-semibold">{value}/{max}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-400 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white/40 to-transparent blur-[2px]" style={{ transform: `translateX(calc(${pct}% - 2.5rem))` }} />
      </div>
    </div>
  );
}

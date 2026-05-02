"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { ScoreLoading } from "./components/score-loading";
import { useFarcasterUser } from "@/neynar-farcaster-sdk/mini";

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
  tier: "Dormant" | "Active" | "Power" | "Whale";
};

export function MiniApp() {
  const { data: fcUser, isLoading: userLoading } = useFarcasterUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string>("");
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

  const showLoading = userLoading || loading;

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

  return (
    <PageShell>
      <Header subtitle={`Wallet: ${shortAddress}`} />

      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
        <div className="relative overflow-hidden rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 via-violet-400/5 to-amber-400/15 p-5 shadow-[0_8px_40px_rgba(124,58,237,0.2)]">
          <p className="text-gray-300 text-xs uppercase tracking-[0.2em]">Total Score</p>
          <p className="mt-2 text-5xl font-black text-white">{result.breakdown.totalScore}</p>
          <p className="mt-1 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-violet-100">Tier {result.tier}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Metric label="Tx Count" value={result.txCount.toLocaleString()} />
          <Metric label="Wallet Age" value={`${result.walletAgeDays} days`} />
          <Metric label="Active 30d" value={`${result.activeDays30} tx`} />
          <Metric label="Volume" value={`${result.totalVolumeEth} ETH`} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
          <p className="mb-3 text-xs uppercase tracking-widest text-gray-500">Breakdown</p>
          <BreakRow label="Wallet Age" value={result.breakdown.walletAgeScore} max={250} />
          <BreakRow label="Tx Count" value={result.breakdown.txCountScore} max={300} />
          <BreakRow label="Activity" value={result.breakdown.activityScore} max={300} />
          <BreakRow label="Volume" value={result.breakdown.volumeScore} max={150} />
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full overflow-hidden px-4 pb-10" style={{ background: "radial-gradient(1200px 500px at 50% -10%, rgba(124,58,237,0.2), transparent), linear-gradient(180deg, #090912 0%, #0a0a0f 45%, #07070b 100%)" }}>
      <div className="mx-auto max-w-md pt-8">{children}</div>
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-2xl font-black text-white">Base Wallet Score</h1>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors duration-300 hover:bg-white/[0.06]">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function BreakRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-400 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
  dexVolume24hUsd: number;
  breakdown: {
    walletAgeScore: number;
    txCountScore: number;
    activityScore: number;
    volumeScore: number;
    marketScore: number;
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
          // 1) Silent first: in many clients this works without user gesture
          try {
            const accountsSilentRaw = (await provider.request({
              method: "eth_accounts",
            })) as unknown;
            const fromSilent = pickAddressFromUnknown(accountsSilentRaw);
            if (fromSilent) return fromSilent;
          } catch (err) {
            console.warn("eth_accounts failed", err);
          }

          // 2) Interactive fallback
          try {
            const accountsRaw = (await provider.request({
              method: "eth_requestAccounts",
            })) as unknown;
            const fromRequest = pickAddressFromUnknown(accountsRaw);
            if (fromRequest) return fromRequest;
          } catch (err) {
            console.warn("eth_requestAccounts failed", err);
          }
        }
      } catch (err) {
        console.warn("Wallet provider not available from Farcaster SDK", err);
      }

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
      <div className="relative min-h-dvh w-full overflow-hidden px-4 pb-10" style={{ background: "linear-gradient(180deg, #0a0a14 0%, #0a0a0f 40%, #08080c 100%)" }}>
        <div className="mx-auto max-w-md pt-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black text-white">Base Wallet Score</h1>
            <p className="text-gray-500 text-sm mt-1">Menghitung score wallet kamu otomatis...</p>
          </div>
          <ScoreLoading />
        </div>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="relative min-h-dvh w-full overflow-hidden px-4 pb-10" style={{ background: "linear-gradient(180deg, #0a0a14 0%, #0a0a0f 40%, #08080c 100%)" }}>
        <div className="mx-auto max-w-md pt-8">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
        </div>
      </div>
    );
  }

  if (!isValidAddress || !result) return null;

  const shortAddress = `${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`;

  return (
    <div className="relative min-h-dvh w-full overflow-hidden px-4 pb-10" style={{ background: "linear-gradient(180deg, #0a0a14 0%, #0a0a0f 40%, #08080c 100%)" }}>
      <div className="mx-auto max-w-md pt-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-white">Base Wallet Score</h1>
          <p className="text-gray-500 text-sm mt-1">Wallet: {shortAddress}</p>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-widest">Total Score</p>
            <p className="text-4xl font-black text-amber-300 mt-1">{result.breakdown.totalScore}</p>
            <p className="text-sm text-white mt-1">Tier: {result.tier}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric label="Tx Count" value={result.txCount.toLocaleString()} />
            <Metric label="Wallet Age" value={`${result.walletAgeDays} days`} />
            <Metric label="Active 30d" value={`${result.activeDays30} tx`} />
            <Metric label="Volume" value={`${result.totalVolumeEth} ETH`} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Breakdown</p>
            <BreakRow label="Wallet Age" value={result.breakdown.walletAgeScore} max={250} />
            <BreakRow label="Tx Count" value={result.breakdown.txCountScore} max={300} />
            <BreakRow label="Activity" value={result.breakdown.activityScore} max={250} />
            <BreakRow label="Volume" value={result.breakdown.volumeScore} max={150} />
            <BreakRow label="Market (DefiLlama)" value={result.breakdown.marketScore} max={50} />
            <p className="mt-3 text-xs text-gray-500">DEX 24h volume (Base): ${result.dexVolume24hUsd.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-white font-semibold text-sm mt-1">{value}</p>
    </div>
  );
}

function BreakRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#7c3aed,#c9a227)" }} />
      </div>
    </div>
  );
}

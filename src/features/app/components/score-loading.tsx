"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Syncing Farcaster wallet context",
  "Reading Base onchain transactions",
  "Scoring activity and consistency",
  "Finalizing your Base Score",
];

export function ScoreLoading() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 1100);

    return () => clearInterval(stepInterval);
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">Analyzing</p>
          <h3 className="text-base font-semibold text-white">Base Wallet Score</h3>
        </div>
        <div className="h-10 w-10 animate-pulse rounded-xl bg-gradient-to-br from-violet-400/40 to-amber-400/40" />
      </div>

      <div className="space-y-3">
        {STEPS.map((item, idx) => {
          const active = idx === step;
          const done = idx < step;

          return (
            <div
              key={item}
              className={`rounded-xl border p-3 transition-all duration-500 ${
                active
                  ? "border-violet-400/40 bg-violet-500/10 shadow-[0_0_20px_rgba(124,58,237,0.18)]"
                  : done
                    ? "border-emerald-400/30 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className={`text-sm ${active ? "text-white" : done ? "text-emerald-200" : "text-gray-400"}`}>
                  {item}
                </p>
                <span className="text-xs text-gray-400">{done ? "✓" : active ? "…" : ""}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-400 transition-all duration-700"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

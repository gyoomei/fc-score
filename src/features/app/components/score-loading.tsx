"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Reading Base transactions...",
  "Calculating wallet age...",
  "Measuring activity consistency...",
  "Computing total volume...",
  "Finalizing Base score...",
];

export function ScoreLoading() {
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 800);
    const dotsInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 400);
    return () => {
      clearInterval(stepInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6 py-16">
      {/* Animated ring placeholder */}
      <div className="relative" style={{ width: 160, height: 160 }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(201,162,39,0.15) 0%, transparent 70%)",
          }}
        />
        <svg
          width={160}
          height={160}
          className="absolute animate-spin"
          style={{ animationDuration: "2s" }}
        >
          <circle
            cx={80}
            cy={80}
            r={65}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={8}
          />
          <circle
            cx={80}
            cy={80}
            r={65}
            fill="none"
            stroke="#c9a227"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 65 * 0.25} ${2 * Math.PI * 65 * 0.75}`}
            style={{
              filter: "drop-shadow(0 0 8px #c9a227) drop-shadow(0 0 16px rgba(201,162,39,0.5))",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl">🏆</span>
        </div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-white font-semibold text-base">
          {STEPS[step]}
          {dots}
        </p>
        <p className="text-gray-600 text-sm">Analyzing your Farcaster data</p>
      </div>

      {/* Progress bar */}
      <div
        className="w-48 h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: "linear-gradient(90deg, #c9a22766, #c9a227)",
            boxShadow: "0 0 8px rgba(201,162,39,0.5)",
          }}
        />
      </div>
    </div>
  );
}

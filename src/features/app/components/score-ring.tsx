"use client";

import { useEffect, useState } from "react";
import type { Tier } from "@/features/app/types";

interface ScoreRingProps {
  score: number;
  tier: Tier;
  animated?: boolean;
}

export function ScoreRing({ score, tier, animated = true }: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const [progress, setProgress] = useState(0);

  const radius = 80;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const progressStroke = (progress / 1000) * circumference;

  useEffect(() => {
    if (!animated) return;
    const duration = 1500;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * score));
      setProgress(eased * score);
      if (t < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [score, animated]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${tier.glow} 0%, transparent 70%)`,
          opacity: 0.6,
        }}
      />

      <svg width={200} height={200} className="absolute" style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={100}
          cy={100}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={100}
          cy={100}
          r={radius}
          fill="none"
          stroke={tier.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progressStroke}
          style={{
            filter: `drop-shadow(0 0 8px ${tier.color}) drop-shadow(0 0 16px ${tier.glow})`,
            transition: "stroke 0.5s ease",
          }}
        />
      </svg>

      {/* Center content */}
      <div className="flex flex-col items-center gap-0.5 z-10">
        <span
          className="text-5xl font-black tabular-nums"
          style={{
            color: tier.color,
            textShadow: `0 0 20px ${tier.glow}`,
          }}
        >
          {displayScore}
        </span>
        <span className="text-xs text-gray-500 font-medium tracking-widest uppercase">
          / 1000
        </span>
      </div>
    </div>
  );
}

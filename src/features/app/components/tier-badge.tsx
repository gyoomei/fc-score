"use client";

import type { Tier } from "@/features/app/types";

interface TierBadgeProps {
  tier: Tier;
  size?: "sm" | "md" | "lg";
}

export function TierBadge({ tier, size = "md" }: TierBadgeProps) {
  const sizeClasses = {
    sm: "px-3 py-1 text-xs gap-1",
    md: "px-4 py-1.5 text-sm gap-1.5",
    lg: "px-5 py-2 text-base gap-2",
  };

  const emojiSize = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };

  return (
    <div
      className={`inline-flex items-center rounded-full font-bold tracking-widest uppercase ${sizeClasses[size]}`}
      style={{
        background: `linear-gradient(135deg, ${tier.color}22, ${tier.color}44)`,
        border: `1px solid ${tier.color}88`,
        color: tier.color,
        boxShadow: `0 0 12px ${tier.glow}, inset 0 0 8px ${tier.color}11`,
      }}
    >
      <span className={emojiSize[size]}>{tier.emoji}</span>
      <span>{tier.label}</span>
    </div>
  );
}

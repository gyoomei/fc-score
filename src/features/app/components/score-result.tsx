"use client";

import Image from "next/image";
import { ScoreRing } from "@/features/app/components/score-ring";
import { TierBadge } from "@/features/app/components/tier-badge";
import { StatCard } from "@/features/app/components/stat-card";
import { ShareButton } from "@/neynar-farcaster-sdk/mini";
import type { FarcasterScoreResult } from "@/features/app/types";

interface ScoreResultProps {
  result: FarcasterScoreResult;
  username: string;
  displayName: string;
  pfpUrl?: string;
  followerCount: number;
  followingCount: number;
}

export function ScoreResult({
  result,
  username,
  displayName,
  pfpUrl,
  followerCount,
  followingCount,
}: ScoreResultProps) {
  const { breakdown, tier } = result;
  const { totalScore, percentile } = breakdown;

  const statCards = [
    {
      label: "Followers",
      value: breakdown.followersScore,
      maxValue: 300,
      icon: "👥",
      color: "#3b82f6",
    },
    {
      label: "Ratio",
      value: breakdown.followingRatioScore,
      maxValue: 100,
      icon: "⚖️",
      color: "#8b5cf6",
    },
    {
      label: "Engagement",
      value: breakdown.engagementScore,
      maxValue: 200,
      icon: "💬",
      color: "#06b6d4",
    },
    {
      label: "Account Age",
      value: breakdown.accountAgeScore,
      maxValue: 200,
      icon: "📅",
      color: "#f59e0b",
    },
    {
      label: "Verified",
      value: breakdown.verificationScore,
      maxValue: 50,
      icon: "✅",
      color: "#10b981",
    },
    {
      label: "Power Badge",
      value: breakdown.powerBadgeScore,
      maxValue: 50,
      icon: "⚡",
      color: "#c9a227",
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Profile Header */}
      <div className="flex items-center gap-3 px-4 pt-4">
        {pfpUrl && (
          <div
            className="rounded-full overflow-hidden flex-shrink-0"
            style={{
              width: 48,
              height: 48,
              border: `2px solid ${tier.color}66`,
              boxShadow: `0 0 12px ${tier.glow}`,
            }}
          >
            <Image
              src={pfpUrl}
              alt={displayName}
              width={48}
              height={48}
              className="object-cover"
              unoptimized
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-base truncate">{displayName}</p>
          <p className="text-gray-500 text-sm">@{username}</p>
        </div>
        <TierBadge tier={tier} size="sm" />
      </div>

      {/* Score Ring */}
      <div className="flex flex-col items-center gap-3 px-4">
        <ScoreRing score={totalScore} tier={tier} animated />

        <div className="text-center">
          <p
            className="text-xl font-bold"
            style={{ color: tier.color }}
          >
            {tier.emoji} {tier.label}
          </p>
          <p className="text-gray-400 text-sm mt-0.5">{tier.description}</p>
        </div>

        {/* Percentile chip */}
        <div
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{
            background: "rgba(201,162,39,0.12)",
            border: "1px solid rgba(201,162,39,0.3)",
            color: "#c9a227",
          }}
        >
          <span>Top {100 - percentile}%</span>
          <span className="text-gray-500">·</span>
          <span>{followerCount.toLocaleString()} followers</span>
          <span className="text-gray-500">·</span>
          <span>{followingCount.toLocaleString()} following</span>
        </div>
      </div>

      {/* Stats Breakdown */}
      <div className="px-4">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">
          Score Breakdown
        </p>
        <div className="grid grid-cols-2 gap-2">
          {statCards.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </div>

      {/* Tier ladder */}
      <TierLadder currentTier={tier.key} currentScore={totalScore} />

      {/* Share */}
      <div className="px-4">
        <ShareButton
          text={`My Farcaster Score is ${totalScore}/1000 — ${tier.emoji} ${tier.label} tier! Check yours:`}
          queryParams={{
            score: totalScore.toString(),
            tier: tier.label,
            username,
          }}
          className="w-full h-12 text-base font-bold rounded-xl bg-[linear-gradient(135deg,#c9a227,#f59e0b)] text-black border-none"
        >
          Share My Score
        </ShareButton>
      </div>
    </div>
  );
}

function TierLadder({
  currentTier,
  currentScore,
}: {
  currentTier: string;
  currentScore: number;
}) {
  const tiers = [
    { key: "newcomer", label: "Newcomer", emoji: "🌱", min: 0 },
    { key: "explorer", label: "Explorer", emoji: "🔭", min: 200 },
    { key: "builder", label: "Builder", emoji: "⚒️", min: 400 },
    { key: "influencer", label: "Influencer", emoji: "⚡", min: 600 },
    { key: "og", label: "OG", emoji: "👑", min: 750 },
    { key: "legend", label: "Legend", emoji: "🏆", min: 900 },
  ];

  return (
    <div className="px-4">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">
        Tier Ladder
      </p>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {tiers.map((t, i) => {
          const isActive = t.key === currentTier;
          const isPast = currentScore >= t.min;
          return (
            <div
              key={t.key}
              className={`flex items-center gap-3 px-4 py-3 ${i < tiers.length - 1 ? "border-b" : ""}`}
              style={{
                borderColor: "rgba(255,255,255,0.05)",
                background: isActive
                  ? "rgba(201,162,39,0.08)"
                  : "transparent",
              }}
            >
              <span className={`text-lg ${isPast ? "" : "opacity-30"}`}>
                {t.emoji}
              </span>
              <span
                className={`flex-1 text-sm font-medium ${
                  isActive
                    ? "text-amber-400"
                    : isPast
                    ? "text-white"
                    : "text-gray-600"
                }`}
              >
                {t.label}
              </span>
              <span
                className={`text-xs ${
                  isActive
                    ? "text-amber-400 font-bold"
                    : isPast
                    ? "text-gray-500"
                    : "text-gray-700"
                }`}
              >
                {t.min}+
              </span>
              {isActive && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{
                    background: "rgba(201,162,39,0.2)",
                    color: "#c9a227",
                  }}
                >
                  YOU
                </span>
              )}
              {!isActive && isPast && (
                <span className="text-green-500 text-xs">✓</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

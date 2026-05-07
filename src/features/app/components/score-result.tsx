"use client";

import Image from "next/image";
import { ScoreRing } from "@/features/app/components/score-ring";
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
      label: "Badge",
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
      </div>

      {/* Score Ring */}
      <div className="flex flex-col items-center gap-3 px-4">
        <ScoreRing score={totalScore} tier={tier} animated />

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

      {/* Share */}
      <div className="px-4">
        <ShareButton
          text={`My Farcaster Score is ${totalScore}/1000. Check yours:`}
          queryParams={{
            score: totalScore.toString(),
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

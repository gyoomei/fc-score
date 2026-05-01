import type { Tier, ScoreBreakdown, FarcasterScoreResult } from "./types";

export const TIERS: Tier[] = [
  {
    key: "newcomer",
    label: "Newcomer",
    minScore: 0,
    maxScore: 199,
    emoji: "🌱",
    color: "#6b7280",
    gradient: "from-gray-600 to-gray-500",
    glow: "rgba(107,114,128,0.4)",
    description: "Just getting started on Farcaster",
  },
  {
    key: "explorer",
    label: "Explorer",
    minScore: 200,
    maxScore: 399,
    emoji: "🔭",
    color: "#3b82f6",
    gradient: "from-blue-600 to-blue-400",
    glow: "rgba(59,130,246,0.5)",
    description: "Exploring the Farcaster ecosystem",
  },
  {
    key: "builder",
    label: "Builder",
    minScore: 400,
    maxScore: 599,
    emoji: "⚒️",
    color: "#8b5cf6",
    gradient: "from-violet-600 to-purple-400",
    glow: "rgba(139,92,246,0.5)",
    description: "Actively building your presence",
  },
  {
    key: "influencer",
    label: "Influencer",
    minScore: 600,
    maxScore: 749,
    emoji: "⚡",
    color: "#06b6d4",
    gradient: "from-cyan-500 to-blue-400",
    glow: "rgba(6,182,212,0.5)",
    description: "Driving conversations and engagement",
  },
  {
    key: "og",
    label: "OG",
    minScore: 750,
    maxScore: 899,
    emoji: "👑",
    color: "#f59e0b",
    gradient: "from-amber-500 to-yellow-400",
    glow: "rgba(245,158,11,0.6)",
    description: "A true Farcaster original",
  },
  {
    key: "legend",
    label: "Legend",
    minScore: 900,
    maxScore: 1000,
    emoji: "🏆",
    color: "#c9a227",
    gradient: "from-yellow-400 via-amber-400 to-yellow-300",
    glow: "rgba(201,162,39,0.7)",
    description: "The pinnacle of Farcaster influence",
  },
];

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function scoreFollowers(count: number): number {
  // Log scale: 0 followers = 0, 100k+ = 300
  if (count <= 0) return 0;
  const raw = Math.log10(count + 1) / Math.log10(100000) * 300;
  return Math.round(clamp(raw, 0, 300));
}

function scoreFollowingRatio(followers: number, following: number): number {
  // Good ratio = more followers than following. Max 100 pts
  if (following === 0) return 50;
  const ratio = followers / following;
  if (ratio >= 10) return 100;
  if (ratio >= 5) return 80;
  if (ratio >= 2) return 60;
  if (ratio >= 1) return 40;
  return Math.round(clamp(ratio * 40, 0, 100));
}

function scoreAccountAge(createdAt: string | undefined): number {
  // Max 200 pts for 3+ years old
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const ageMs = now - created;
  const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365);
  if (ageYears >= 3) return 200;
  const raw = (ageYears / 3) * 200;
  return Math.round(clamp(raw, 0, 200));
}

function scoreEngagement(
  castsLikesCount: number,
  castsRepliesCount: number,
  castsRecastsCount: number,
): number {
  // Combined engagement on recent casts, max 200 pts
  const total = castsLikesCount + castsRepliesCount * 2 + castsRecastsCount * 1.5;
  if (total <= 0) return 0;
  const raw = Math.log10(total + 1) / Math.log10(5000) * 200;
  return Math.round(clamp(raw, 0, 200));
}

function scoreVerification(
  verifications: string[],
  powerBadge: boolean,
): { verificationScore: number; powerBadgeScore: number } {
  const verificationScore = verifications.length > 0 ? 50 : 0;
  const powerBadgeScore = powerBadge ? 50 : 0;
  return { verificationScore, powerBadgeScore };
}

export function getTierForScore(score: number): Tier {
  // Start from highest
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (score >= TIERS[i].minScore) return TIERS[i];
  }
  return TIERS[0];
}

export function calculateScore(params: {
  followerCount: number;
  followingCount: number;
  createdAt?: string;
  verifications: string[];
  powerBadge: boolean;
  castsLikesCount: number;
  castsRepliesCount: number;
  castsRecastsCount: number;
}): FarcasterScoreResult {
  const {
    followerCount,
    followingCount,
    createdAt,
    verifications,
    powerBadge,
    castsLikesCount,
    castsRepliesCount,
    castsRecastsCount,
  } = params;

  const followersScore = scoreFollowers(followerCount);
  const followingRatioScore = scoreFollowingRatio(followerCount, followingCount);
  const accountAgeScore = scoreAccountAge(createdAt);
  const engagementScore = scoreEngagement(
    castsLikesCount,
    castsRepliesCount,
    castsRecastsCount,
  );
  const { verificationScore, powerBadgeScore } = scoreVerification(
    verifications,
    powerBadge,
  );

  const totalRaw =
    followersScore +
    followingRatioScore +
    accountAgeScore +
    engagementScore +
    verificationScore +
    powerBadgeScore;

  // Max possible: 300+100+200+200+50+50 = 900 base
  // We cap at 1000 for legend
  const totalScore = clamp(Math.round(totalRaw), 0, 1000);

  // Percentile rough estimate based on score
  const percentile = Math.round((totalScore / 1000) * 100);

  const breakdown: ScoreBreakdown = {
    followersScore,
    followingRatioScore,
    engagementScore,
    accountAgeScore,
    verificationScore,
    powerBadgeScore,
    totalScore,
    percentile,
  };

  const tier = getTierForScore(totalScore);

  return { breakdown, tier };
}

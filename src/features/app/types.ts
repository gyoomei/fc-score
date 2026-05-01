export type TierKey =
  | "newcomer"
  | "explorer"
  | "builder"
  | "influencer"
  | "og"
  | "legend";

export interface Tier {
  key: TierKey;
  label: string;
  minScore: number;
  maxScore: number;
  emoji: string;
  color: string;
  gradient: string;
  glow: string;
  description: string;
}

export interface ScoreBreakdown {
  followersScore: number;
  followingRatioScore: number;
  engagementScore: number;
  accountAgeScore: number;
  verificationScore: number;
  powerBadgeScore: number;
  totalScore: number;
  percentile: number;
}

export interface FarcasterScoreResult {
  breakdown: ScoreBreakdown;
  tier: Tier;
}

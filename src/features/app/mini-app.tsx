"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useFarcasterUser } from "@/neynar-farcaster-sdk/mini";
import { useUser } from "@/neynar-web-sdk/neynar";
import { useCastsByUser } from "@/neynar-web-sdk/neynar";
import { calculateScore } from "./score-calculator";
import { ScoreResult } from "./components/score-result";
import { ScoreLoading } from "./components/score-loading";
import { ScoreRevealParticles } from "./components/score-reveal-particles";

export function MiniApp() {
  const { data: fcUser } = useFarcasterUser();
  const fid = fcUser?.fid;

  const [particlesActive, setParticlesActive] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const prevScoreRef = useRef<number | null>(null);

  const {
    data: user,
    isLoading: userLoading,
    error: userError,
  } = useUser(fid ?? 0, { x_neynar_experimental: true }, { enabled: !!fid });

  const {
    data: castsData,
    isLoading: castsLoading,
    error: castsError,
  } = useCastsByUser(
    fid ?? 0,
    { limit: 50, include_replies: true },
    { enabled: !!fid },
  );

  const hasFarcasterContext = Boolean(fid);
  const isLoading = !hasFarcasterContext || userLoading || castsLoading;
  const hasDataError = Boolean(userError || castsError);

  const scoreResult = useMemo(() => {
    if (!user) return null;

    const casts = castsData?.pages.flatMap((p) => p.items) ?? [];

    let totalLikes = 0;
    let totalReplies = 0;
    let totalRecasts = 0;

    for (const cast of casts) {
      const reactions = (cast as unknown as {
        reactions?: { likes_count?: number; recasts_count?: number };
        replies?: { count?: number };
      }).reactions;
      const replies = (cast as unknown as {
        reactions?: { likes_count?: number; recasts_count?: number };
        replies?: { count?: number };
      }).replies;

      totalLikes += reactions?.likes_count ?? 0;
      totalReplies += replies?.count ?? 0;
      totalRecasts += reactions?.recasts_count ?? 0;
    }

    return calculateScore({
      followerCount: user.follower_count,
      followingCount: user.following_count,
      createdAt: undefined, // Neynar user doesn't expose createdAt directly
      verifications: user.verifications ?? [],
      powerBadge: user.power_badge ?? false,
      castsLikesCount: totalLikes,
      castsRepliesCount: totalReplies,
      castsRecastsCount: totalRecasts,
    });
  }, [user, castsData]);

  // Fire particles exactly once when score first appears
  useEffect(() => {
    if (!scoreResult) return;
    const score = scoreResult.breakdown.totalScore;
    if (prevScoreRef.current === null && score > 0) {
      prevScoreRef.current = score;
      // Small delay so the result card has time to mount first
      setTimeout(() => {
        setRevealed(true);
        setParticlesActive(true);
        // Turn off after 3s so it doesn't re-fire
        setTimeout(() => setParticlesActive(false), 3000);
      }, 300);
    }
  }, [scoreResult]);

  return (
    <div
      className="relative min-h-dvh w-full overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0a0a14 0%, #0a0a0f 40%, #08080c 100%)",
      }}
    >
      {/* Particle canvas — fills entire screen, fires on reveal */}
      <ScoreRevealParticles
        active={particlesActive}
        tierColor={scoreResult?.tier.color ?? "#c9a227"}
      />

      {/* Top gradient accent */}
      <div
        className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.15) 0%, transparent 100%)",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center pt-8 pb-4 px-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🏆</span>
          <h1
            className="text-2xl font-black tracking-tight"
            style={{
              background: "linear-gradient(135deg, #ffffff 30%, #c9a227 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            FC Score
          </h1>
        </div>
        <p className="text-gray-500 text-xs tracking-widest uppercase">
          Your Farcaster Power
        </p>
      </div>

      {/* Content */}
      <div
        className="relative z-10"
        style={{
          opacity: revealed || isLoading || !scoreResult ? 1 : 0,
          transform:
            revealed || isLoading || !scoreResult
              ? "translateY(0) scale(1)"
              : "translateY(24px) scale(0.97)",
          transition: "opacity 0.55s cubic-bezier(0.34,1.56,0.64,1), transform 0.55s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {isLoading ? (
          <ScoreLoading />
        ) : hasFarcasterContext && scoreResult && user ? (
          <ScoreResult
            result={scoreResult}
            username={user.username}
            displayName={user.display_name ?? user.username}
            pfpUrl={user.pfp_url}
            followerCount={user.follower_count}
            followingCount={user.following_count}
          />
        ) : hasFarcasterContext && hasDataError ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <span className="text-5xl">⚠️</span>
            <p className="text-white font-semibold text-lg">Data score belum bisa diambil</p>
            <p className="text-gray-500 text-sm">
              App sudah terbuka di Farcaster, tapi API score error. Cek `NEYNAR_API_KEY` di Vercel env.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <span className="text-5xl">🔌</span>
            <p className="text-white font-semibold text-lg">
              Sign in to Farcaster
            </p>
            <p className="text-gray-500 text-sm">
              Open this app inside a Farcaster client to see your score
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

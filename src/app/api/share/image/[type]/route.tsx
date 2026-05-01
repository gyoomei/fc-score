import { NextRequest } from "next/server";
import { publicConfig } from "@/config/public-config";
import {
  getShareImageResponse,
  parseNextRequestSearchParams,
} from "@/neynar-farcaster-sdk/nextjs";

// Cache for 1 hour - query strings create separate cache entries
export const revalidate = 3600;

const { appEnv, heroImageUrl, imageUrl } = publicConfig;

const showDevWarning = appEnv !== "production";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;

  const searchParams = parseNextRequestSearchParams(request);
  const score = searchParams.score ?? "0";
  const tier = searchParams.tier ?? "";
  const username = searchParams.username ?? "";
  const personalize = searchParams.personalize === "true";

  return getShareImageResponse(
    { type, heroImageUrl, imageUrl, showDevWarning, personalize },
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0f",
        position: "relative",
      }}
    >
      {/* FC Score branding - top right */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 40,
          right: 48,
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: "bold",
            color: "rgba(201,162,39,0.85)",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          FC Score
        </div>
      </div>

      {/* Purple-to-blue gradient glow behind score */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 340,
          height: 340,
          borderRadius: "50%",
          backgroundImage:
            "radial-gradient(circle, rgba(139,92,246,0.45) 0%, rgba(59,130,246,0.25) 55%, transparent 80%)",
          transform: "translate(-50%, -55%)",
          filter: "blur(18px)",
        }}
      />

      {/* Main content - centered */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          gap: 0,
        }}
      >
        {/* Tier label */}
        {tier ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {tier}
          </div>
        ) : null}

        {/* Score number */}
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: "bold",
            color: "#c9a227",
            letterSpacing: -4,
            lineHeight: 1,
            textShadow: "0 0 60px rgba(201,162,39,0.5), 0 0 20px rgba(201,162,39,0.3)",
          }}
        >
          {parseInt(score).toLocaleString()}
        </div>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            width: 180,
            height: 2,
            backgroundImage:
              "linear-gradient(90deg, transparent 0%, rgba(201,162,39,0.6) 50%, transparent 100%)",
            marginTop: 20,
            marginBottom: 20,
          }}
        />

        {/* Username */}
        {username ? (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: 1,
            }}
          >
            @{username}
          </div>
        ) : null}
      </div>
    </div>,
  );
}

import { ImageResponse } from "next/og";

export const runtime = "edge";

const monographFontPromise = fetch(new URL("./monograph-Regular.ttf?v=upload-20260502", import.meta.url)).then((res) => res.arrayBuffer());

function clampScore(input: number): number {
  if (Number.isNaN(input)) return 0;
  return Math.max(0, Math.min(1000, Math.round(input)));
}

function tierFromScore(score: number): "Dormant" | "Active" | "Power" | "Whale" {
  if (score >= 850) return "Whale";
  if (score >= 650) return "Power";
  if (score >= 350) return "Active";
  return "Dormant";
}

function nextTierInfo(score: number): { label: string; progressPct: number } {
  if (score >= 850) return { label: "Max tier reached", progressPct: 100 };
  if (score >= 650) {
    const pct = Math.max(0, Math.min(100, ((score - 650) / 200) * 100));
    return { label: `To Whale: ${850 - score} pts`, progressPct: pct };
  }
  if (score >= 350) {
    const pct = Math.max(0, Math.min(100, ((score - 350) / 300) * 100));
    return { label: `To Power: ${650 - score} pts`, progressPct: pct };
  }
  const pct = Math.max(0, Math.min(100, (score / 350) * 100));
  return { label: `To Active: ${350 - score} pts`, progressPct: pct };
}

function safeText(input: string, fallback: string, maxLen = 32): string {
  const value = (input || "").trim();
  if (!value) return fallback;
  return value.slice(0, maxLen);
}

function safeImageUrl(input: string): string {
  const value = (input || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return "";
}

function tierTheme(tier: string): {
  cardBackground: string;
  glowA: string;
  glowB: string;
  scoreGradient: string;
  tierBorder: string;
} {
  switch (tier) {
    case "Whale":
      return {
        cardBackground: "linear-gradient(145deg, rgba(56,26,92,0.78), rgba(46,92,86,0.72))",
        glowA: "rgba(45,212,191,0.30)",
        glowB: "rgba(251,191,36,0.24)",
        scoreGradient: "linear-gradient(90deg, #F8FAFC 0%, #A7F3D0 45%, #FDE68A 100%)",
        tierBorder: "rgba(45,212,191,0.55)",
      };
    case "Power":
      return {
        cardBackground: "linear-gradient(145deg, rgba(36,22,80,0.8), rgba(89,38,120,0.72))",
        glowA: "rgba(168,85,247,0.34)",
        glowB: "rgba(251,191,36,0.20)",
        scoreGradient: "linear-gradient(90deg, #FFFFFF 0%, #DDD6FE 52%, #FDE68A 100%)",
        tierBorder: "rgba(167,139,250,0.5)",
      };
    case "Active":
      return {
        cardBackground: "linear-gradient(145deg, rgba(21,28,72,0.8), rgba(28,66,107,0.7))",
        glowA: "rgba(96,165,250,0.28)",
        glowB: "rgba(59,130,246,0.24)",
        scoreGradient: "linear-gradient(90deg, #FFFFFF 0%, #BFDBFE 55%, #93C5FD 100%)",
        tierBorder: "rgba(96,165,250,0.45)",
      };
    default:
      return {
        cardBackground: "linear-gradient(145deg, rgba(35,35,48,0.82), rgba(58,58,77,0.68))",
        glowA: "rgba(163,163,163,0.22)",
        glowB: "rgba(148,163,184,0.18)",
        scoreGradient: "linear-gradient(90deg, #F8FAFC 0%, #E2E8F0 52%, #CBD5E1 100%)",
        tierBorder: "rgba(203,213,225,0.42)",
      };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const monographFont = await monographFontPromise;

  const score = clampScore(Number(searchParams.get("score") || 0));
  const tier = tierFromScore(score);
  const handle = safeText(searchParams.get("handle") || "", "@base-user", 32);
  const address = safeText(searchParams.get("address") || "", "0x••••••••", 42);
  const tx = Math.max(0, Number(searchParams.get("tx") || 0));
  const activeDays = Math.max(0, Number(searchParams.get("active") || 0));
  const volume = Math.max(0, Number(searchParams.get("volume") || 0));
  const pfp = safeImageUrl(searchParams.get("pfp") || "");
  const theme = tierTheme(tier);
  const tierProgress = nextTierInfo(score);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "800px",
          display: "flex",
          position: "relative",
          background: theme.cardBackground,
          color: "white",
          padding: "56px",
          fontFamily: "Monograph, Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            display: "flex",
            inset: 0,
            background:
              `radial-gradient(circle at 20% 20%, ${theme.glowA}, transparent 42%), radial-gradient(circle at 82% 16%, ${theme.glowB}, transparent 35%)`,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            borderRadius: "28px",
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.05)",
            padding: "46px",
            boxShadow: "0 30px 80px rgba(124,58,237,0.35)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: "24px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(196,181,253,0.95)",
                  fontWeight: 700,
                }}
              >
                Base Wallet Score
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "78px",
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "#F8FAFC",
                  textShadow: `0 0 28px ${theme.glowB}`,
                }}
              >
                {score}
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: "26px",
                    fontWeight: 700,
                    border: `1px solid ${theme.tierBorder}`,
                    borderRadius: "999px",
                    padding: "8px 18px",
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  Tier {tier}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: "18px",
                    fontWeight: 700,
                    border: "1px solid rgba(16,185,129,0.35)",
                    borderRadius: "999px",
                    padding: "8px 16px",
                    color: "#A7F3D0",
                    background: "rgba(16,185,129,0.12)",
                  }}
                >
                  Live Base
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {pfp ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pfp}
                  alt="pfp"
                  width={84}
                  height={84}
                  style={{
                    borderRadius: "999px",
                    border: "2px solid rgba(255,255,255,0.35)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                    objectFit: "cover",
                  }}
                />
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
                <div style={{ display: "flex", fontSize: "30px", fontWeight: 800 }}>{handle.startsWith("@") ? handle : `@${handle}`}</div>
                <div style={{ display: "flex", fontSize: "18px", opacity: 0.9 }}>{address}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", fontSize: "14px", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(209,213,219,0.9)" }}>
                  Tier Progress
                </div>
                <div style={{ display: "flex", fontSize: "14px", color: "#D1FAE5", fontWeight: 700 }}>{tierProgress.label}</div>
              </div>
              <div style={{ display: "flex", height: "10px", borderRadius: "999px", background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    width: `${tierProgress.progressPct}%`,
                    height: "100%",
                    borderRadius: "999px",
                    background: "linear-gradient(90deg, #34D399 0%, #A78BFA 55%, #FBBF24 100%)",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "18px" }}>
              {[
                { label: "Tx Count", value: tx.toLocaleString() },
                { label: "Active 30D", value: `${activeDays}` },
                { label: "Volume ETH", value: `${volume}` },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    flex: 1,
                    borderRadius: "16px",
                    padding: "18px 20px",
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", fontSize: "16px", color: "rgba(209,213,219,0.9)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {item.label}
                  </div>
                  <div style={{ display: "flex", fontSize: "36px", fontWeight: 800 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
      fonts: [
        {
          name: "Monograph",
          data: monographFont,
          style: "normal",
          weight: 400,
        },
      ],
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    },
  );
}

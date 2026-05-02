import { ImageResponse } from "next/og";

export const runtime = "edge";

function clampScore(input: number): number {
  if (Number.isNaN(input)) return 0;
  return Math.max(0, Math.min(1000, Math.round(input)));
}

function safeTier(input: string): string {
  const tier = input.trim();
  if (["Dormant", "Active", "Power", "Whale"].includes(tier)) return tier;
  return "Active";
}

function safeText(input: string, fallback: string, maxLen = 32): string {
  const value = (input || "").trim();
  if (!value) return fallback;
  return value.slice(0, maxLen);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const score = clampScore(Number(searchParams.get("score") || 0));
  const tier = safeTier(searchParams.get("tier") || "Active");
  const handle = safeText(searchParams.get("handle") || "", "@base-user", 32);
  const address = safeText(searchParams.get("address") || "", "0x••••••••", 42);
  const tx = Math.max(0, Number(searchParams.get("tx") || 0));
  const activeDays = Math.max(0, Number(searchParams.get("active") || 0));
  const volume = Math.max(0, Number(searchParams.get("volume") || 0));

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "800px",
          display: "flex",
          position: "relative",
          background: "linear-gradient(140deg, #080913 0%, #110A24 50%, #1D0F33 100%)",
          color: "white",
          padding: "56px",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 20% 20%, rgba(168,85,247,0.28), transparent 42%), radial-gradient(circle at 82% 16%, rgba(251,191,36,0.22), transparent 35%)",
          }}
        />

        <div
          style={{
            zIndex: 1,
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
                  fontSize: "24px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(196,181,253,0.95)",
                  fontWeight: 700,
                }}
              >
                Base Wallet Score
              </div>
              <div style={{ fontSize: "78px", fontWeight: 900, lineHeight: 1 }}>{score}</div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div
                  style={{
                    fontSize: "26px",
                    fontWeight: 700,
                    border: "1px solid rgba(255,255,255,0.25)",
                    borderRadius: "999px",
                    padding: "8px 18px",
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  Tier {tier}
                </div>
                <div
                  style={{
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

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
              <div style={{ fontSize: "30px", fontWeight: 800 }}>{handle.startsWith("@") ? handle : `@${handle}`}</div>
              <div style={{ fontSize: "18px", opacity: 0.9 }}>{address}</div>
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
                <div style={{ fontSize: "16px", color: "rgba(209,213,219,0.9)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "36px", fontWeight: 800 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    },
  );
}

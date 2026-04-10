import { ImageResponse } from "next/og";

export const alt = "Costify — control financiar pentru contabili romani";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0B1514",
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(13,107,94,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(52,211,160,0.12) 0%, transparent 50%)",
          padding: "80px 90px",
          fontFamily: "system-ui",
          color: "#E9E8E3",
        }}
      >
        {/* Top row: wordmark + tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#E9E8E3",
              display: "flex",
            }}
          >
            costify
            <span style={{ color: "#34D3A0" }}>.</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid rgba(52,211,160,0.3)",
              backgroundColor: "rgba(52,211,160,0.08)",
              fontSize: 18,
              fontWeight: 600,
              color: "#34D3A0",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: "#34D3A0",
              }}
            />
            costify.ro
          </div>
        </div>

        {/* Main headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              color: "#E9E8E3",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div>Vezi unde se duce</div>
            <div>
              <span style={{ color: "rgba(233,232,227,0.4)" }}>fiecare </span>
              <span
                style={{
                  color: "#34D3A0",
                  fontStyle: "italic",
                }}
              >
                leu
              </span>
              <span>.</span>
            </div>
          </div>

          <div
            style={{
              fontSize: 26,
              color: "rgba(212,208,196,0.85)",
              lineHeight: 1.4,
              maxWidth: 960,
              letterSpacing: "-0.01em",
              display: "flex",
            }}
          >
            Control financiar pentru contabili romani. Saga, SmartBill, Ciel — balanta, CPP si KPI in timp real.
          </div>
        </div>

        {/* Bottom meta row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: 30,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            fontSize: 18,
            color: "rgba(212,208,196,0.7)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontFamily: "monospace",
          }}
        >
          <div style={{ display: "flex" }}>OMFP 1802 · Registru jurnal · Audit complet</div>
          <div style={{ display: "flex" }}>Costi AI integrat</div>
        </div>
      </div>
    ),
    { ...size }
  );
}

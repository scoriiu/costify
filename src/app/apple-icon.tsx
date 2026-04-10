import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0D6B5E",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            fontSize: 150,
            fontWeight: 400,
            color: "#E9E8E3",
            letterSpacing: "-8px",
            display: "flex",
            marginTop: 10,
          }}
        >
          c<span style={{ fontWeight: 700 }}>.</span>
        </div>
      </div>
    ),
    { ...size }
  );
}

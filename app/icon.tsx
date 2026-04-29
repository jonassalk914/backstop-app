import { ImageResponse } from "next/og";

// 192x192 PWA icon — Backstop's chalk-yellow diamond on a near-black field.
// Generated at build/request time so we don't ship a binary asset.
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "55%",
            height: "55%",
            background: "#d4ff00",
            transform: "rotate(45deg)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}

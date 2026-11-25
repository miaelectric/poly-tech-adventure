import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "폴리의 테크 모험",
  description: "스마트 물류 컨베이어를 질주하는 테크토닉 아케이드 게임 — Poly's Tech Adventure",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B1120",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
        <div className="rotate-hint" role="alert">
          <span style={{ fontSize: 40 }}>📱↻</span>
          화면을 세로로 돌려 주세요
        </div>
      </body>
    </html>
  );
}

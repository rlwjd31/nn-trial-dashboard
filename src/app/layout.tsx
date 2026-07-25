import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Today's Trials",
  description: "Sales 팀 내부용 오늘의 Trial 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* h-full: 껍데기를 뷰포트 높이에 고정한다 — 페이지가 아니라 표 안쪽이 스크롤된다
          (표 헤더 sticky 가 붙을 스크롤 컨테이너를 표 영역으로 만들기 위함) */}
      <body className="flex h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

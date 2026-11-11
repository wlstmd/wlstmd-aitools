import type { Metadata } from "next";
import Link from "next/link";
import { MarkIcon } from "@/components/Icons";
import "./globals.css";

export const metadata: Metadata = {
  title: "데일리 AI",
  description: "프롬프트, 챗봇, 메모를 한 곳에서",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body>
        <header className="app-header">
          <div className="app-header-inner">
            <Link href="/" className="app-header-brand">
              <span className="app-mark"><MarkIcon /></span>
              <h1>데일리 AI</h1>
            </Link>
            <nav className="app-nav">
              <Link href="/">오늘</Link>
              <Link href="/schedule">일정</Link>
              <Link href="/prompts">프롬프트</Link>
              <Link href="/memos">메모</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

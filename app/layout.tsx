import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeAgent — AI Code Review",
  description: "Instant AI-powered code review, optimization, and refactoring.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="noise-overlay antialiased">
        {children}
      </body>
    </html>
  );
}

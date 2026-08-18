import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Agent Vault — Multi-Agent Workspace with Obsidian Memory",
  description:
    "A team of AI agents that work, remember, and deliver — memory lives in an Obsidian-compatible markdown vault you own.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} h-screen overflow-hidden`}>
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 min-w-0 flex flex-col h-full">{children}</main>
        </div>
      </body>
    </html>
  );
}

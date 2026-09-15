import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "DUET — Dual-arm Execution from Everyday Talk",
  description:
    "Speak a dinner-table instruction and watch two simulated SO-101 arms plan, hand off, and execute it. Deterministic planner, real Speechmatics transcription, measured across randomized seeds.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#05070d] text-slate-200 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

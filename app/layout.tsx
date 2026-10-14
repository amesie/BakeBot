import type { Metadata, Viewport } from "next";
import { Chango, Poppins } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "KD Pops · Handmade cake pops",
  description: "Order handmade cake pops from KD Pops for collection at school.",
};

export const viewport: Viewport = {
  themeColor: "#3b2a20",
};

// Self-hosted by next/font (no request to Google at runtime). Only the weights
// the design uses, Latin subset only, to stay inside the 500 KB budget.
const display = Chango({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Poppins({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--font-body", display: "swap" });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-ZA" className={`${display.variable} ${body.variable}`}>
      <body className="antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/print.css";

const plexMono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Consolas", "Liberation Mono", "monospace"],
  display: "swap",
});

const plexSans = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/ibm-plex-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  fallback: ["system-ui", "sans-serif"],
  display: "swap",
});

export const metadata: Metadata = {
  // Neutral titles only — no portfolio content in browser tabs (spec/02).
  title: { default: "oPortfolio", template: "%s — oPortfolio" },
  description: "Learning portfolio for the NHS Fellowship in Clinical AI",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const bodyFont = cookieStore.get("body-font")?.value === "sans" ? "sans" : "mono";
  return (
    <html lang="en-GB" data-body-font={bodyFont} className={`${plexMono.variable} ${plexSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}

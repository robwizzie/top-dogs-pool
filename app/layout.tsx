import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TEAM_NAME, TEAM_TAGLINE } from "@/lib/config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${TEAM_NAME} — APA Pool`,
    template: `%s · ${TEAM_NAME}`,
  },
  description: `${TEAM_NAME} — ${TEAM_TAGLINE}. Roster, schedule, stats, sweeps leaderboard, and match clips, all live.`,
  openGraph: {
    title: `${TEAM_NAME} — APA Pool`,
    description: `${TEAM_NAME} — ${TEAM_TAGLINE}.`,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: "/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070707" },
    { media: "(prefers-color-scheme: light)", color: "#f8f3e3" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${bebas.variable}`}>
        <ThemeProvider>
          <SiteHeader />
          <main className="pb-20 md:pb-0">{children}</main>
          <SiteFooter />
          <MobileTabBar />
        </ThemeProvider>
      </body>
    </html>
  );
}

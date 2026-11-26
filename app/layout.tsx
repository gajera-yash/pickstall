import { Suspense } from "react";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

import { CookieNotice } from "@/components/legal/cookie-notice";
import { PlatformAnalytics } from "@/components/analytics/platform-analytics";
import { APP_NAME } from "@/lib/config";
import { ONE_LINER, SITE_URL } from "@/lib/seo/site-facts";

import "./globals.css";

// Self-hosted by next/font, no layout shift. Both are variable fonts, so one file serves
// every weight. Bricolage keeps its optical-size axis (DESIGN.md 4.1).
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bricolage",
  display: "swap",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: APP_NAME,
  description: ONE_LINER,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/pickstall.jpg", type: "image/jpeg" },
    ],
    shortcut: "/brand/pickstall.jpg",
    apple: "/brand/pickstall.jpg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // White theme only (D-025): data-theme="light" stops the OS dark mode from switching the tokens.
    <html lang="en" data-theme="light" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <CookieNotice />
        {/* usePathname() is request data on dynamic routes, so the tag loader sits behind a boundary. */}
        <Suspense fallback={null}>
          <PlatformAnalytics />
        </Suspense>
      </body>
    </html>
  );
}

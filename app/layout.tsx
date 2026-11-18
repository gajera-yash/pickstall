import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

import { CookieNotice } from "@/components/legal/cookie-notice";
import { APP_NAME } from "@/lib/config";

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
  title: APP_NAME,
  description: "Storefront, digital products and courses for creators.",
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
      </body>
    </html>
  );
}

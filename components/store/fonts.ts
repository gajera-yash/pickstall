import { Fraunces } from "next/font/google";

// The serif for store themes that ask for it (displayFont "serif", D-062). Self-hosted by
// next/font like the app's own fonts; not preloaded, so stores on other themes never fetch it.
export const storeSerif = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-store-serif",
  display: "swap",
  preload: false,
});

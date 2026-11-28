import type { ReactNode } from "react";

import { POST_IMAGE_THEMES } from "@/lib/brand-colors";
import { APP_NAME, TRIAL_DAYS } from "@/lib/config";
import { CONTENT_PILLAR_LABELS, type ContentPillar } from "@/lib/marketing/content/rules";
import { PRICES } from "@/lib/seo/site-facts";

// The drawings of the daily post images (D-136), for next/og (Satori): flexbox only, inline SVG for
// icons and patterns, no HTML from posts (text is drawn as text). Two looks on alternating days.

export type PostTheme = (typeof POST_IMAGE_THEMES)[keyof typeof POST_IMAGE_THEMES];

// Simple stroke icons (24 x 24), one per pillar, plus a check mark.
const ICONS: Record<ContentPillar | "check" | "arrow", ReactNode[]> = {
  tips: [<path key="a" d="M9 18h6" />, <path key="b" d="M10 22h4" />, <path key="c" d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />],
  feature: [<path key="a" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />, <path key="b" d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" />],
  build: [<path key="a" d="M3 3v18h18" />, <path key="b" d="M8 16v-4" />, <path key="c" d="M13 16V8" />, <path key="d" d="M18 16V5" />],
  fees: [<path key="a" d="M19 5L5 19" />, <circle key="b" cx="6.5" cy="6.5" r="2.5" />, <circle key="c" cx="17.5" cy="17.5" r="2.5" />],
  story: [<path key="a" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />],
  check: [<path key="a" d="M20 6L9 17l-5-5" />],
  arrow: [<path key="a" d="M5 12h14" />, <path key="b" d="M13 6l6 6-6 6" />],
};

function Icon({ name, size, color }: { name: keyof typeof ICONS; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

type Place = { top?: number; left?: number; right?: number; bottom?: number };

/** Only the sides that are set: Satori fails on style values that are undefined. */
function place({ top, left, right, bottom }: Place): Record<string, number> {
  return Object.fromEntries(Object.entries({ top, left, right, bottom }).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
}

/** A soft dot grid, for texture in a corner. */
function Dots({ color, cols, rows, gap, top, left, right, bottom }: { color: string; cols: number; rows: number; gap: number; top?: number; left?: number; right?: number; bottom?: number }) {
  const circles: ReactNode[] = [];
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < cols; x += 1) circles.push(<circle key={`${x}-${y}`} cx={x * gap + 4} cy={y * gap + 4} r={4} fill={color} />);
  return (
    <svg width={cols * gap} height={rows * gap} style={{ position: "absolute", ...place({ top, left, right, bottom }) }}>
      {circles}
    </svg>
  );
}

function Blob({ size, color, top, left, right, bottom }: { size: number; color: string; top?: number; left?: number; right?: number; bottom?: number }) {
  return <div style={{ position: "absolute", width: size, height: size, borderRadius: size, background: color, ...place({ top, left, right, bottom }) }} />;
}

function Brand({ logo, size, theme }: { logo: string; size: number; theme: PostTheme }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size / 3 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img elements */}
      <img src={logo} width={size} height={size} alt="" style={{ borderRadius: size / 4.5, border: `4px solid ${theme.screen}` }} />
      <div style={{ display: "flex", fontSize: size * 0.58, fontWeight: 700, color: theme.ink }}>{APP_NAME}</div>
    </div>
  );
}

function Pill({ children, background, color, size }: { children: ReactNode; background: string; color: string; size: number }) {
  return <div style={{ display: "flex", alignItems: "center", gap: size * 0.4, fontSize: size, fontWeight: 700, background, color, padding: `${size * 0.45}px ${size * 0.9}px`, borderRadius: 999 }}>{children}</div>;
}

function PillarChip({ pillar, theme, size }: { pillar: ContentPillar; theme: PostTheme; size: number }) {
  return (
    <Pill background={theme.accent} color={theme.onAccent} size={size}>
      <Icon name={pillar} size={size * 1.3} color={theme.onAccent} />
      <div style={{ display: "flex", letterSpacing: 2 }}>{CONTENT_PILLAR_LABELS[pillar].toUpperCase()}</div>
    </Pill>
  );
}

/** A phone showing a little link-in-bio store: the product, drawn. */
function Phone({ logo, theme, width }: { logo: string; theme: PostTheme; width: number }) {
  const u = width / 100;
  const card = (thumb: string, key: string) => (
    <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 * u, background: theme.card, borderRadius: 5 * u, padding: 3.5 * u, width: "100%" }}>
      <div style={{ display: "flex", width: 15 * u, height: 15 * u, borderRadius: 3.5 * u, background: thumb }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2.5 * u, flex: 1 }}>
        <div style={{ display: "flex", height: 3.2 * u, width: "85%", borderRadius: 3 * u, background: theme.cardLine }} />
        <div style={{ display: "flex", height: 3.2 * u, width: "50%", borderRadius: 3 * u, background: theme.cardLine }} />
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", width, height: width * 1.9, background: theme.phone, borderRadius: 16 * u, padding: 3.5 * u, boxShadow: theme.phoneShadow }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4.5 * u, width: "100%", height: "100%", background: theme.screen, borderRadius: 12.5 * u, padding: `${9 * u}px ${6 * u}px` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img elements */}
        <img src={logo} width={22 * u} height={22 * u} alt="" style={{ borderRadius: 22 * u }} />
        <div style={{ display: "flex", height: 4 * u, width: "55%", borderRadius: 4 * u, background: POST_IMAGE_THEMES.white.ink }} />
        <div style={{ display: "flex", height: 3 * u, width: "40%", borderRadius: 3 * u, background: theme.cardLine }} />
        {card(POST_IMAGE_THEMES.white.accent, "a")}
        {card(POST_IMAGE_THEMES.white.highlight, "b")}
        {card(POST_IMAGE_THEMES.blue.shape, "c")}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: 11 * u, borderRadius: 11 * u, background: POST_IMAGE_THEMES.white.accent, color: POST_IMAGE_THEMES.white.onAccent, fontSize: 5 * u, fontWeight: 700 }}>
          Buy now
        </div>
      </div>
    </div>
  );
}

const frame = (theme: PostTheme, padding: string) =>
  ({ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", padding, background: theme.background, backgroundImage: theme.backgroundImage, color: theme.ink, fontFamily: "sans-serif", overflow: "hidden" }) as const;

type Common = { theme: PostTheme; logo: string; pillar: ContentPillar };

/** Carousel cover (1080 x 1350): pillar chip, big headline, a phone with a store, swipe cue. */
export function PortraitCover({ theme, logo, pillar, headline }: Common & { headline: string }) {
  return (
    <div style={frame(theme, "76px 80px")}>
      <Blob size={620} color={theme.shape} top={-220} right={-220} />
      <Blob size={260} color={theme.shapeSoft} bottom={120} left={-110} />
      <Dots color={theme.dots} cols={6} rows={4} gap={34} top={300} right={64} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Brand logo={logo} size={84} theme={theme} />
      </div>
      <div style={{ display: "flex", marginTop: 70 }}>
        <PillarChip pillar={pillar} theme={theme} size={28} />
      </div>
      <div style={{ display: "flex", marginTop: 36, fontSize: 100, fontWeight: 700, lineHeight: 1.05, maxWidth: 920, letterSpacing: -2.5 }}>{headline}</div>
      <div style={{ position: "absolute", right: 70, bottom: -150, display: "flex", transform: "rotate(-8deg)" }}>
        <Phone logo={logo} theme={theme} width={400} />
      </div>
      <div style={{ position: "absolute", left: 80, bottom: 80, display: "flex", flexDirection: "column", gap: 22 }}>
        <Pill background={theme.highlight} color={theme.onHighlight} size={32}>
          Swipe
          <Icon name="arrow" size={36} color={theme.onHighlight} />
        </Pill>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: theme.accent === POST_IMAGE_THEMES.blue.accent ? theme.ink : theme.accent }}>pickstall.store</div>
      </div>
    </div>
  );
}

/** One point of the carousel: a big number, the point, a check badge and progress bars. */
export function PortraitPoint({ theme, logo, pillar, text, index, total }: Common & { text: string; index: number; total: number }) {
  return (
    <div style={frame(theme, "76px 80px")}>
      <Blob size={460} color={theme.shape} bottom={-160} right={-140} />
      <div style={{ position: "absolute", top: 120, right: -40, display: "flex", fontSize: 620, fontWeight: 700, lineHeight: 1, letterSpacing: -30, color: theme.shape }}>{String(index).padStart(2, "0")}</div>
      <Dots color={theme.dots} cols={5} rows={5} gap={34} bottom={110} left={70} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Brand logo={logo} size={68} theme={theme} />
        <Pill background={theme.accent} color={theme.onAccent} size={26}>
          <Icon name={pillar} size={32} color={theme.onAccent} />
          {`${index}/${total}`}
        </Pill>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 150, height: 150, borderRadius: 40, background: theme.accent, color: theme.onAccent, fontSize: 84, fontWeight: 700 }}>
            {String(index).padStart(2, "0")}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 74, height: 74, borderRadius: 74, background: theme.highlight }}>
            <Icon name="check" size={44} color={theme.onHighlight} />
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 70, fontWeight: 700, lineHeight: 1.18, letterSpacing: -1 }}>{text}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{ display: "flex", width: i + 1 === index ? 64 : 22, height: 22, borderRadius: 22, background: i + 1 === index ? theme.highlight : theme.dots }} />
          ))}
        </div>
        <Pill background={theme.highlight} color={theme.onHighlight} size={28}>
          Save this
        </Pill>
      </div>
    </div>
  );
}

/** The closing card: what Pickstall is, the honest fee line, the trial, and the phone. */
export function PortraitClosing({ theme, logo }: Omit<Common, "pillar">) {
  return (
    <div style={frame(theme, "76px 80px")}>
      <Blob size={700} color={theme.shape} bottom={-300} right={-260} />
      <Dots color={theme.dots} cols={6} rows={3} gap={34} top={90} right={70} />
      <Brand logo={logo} size={84} theme={theme} />
      <div style={{ display: "flex", marginTop: 70, fontSize: 78, fontWeight: 700, lineHeight: 1.1, maxWidth: 880, letterSpacing: -1.5 }}>Sell digital products, courses and coaching from one link</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 44, maxWidth: 560 }}>
        {["0% transaction fees. PayPal's processing fees still apply.", `Plans from $${PRICES.starter}/month`, `${TRIAL_DAYS}-day free trial, no card needed`].map((line) => (
          <div key={line} style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, color: theme.mute }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 48, background: theme.highlight, flexShrink: 0 }}>
              <Icon name="check" size={28} color={theme.onHighlight} />
            </div>
            {line}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", right: 90, bottom: -120, display: "flex", transform: "rotate(6deg)" }}>
        <Phone logo={logo} theme={theme} width={320} />
      </div>
      <div style={{ position: "absolute", left: 80, bottom: 80, display: "flex" }}>
        <Pill background={theme.accent} color={theme.onAccent} size={36}>
          Link in bio
          <Icon name="arrow" size={40} color={theme.onAccent} />
        </Pill>
      </div>
    </div>
  );
}

/** One wide cover (1280 x 720) for X and the YouTube thumbnail. */
export function WideCover({ theme, logo, pillar, headline }: Common & { headline: string }) {
  return (
    <div style={frame(theme, "56px 64px")}>
      <Blob size={560} color={theme.shape} top={-120} right={-60} />
      <Dots color={theme.dots} cols={4} rows={6} gap={30} bottom={40} left={560} />
      <Brand logo={logo} size={60} theme={theme} />
      <div style={{ display: "flex", marginTop: 34 }}>
        <PillarChip pillar={pillar} theme={theme} size={22} />
      </div>
      <div style={{ display: "flex", marginTop: 24, fontSize: 62, fontWeight: 700, lineHeight: 1.1, maxWidth: 760, letterSpacing: -1 }}>{headline}</div>
      <div style={{ position: "absolute", left: 64, bottom: 52, display: "flex", alignItems: "center", gap: 20 }}>
        <Pill background={theme.highlight} color={theme.onHighlight} size={24}>{`Plans from $${PRICES.starter}/month`}</Pill>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: theme.ink }}>pickstall.store</div>
      </div>
      <div style={{ position: "absolute", right: 110, top: 70, display: "flex", transform: "rotate(-7deg)" }}>
        <Phone logo={logo} theme={theme} width={290} />
      </div>
    </div>
  );
}

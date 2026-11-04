// YouTube and Vimeo lesson videos (D-055). Only the video id (and Vimeo's privacy hash) is kept;
// the embed URL is always rebuilt here from that id, so a creator can never put an arbitrary URL
// into a student's page. Client-safe.

export type LinkedVideo = { kind: "youtube"; id: string } | { kind: "vimeo"; id: string; hash: string | null };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/i;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

/** The YouTube or Vimeo video a pasted link points to, or null when it is not one. */
export function parseVideoLink(raw: string): LinkedVideo | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return youtube(parts[0]);
  if (YOUTUBE_HOSTS.has(host)) {
    if (parts[0] === "watch") return youtube(url.searchParams.get("v") ?? undefined);
    if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") return youtube(parts[1]);
    return null;
  }
  if (VIMEO_HOSTS.has(host)) {
    // vimeo.com/123456789, vimeo.com/123456789/abcdef1234 (unlisted), player.vimeo.com/video/123456789?h=abcdef1234
    const [id, hash] = host === "player.vimeo.com" ? (parts[0] === "video" ? [parts[1], url.searchParams.get("h") ?? undefined] : []) : [parts[0], parts[1]];
    if (!id || !VIMEO_ID.test(id)) return null;
    return { kind: "vimeo", id, hash: hash && VIMEO_HASH.test(hash) ? hash.toLowerCase() : null };
  }
  return null;
}

function youtube(id: string | undefined): LinkedVideo | null {
  return id && YOUTUBE_ID.test(id) ? { kind: "youtube", id } : null;
}

/** The player URL for a linked video, built only from its checked id. */
export function embedUrlFor(video: LinkedVideo): string {
  if (video.kind === "youtube") {
    if (!YOUTUBE_ID.test(video.id)) throw new Error("Invalid YouTube id.");
    return `https://www.youtube-nocookie.com/embed/${video.id}?rel=0`;
  }
  if (!VIMEO_ID.test(video.id)) throw new Error("Invalid Vimeo id.");
  return `https://player.vimeo.com/video/${video.id}${video.hash && VIMEO_HASH.test(video.hash) ? `?h=${video.hash}` : ""}`;
}

/** A link to show back in the editor for a linked video. */
export function watchUrlFor(video: LinkedVideo): string {
  return video.kind === "youtube" ? `https://www.youtube.com/watch?v=${video.id}` : `https://vimeo.com/${video.id}${video.hash ? `/${video.hash}` : ""}`;
}

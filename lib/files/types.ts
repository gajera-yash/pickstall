// What product files a creator may upload (D-050, PRD F3b). A file must have an allowed extension
// AND its first bytes must match that type, so a renamed .exe or .html is refused. The type we
// store and send comes from this table, never from the browser.

/** A product's file as the editor shows it (D-050). */
export type ProductFileInfo = { id: string; name: string; size: number; label: string };

type FileKind = { mime: string; label: string; matches: (head: Uint8Array) => boolean };

const startsWith = (head: Uint8Array, bytes: number[], offset = 0) => bytes.every((byte, i) => head[offset + i] === byte);
const ZIP = (head: Uint8Array) => startsWith(head, [0x50, 0x4b, 0x03, 0x04]);
/** Plain text: no NUL bytes in the first bytes (CSV). */
const TEXT = (head: Uint8Array) => head.length > 0 && !head.includes(0);

export const PRODUCT_FILE_TYPES: Record<string, FileKind> = {
  pdf: { mime: "application/pdf", label: "PDF", matches: (head) => startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  zip: { mime: "application/zip", label: "ZIP", matches: ZIP },
  epub: { mime: "application/epub+zip", label: "EPUB", matches: ZIP },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word", matches: ZIP },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel", matches: ZIP },
  csv: { mime: "text/csv", label: "CSV", matches: TEXT },
  png: { mime: "image/png", label: "PNG", matches: (head) => startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  jpg: { mime: "image/jpeg", label: "JPG", matches: (head) => startsWith(head, [0xff, 0xd8, 0xff]) },
  jpeg: { mime: "image/jpeg", label: "JPG", matches: (head) => startsWith(head, [0xff, 0xd8, 0xff]) },
  // ID3 tag, or an MPEG audio frame (11 sync bits set).
  mp3: { mime: "audio/mpeg", label: "MP3", matches: (head) => startsWith(head, [0x49, 0x44, 0x33]) || (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0) },
  // ISO media: "ftyp" at byte 4.
  mp4: { mime: "video/mp4", label: "MP4", matches: (head) => startsWith(head, [0x66, 0x74, 0x79, 0x70], 4) },
};

/** How many leading bytes the checks need. */
export const FILE_HEAD_BYTES = 16;

/** For the file picker's `accept` and for messages. */
export const PRODUCT_FILE_ACCEPT = Object.keys(PRODUCT_FILE_TYPES).map((ext) => `.${ext}`).join(",");
export const PRODUCT_FILE_LABELS = [...new Set(Object.values(PRODUCT_FILE_TYPES).map((kind) => kind.label))].join(", ");

export function extensionOf(name: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim());
  return match ? (match[1] as string).toLowerCase() : "";
}

/** The file's type when the name and the bytes agree on an allowed one, else null. */
export function detectFileType(name: string, head: Uint8Array): { ext: string; mime: string } | null {
  const ext = extensionOf(name);
  const kind = PRODUCT_FILE_TYPES[ext];
  if (!kind || !kind.matches(head)) return null;
  return { ext, mime: kind.mime };
}

/**
 * A safe name to show and to download as: no path, no control or reserved characters, at most
 * 120 characters, and always the detected extension.
 */
export function cleanFileName(raw: string, ext: string): string {
  const base = (raw.split(/[\\/]/).pop() ?? "")
    .replace(/\.[A-Za-z0-9]{1,8}$/, "")
    .replace(/[\u0000-\u001f\u007f<>:"|?*%]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
  return `${base || "download"}.${ext}`;
}

/** Content-Disposition for a download, with a plain ASCII fallback and the UTF-8 name (RFC 6266). */
export function attachmentHeader(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** "12.4 MB" style sizes for the editor. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

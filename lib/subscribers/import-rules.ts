import { z } from "zod";

import { cleanText } from "@/lib/products/text";

// Subscriber CSV import (D-100). Pure and client-safe: the browser parses the file for the preview
// and sends only the mapped email and name columns; the server checks every row again.

/** Most rows one import takes. */
export const IMPORT_MAX_ROWS = 10_000;
/** Largest CSV file the browser reads. */
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_NAME_MAX = 80;

/**
 * Parses CSV text (RFC 4180: commas, double-quoted cells with "" escapes, CRLF or LF). A UTF-8 BOM
 * is dropped. Empty lines are skipped. Stops after `maxRows` data rows plus the header.
 */
export function parseCsv(text: string, maxRows = IMPORT_MAX_ROWS + 1): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const pushRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
    cell = "";
  };
  for (let i = 0; i < input.length && rows.length < maxRows; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      pushRow();
    } else cell += ch;
  }
  if (rows.length < maxRows && (cell !== "" || row.length > 0)) pushRow();
  return rows;
}

/** The column that most likely holds emails or names, by its header. -1 when none matches. */
export function guessColumn(header: string[], kind: "email" | "name"): number {
  const names = header.map((value) => value.trim().toLowerCase());
  const wanted = kind === "email" ? [/^e-?mail( address)?$/, /e-?mail/] : [/^(full )?name$/, /^first name$/, /name/];
  for (const pattern of wanted) {
    const index = names.findIndex((name) => pattern.test(name) && (kind === "name" ? !/e-?mail/.test(name) : true));
    if (index !== -1) return index;
  }
  return -1;
}

const email = z.email().max(254);

/** One row as the server accepts it, or null: a valid email, and a cleaned, short name. */
export function cleanImportRow(raw: { email: unknown; name: unknown }): { email: string; name: string | null } | null {
  if (typeof raw.email !== "string") return null;
  const value = raw.email.trim();
  if (!email.safeParse(value).success) return null;
  const name = typeof raw.name === "string" ? cleanText(raw.name).replace(/\s+/g, " ").slice(0, IMPORT_NAME_MAX) : "";
  return { email: value, name: name || null };
}

/** What the browser sends: the mapped rows, the file name and the creator's consent confirmation. */
export const importPayload = z.object({
  fileName: z.string().max(200),
  consent: z.literal(true, { error: "Confirm that these people agreed to get emails from you." }),
  rows: z.array(z.object({ email: z.unknown(), name: z.unknown() })).min(1, { error: "The file has no rows to import." }).max(IMPORT_MAX_ROWS, { error: `Import up to ${IMPORT_MAX_ROWS.toLocaleString("en")} people at a time.` }),
});

/** The consent words saved with every imported person: the creator's own confirmation. */
export function importConsentText(fileName: string, at: Date): string {
  const clean = cleanText(fileName).replace(/\s+/g, " ").slice(0, 80) || "a CSV file";
  return `Imported by the creator from ${clean} on ${at.toISOString().slice(0, 10)}. The creator confirmed these people agreed to get their emails.`;
}

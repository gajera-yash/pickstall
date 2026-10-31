// CSV export helpers (D-014): spreadsheet formulas from buyers' text are neutralized, and every
// cell is quoted so commas, quotes and line breaks cannot break a row.

const FORMULA_START = /^[=+\-@\t\r]/;

/** Makes a text cell safe to open in a spreadsheet: a leading = + - @ tab or CR gets a ' in front. */
export function neutralizeFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : typeof value === "number" ? String(value) : neutralizeFormula(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  // The BOM lets Excel read UTF-8 names correctly.
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** Escapes text for use inside a regular expression, so a search box can never be a regex. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

"use client";

import { FileUp } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useRef, useState, useTransition } from "react";

import { Field } from "@/components/dashboard/editor-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { callAction } from "@/lib/action-call";
import { importLeadsAction } from "@/lib/marketing/lead-actions";
import {
  LEAD_FIELDS,
  LEAD_FIELD_LABELS,
  LEAD_IMPORT_CHUNK,
  LEAD_IMPORT_MAX_FILE_BYTES,
  LEAD_IMPORT_MAX_ROWS,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  cleanLeadRow,
  guessLeadColumns,
  stageGuess,
  statusKey,
  type LeadField,
  type LeadStage,
} from "@/lib/marketing/leads-rules";
import { parseCsv } from "@/lib/subscribers/import-rules";

type Parsed = { fileName: string; header: string[]; rows: string[][] };
type Message = { kind: "success" | "error"; text: string } | null;

const NONE = "-1";
const MAX_STATUS_VALUES = 100;

/**
 * Import the founder's creator list (D-120): pick a CSV, check which column is which (guessed from
 * the headers), say which stage each "Status" word means, then import in parts of 1,000 rows. Only
 * the mapped columns are sent; the server cleans every row again.
 */
export function LeadImport() {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [columns, setColumns] = useState<Record<LeadField, number> | null>(null);
  const [stageMap, setStageMap] = useState<Record<string, LeadStage>>({});
  const [message, setMessage] = useState<Message>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const statusValues = useMemo(() => {
    if (!parsed || !columns || columns.status < 0) return [];
    const seen = new Map<string, string>();
    for (const row of parsed.rows) {
      const raw = row[columns.status] ?? "";
      const key = statusKey(raw);
      if (key && !seen.has(key)) seen.set(key, raw.trim());
      if (seen.size > MAX_STATUS_VALUES) break;
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [parsed, columns]);

  const mapped = (row: string[]) => Object.fromEntries(LEAD_FIELDS.map((field) => [field, columns && columns[field] >= 0 ? (row[columns[field]] ?? "") : undefined])) as Partial<Record<LeadField, string>>;

  const preview = useMemo(() => {
    if (!parsed || !columns || columns.handle < 0) return { valid: 0, rows: [] as ReturnType<typeof cleanLeadRow>[] };
    const stageFor = (status: string) => stageMap[status.toLowerCase()] ?? stageGuess(status);
    let valid = 0;
    const rows: ReturnType<typeof cleanLeadRow>[] = [];
    parsed.rows.forEach((row, index) => {
      const clean = cleanLeadRow(mapped(row), stageFor);
      if (clean) valid += 1;
      if (index < 5) rows.push(clean);
    });
    return { valid, rows };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `mapped` only reads `columns`
  }, [parsed, columns, stageMap]);

  const pick = async (file: File | undefined) => {
    setMessage(null);
    setParsed(null);
    setColumns(null);
    if (!file) return;
    if (file.size > LEAD_IMPORT_MAX_FILE_BYTES) {
      setMessage({ kind: "error", text: `Use a CSV under ${LEAD_IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB.` });
      return;
    }
    const [header, ...rows] = parseCsv(await file.text(), LEAD_IMPORT_MAX_ROWS + 1);
    if (!header || rows.length === 0) {
      setMessage({ kind: "error", text: "That file has no rows. Use a CSV with a header row (in Google Sheets: File, Download, Comma-separated values)." });
      return;
    }
    const guessed = guessLeadColumns(header);
    setParsed({ fileName: file.name, header, rows: rows.slice(0, LEAD_IMPORT_MAX_ROWS) });
    setColumns(guessed);
    const statuses = new Map<string, LeadStage>();
    if (guessed.status >= 0) for (const row of rows) {
      const key = statusKey(row[guessed.status] ?? "");
      if (key && !statuses.has(key)) statuses.set(key, stageGuess(key));
    }
    setStageMap(Object.fromEntries(statuses));
  };

  const run = () =>
    start(async () => {
      if (!parsed || !columns || columns.handle < 0) return;
      setMessage(null);
      const rows = parsed.rows.map(mapped);
      const statusMap = Object.fromEntries(statusValues.map(({ key }) => [key, stageMap[key] ?? stageGuess(key)]));
      const total = { added: 0, existing: 0, suppressed: 0, invalid: 0, failed: 0, invalidRows: [] as number[] };
      for (let i = 0; i < rows.length; i += LEAD_IMPORT_CHUNK) {
        setProgress(`Importing rows ${i + 1} to ${Math.min(i + LEAD_IMPORT_CHUNK, rows.length)} of ${rows.length}...`);
        const result = await callAction(() => importLeadsAction({ fileName: parsed.fileName, firstRow: i + 2, statusMap, rows: rows.slice(i, i + LEAD_IMPORT_CHUNK) }));
        if (!result.ok) {
          setProgress(null);
          setMessage({ kind: "error", text: total.added ? `${total.added} added, then: ${result.error}` : result.error });
          return;
        }
        total.added += result.data.added;
        total.existing += result.data.existing;
        total.suppressed += result.data.suppressed;
        total.invalid += result.data.invalid;
        total.failed += result.data.failed;
        total.invalidRows.push(...result.data.invalidRows);
      }
      setProgress(null);
      const skipped = [
        total.existing ? `${total.existing} already in the list` : "",
        total.suppressed ? `${total.suppressed} deleted or marked do not contact before` : "",
        total.invalid ? `${total.invalid} without a valid handle (${total.invalidRows.length === 1 ? "row" : "rows"} ${total.invalidRows.slice(0, 20).join(", ")}${total.invalid > 20 ? ", ..." : ""})` : "",
        total.failed ? `${total.failed} could not be saved (try the file again)` : "",
      ]
        .filter(Boolean)
        .join("; ");
      setMessage({ kind: "success", text: `${total.added.toLocaleString("en")} leads added.${skipped ? ` Skipped: ${skipped}.` : ""}` });
      setParsed(null);
      setColumns(null);
      if (input.current) input.current.value = "";
    });

  const columnOptions = parsed ? [{ value: NONE, label: "Not in the file" }, ...parsed.header.map((name, index) => ({ value: String(index), label: name.trim() || `Column ${index + 1}` }))] : [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
        <p className="text-sm text-mute">
          In Google Sheets: File, Download, Comma-separated values (.csv). Up to {LEAD_IMPORT_MAX_ROWS.toLocaleString("en")} rows. The only column you must have is the creator&apos;s handle. Creators already in the list are not changed.
        </p>
        <input ref={input} id={inputId} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void pick(event.target.files?.[0])} />
        <Button type="button" variant="secondary" className="self-start" onClick={() => input.current?.click()} disabled={pending}>
          <FileUp aria-hidden="true" className="size-4" />
          {parsed ? "Choose another file" : "Choose a CSV file"}
        </Button>
      </section>

      {parsed && columns && (
        <>
          <section aria-labelledby="columns-title" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
            <div className="flex flex-col gap-1">
              <h2 id="columns-title" className="font-display text-h4">
                Which column is which
              </h2>
              <p className="text-sm text-mute">
                {parsed.fileName}: {parsed.rows.length.toLocaleString("en")} rows. We guessed from your headers; change any that are wrong.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {LEAD_FIELDS.map((field) => (
                <Field key={field} id={`lead-col-${field}`} label={field === "handle" ? `${LEAD_FIELD_LABELS[field]} (required)` : LEAD_FIELD_LABELS[field]} error={field === "handle" && columns.handle < 0 ? "Pick the column with handles." : null}>
                  <ChoiceSelect id={`lead-col-${field}`} value={String(columns[field])} onValueChange={(value) => setColumns({ ...columns, [field]: Number(value) })} options={columnOptions} />
                </Field>
              ))}
            </div>
          </section>

          {statusValues.length > 0 && (
            <section aria-labelledby="status-title" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
              <div className="flex flex-col gap-1">
                <h2 id="status-title" className="font-display text-h4">
                  What each status means
                </h2>
                <p className="text-sm text-mute">Each word from your Status column becomes a stage here. Empty status means New.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {statusValues.map(({ key, label }) => (
                  <Field key={key} id={`lead-status-${key}`} label={`"${label}"`}>
                    <ChoiceSelect id={`lead-status-${key}`} value={stageMap[key] ?? stageGuess(key)} onValueChange={(value) => setStageMap({ ...stageMap, [key]: value as LeadStage })} options={LEAD_STAGES.map((value) => ({ value, label: LEAD_STAGE_LABELS[value] }))} />
                  </Field>
                ))}
              </div>
            </section>
          )}

          {columns.handle >= 0 && (
            <section aria-labelledby="preview-title" className="flex flex-col gap-3">
              <h2 id="preview-title" className="font-display text-h4">
                Preview
              </h2>
              <p className="text-sm text-mute">
                {preview.valid.toLocaleString("en")} of {parsed.rows.length.toLocaleString("en")} rows have a valid handle. First 5 rows as they will be saved:
              </p>
              <div className="overflow-x-auto rounded-md border border-line bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Handle</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead className="text-right">Followers</TableHead>
                      <TableHead>Tool</TableHead>
                      <TableHead>Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row, index) => (
                      <TableRow key={index}>
                        {row ? (
                          <>
                            <TableCell className="max-w-48 truncate font-semibold">@{row.handle}</TableCell>
                            <TableCell className="max-w-48 truncate">{row.name ?? "-"}</TableCell>
                            <TableCell>{row.platform}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.followers?.toLocaleString("en") ?? "-"}</TableCell>
                            <TableCell className="max-w-40 truncate">{row.toolLabel ?? row.tool}</TableCell>
                            <TableCell>{LEAD_STAGE_LABELS[row.stage]}</TableCell>
                          </>
                        ) : (
                          <TableCell colSpan={6} className="text-danger">
                            Row {index + 2}: no valid handle, will be skipped
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          <div className="flex flex-col items-end gap-2">
            <Button type="button" onClick={run} loading={pending} disabled={columns.handle < 0 || preview.valid === 0}>
              Import {preview.valid.toLocaleString("en")} {preview.valid === 1 ? "lead" : "leads"}
            </Button>
            {progress && (
              <p role="status" className="text-sm text-mute">
                {progress}
              </p>
            )}
          </div>
        </>
      )}

      {message && (
        <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>
            {message.text}{" "}
            {message.kind === "success" && (
              <Link href="/admin/growth" className="font-semibold underline underline-offset-4">
                See the leads
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

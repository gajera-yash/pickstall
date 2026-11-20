"use client";

import { FileUp, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { Field } from "@/components/dashboard/editor-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importSubscribersAction } from "@/lib/subscribers/actions";
import { IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROWS, guessColumn, parseCsv } from "@/lib/subscribers/import-rules";

type Parsed = { fileName: string; header: string[]; rows: string[][] };

const CHUNK = 2000;

/**
 * Import a subscriber list from a CSV (D-100): pick a file, choose the email and name columns with
 * a preview of the first rows, confirm consent, import. Only the two mapped columns are sent.
 */
export function SubscriberImport() {
  const router = useRouter();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [emailColumn, setEmailColumn] = useState(-1);
  const [nameColumn, setNameColumn] = useState(-1);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const pick = async (file: File | undefined) => {
    setMessage(null);
    setParsed(null);
    if (!file) return;
    if (file.size > IMPORT_MAX_FILE_BYTES) {
      setMessage({ kind: "error", text: `Use a CSV under ${IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB.` });
      return;
    }
    const all = parseCsv(await file.text());
    const [header, ...rows] = all;
    if (!header || rows.length === 0) {
      setMessage({ kind: "error", text: "That file has no rows. Use a CSV with a header row, like email,name." });
      return;
    }
    setParsed({ fileName: file.name, header, rows: rows.slice(0, IMPORT_MAX_ROWS) });
    setEmailColumn(guessColumn(header, "email"));
    setNameColumn(guessColumn(header, "name"));
    setConsent(false);
  };

  const run = () =>
    start(async () => {
      if (!parsed || emailColumn < 0) return;
      const rows = parsed.rows.map((row) => ({ email: row[emailColumn] ?? "", name: nameColumn >= 0 ? (row[nameColumn] ?? "") : "" }));
      // In parts, so each request stays well under the server's 1 MB request limit.
      const total = { added: 0, existing: 0, invalid: 0, overLimit: 0 };
      for (let i = 0; i < rows.length; i += CHUNK) {
        const result = await importSubscribersAction({ fileName: parsed.fileName, consent, rows: rows.slice(i, i + CHUNK) });
        if (!result.ok) {
          setMessage({ kind: "error", text: total.added ? `${total.added} added, then: ${result.error}` : result.error });
          router.refresh();
          return;
        }
        total.added += result.data.added;
        total.existing += result.data.existing;
        total.invalid += result.data.invalid;
        total.overLimit += result.data.overLimit;
      }
      const { added, existing, invalid, overLimit } = total;
      const skipped = [existing ? `${existing} already on your list` : "", invalid ? `${invalid} without a valid email` : "", overLimit ? `${overLimit} over your plan's limit` : ""].filter(Boolean).join(", ");
      setMessage({ kind: "success", text: `${added.toLocaleString("en")} added.${skipped ? ` Skipped: ${skipped}.` : ""}` });
      setParsed(null);
      if (input.current) input.current.value = "";
      router.refresh();
    });

  return (
    <section aria-labelledby="import-title" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="import-title" className="flex items-center gap-2 font-display text-h4">
          <Upload aria-hidden="true" className="size-4 text-blue" />
          Import a list
        </h2>
        <p className="text-sm text-mute">Bring your subscribers from Stan, Gumroad, Mailchimp or anywhere else as a CSV file with an email column.</p>
      </div>

      <input ref={input} id={inputId} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void pick(event.target.files?.[0])} />
      <Button type="button" variant="secondary" className="self-start" onClick={() => input.current?.click()}>
        <FileUp aria-hidden="true" className="size-4" />
        {parsed ? "Choose another file" : "Choose a CSV file"}
      </Button>

      {parsed && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-mute">
            {parsed.fileName}: {parsed.rows.length.toLocaleString("en")} rows
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="import-email" label="Email column" error={emailColumn < 0 ? "Pick the column with email addresses." : null}>
              <ChoiceSelect id="import-email" value={String(emailColumn)} onValueChange={(value) => setEmailColumn(Number(value))} options={[{ value: "-1", label: "Pick a column" }, ...parsed.header.map((name, index) => ({ value: String(index), label: name || `Column ${index + 1}` }))]} />
            </Field>
            <Field id="import-name" label="Name column (optional)">
              <ChoiceSelect id="import-name" value={String(nameColumn)} onValueChange={(value) => setNameColumn(Number(value))} options={[{ value: "-1", label: "No name" }, ...parsed.header.map((name, index) => ({ value: String(index), label: name || `Column ${index + 1}` }))]} />
            </Field>
          </div>

          {emailColumn >= 0 && (
            <div className="overflow-x-auto rounded-md border border-line">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.rows.slice(0, 5).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="max-w-64 truncate">{row[emailColumn]}</TableCell>
                      <TableCell className="max-w-48 truncate text-mute">{nameColumn >= 0 ? row[nameColumn] : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Checkbox id="import-consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" />
            <label htmlFor="import-consent" className="text-sm">
              These people agreed to get emails from me. (We save this with each person. People already on your list, or who unsubscribed, are not changed.)
            </label>
          </div>

          <Button type="button" className="self-end" onClick={run} loading={pending} disabled={emailColumn < 0 || !consent}>
            Import {parsed.rows.length.toLocaleString("en")} {parsed.rows.length === 1 ? "person" : "people"}
          </Button>
        </div>
      )}

      {message && (
        <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

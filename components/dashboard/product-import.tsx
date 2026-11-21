"use client";

import { CheckCircle2, Download, FileUp, ImageIcon, KeyRound, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";

import { Field } from "@/components/dashboard/editor-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Input } from "@/components/ui/input";
import { importCsvAction, importGumroadAction, previewGumroadAction, type GumroadPreview } from "@/lib/imports/actions";
import { IMPORT_PRODUCTS_MAX, guessProductColumn } from "@/lib/imports/rules";
import { formatMoney } from "@/lib/products/money";
import { parseCsv } from "@/lib/subscribers/import-rules";
import { cn } from "@/lib/utils";

type Source = "gumroad" | "csv";
type Done = { added: number; skipped: number; limit: boolean; invalid?: number };

const COLUMN_LABELS = { title: "Title column", price: "Price column", description: "Description column" } as const;

const TEMPLATE = "title,price,description\nInstagram Growth Guide,19,\"A 40-page guide to growing on Instagram.\"\nContent Calendar,9.99,Plan a month of posts in an hour.\n";

/**
 * Products > Import: bring products from Gumroad (with the creator's own access token) or from a
 * CSV (Stan Store has no export). Everything is imported as drafts without a file or link; the
 * creator adds the delivery and publishes.
 */
export function ProductImport({ currency, productsHref = "/dashboard/products" }: { currency: string; productsHref?: string }) {
  const [source, setSource] = useState<Source>("gumroad");
  const [done, setDone] = useState<Done | null>(null);

  if (done) return <ImportDone done={done} productsHref={productsHref} onAgain={() => setDone(null)} />;

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Import from" className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { id: "gumroad", title: "Gumroad", body: "Connect with an access token and pick products.", icon: ShoppingBag },
            { id: "csv", title: "Stan Store or a CSV", body: "Stan has no export: list your products in a sheet.", icon: FileUp },
          ] as const
        ).map(({ id, title, body, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={source === id}
            onClick={() => setSource(id)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors duration-(--dur-fast) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow",
              source === id ? "border-blue bg-blue-soft" : "border-line bg-surface hover:bg-bg-subtle",
            )}
          >
            <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", source === id ? "bg-blue text-on-blue" : "bg-bg-subtle text-mute")}>
              <Icon className="size-5" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{title}</span>
              <span className="text-sm text-mute">{body}</span>
            </span>
          </button>
        ))}
      </div>

      <Alert variant="info">
        <AlertTitle>What gets imported</AlertTitle>
        <AlertDescription>Title, description, price{source === "gumroad" ? " and cover image" : ""}, as drafts. Files can&apos;t be copied from other platforms: open each draft, add its file or link, and publish.</AlertDescription>
      </Alert>

      {source === "gumroad" ? <GumroadImport currency={currency} onDone={setDone} /> : <CsvImport currency={currency} onDone={setDone} />}
    </div>
  );
}

function GumroadImport({ currency, onDone }: { currency: string; onDone: (done: Done) => void }) {
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState<GumroadPreview["items"] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      setError(null);
      const result = await previewGumroadAction(token);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result.data.items);
      setPicked(new Set(result.data.items.filter((item) => !item.skipReason).map((item) => item.externalId)));
    });

  const run = () =>
    start(async () => {
      setError(null);
      const result = await importGumroadAction(token, [...picked]);
      if (!result.ok) setError(result.error);
      else onDone(result.data);
    });

  return (
    <Card className="gap-5">
      {!preview ? (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-h3">Connect Gumroad</h2>
            <p className="text-sm text-mute">Your token is used once to read your products. Pickstall doesn&apos;t keep it.</p>
          </div>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-mute">
            <li>In Gumroad, open Settings, then Advanced, and create an application (any name, redirect URL can be your store link).</li>
            <li>On the application page, click &ldquo;Generate access token&rdquo; and copy it.</li>
            <li>Paste it below.</li>
          </ol>
          <Field id="gumroad-token" label="Gumroad access token" error={error} hint="Looks like a long string of letters and numbers.">
            <Input id="gumroad-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} className="font-mono" aria-invalid={error ? true : undefined} />
          </Field>
          <Button type="button" className="self-start" onClick={load} loading={pending} disabled={token.trim().length < 20}>
            <KeyRound aria-hidden="true" className="size-4" />
            Show my Gumroad products
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-h3">Your Gumroad products</h2>
              <p className="text-sm text-mute">
                {preview.length} found. Choose what to bring over (up to {IMPORT_PRODUCTS_MAX}).
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(null)}>
              Use another token
            </Button>
          </div>
          {preview.length === 0 ? (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-mute">No products on that Gumroad account.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {preview.map((item) => {
                const disabled = item.skipReason !== null;
                const checked = picked.has(item.externalId);
                return (
                  <li key={item.externalId}>
                    <label className={cn("flex items-start gap-3 px-4 py-3", disabled ? "opacity-60" : "cursor-pointer hover:bg-bg-subtle")}>
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        className="mt-1"
                        onCheckedChange={(value) =>
                          setPicked((current) => {
                            const next = new Set(current);
                            if (value === true) next.add(item.externalId);
                            else next.delete(item.externalId);
                            return next;
                          })
                        }
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold break-words">{item.title}</span>
                          {item.wasPublished && <Badge variant="live">Live on Gumroad</Badge>}
                          {item.hasCover && (
                            <Badge variant="draft">
                              <ImageIcon aria-hidden="true" className="size-3" />
                              Cover
                            </Badge>
                          )}
                        </span>
                        <span className="text-sm text-mute">
                          {item.skipReason ?? (item.priceCents === null ? item.priceNote : item.priceCents === 0 ? "Free" : formatMoney(item.priceCents, currency))}
                          {item.skipReason === null && item.priceCents !== null && item.priceNote ? ` · ${item.priceNote}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {error && (
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="button" className="self-start" onClick={run} loading={pending} disabled={picked.size === 0}>
            Import {picked.size} {picked.size === 1 ? "product" : "products"} as drafts
          </Button>
        </>
      )}
    </Card>
  );
}

type Parsed = { fileName: string; header: string[]; rows: string[][] };

function CsvImport({ currency, onDone }: { currency: string; onDone: (done: Done) => void }) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [columns, setColumns] = useState({ title: -1, price: -1, description: -1 });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pick = async (file: File | undefined) => {
    setError(null);
    setParsed(null);
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Use a CSV under 2 MB.");
      return;
    }
    const rows = parseCsv(await file.text(), IMPORT_PRODUCTS_MAX + 2).filter((row) => row.some((cell) => cell.trim() !== ""));
    const [header, ...body] = rows;
    if (!header || body.length === 0) {
      setError("That file has no products. Use one row per product, with a header row.");
      return;
    }
    setParsed({ fileName: file.name, header, rows: body });
    setColumns({ title: guessProductColumn(header, "title"), price: guessProductColumn(header, "price"), description: guessProductColumn(header, "description") });
  };

  const template = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pickstall-products.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const run = () =>
    start(async () => {
      if (!parsed) return;
      setError(null);
      const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? "") : "");
      const rows = parsed.rows.slice(0, IMPORT_PRODUCTS_MAX).map((row) => ({ title: cell(row, columns.title), price: cell(row, columns.price), description: cell(row, columns.description) }));
      const result = await importCsvAction({ rows });
      if (!result.ok) setError(result.error);
      else onDone(result.data);
    });

  const options = (optional: boolean) => [...(optional ? [{ value: "-1", label: "Don't import" }] : []), ...(parsed?.header ?? []).map((name, index) => ({ value: String(index), label: name || `Column ${index + 1}` }))];

  return (
    <Card className="gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3">Import from a CSV</h2>
        <p className="text-sm text-mute">
          One row per product with a title and a price in {currency.toUpperCase()} (a description is optional). Coming from Stan? Copy your product names and prices into
          the template.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={input} id={inputId} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void pick(event.target.files?.[0])} />
        <Button type="button" variant="secondary" onClick={() => input.current?.click()}>
          <FileUp aria-hidden="true" className="size-4" />
          {parsed ? "Choose another file" : "Choose CSV file"}
        </Button>
        <Button type="button" variant="ghost" onClick={template}>
          <Download aria-hidden="true" className="size-4" />
          Download template
        </Button>
      </div>

      {parsed && (
        <>
          <p className="text-sm text-mute">
            {parsed.fileName}: {Math.min(parsed.rows.length, IMPORT_PRODUCTS_MAX)} {parsed.rows.length === 1 ? "product" : "products"}
            {parsed.rows.length > IMPORT_PRODUCTS_MAX ? ` (only the first ${IMPORT_PRODUCTS_MAX} are imported)` : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["title", "price", "description"] as const).map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label htmlFor={`col-${key}`} className="text-sm font-semibold">
                  {COLUMN_LABELS[key]}
                </label>
                <ChoiceSelect id={`col-${key}`} value={String(columns[key])} onValueChange={(value) => setColumns((current) => ({ ...current, [key]: Number(value) }))} options={options(key !== "title")} placeholder="Choose a column" />
              </div>
            ))}
          </div>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line text-sm">
            {parsed.rows.slice(0, 5).map((row, index) => (
              <li key={index} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 truncate font-semibold">{columns.title >= 0 ? row[columns.title] || "(no title)" : "(choose the title column)"}</span>
                <span className="shrink-0 text-mute tabular-nums">{columns.price >= 0 ? row[columns.price] || "0" : "Free"}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {parsed && (
        <Button type="button" className="self-start" onClick={run} loading={pending} disabled={columns.title < 0}>
          Import as drafts
        </Button>
      )}
    </Card>
  );
}

function ImportDone({ done, productsHref, onAgain }: { done: Done; productsHref: string; onAgain: () => void }) {
  return (
    <Card className="items-start gap-4">
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-mint-soft text-mint">
        <CheckCircle2 className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3">
          {done.added} {done.added === 1 ? "product" : "products"} imported as drafts
        </h2>
        <p className="text-sm text-mute">
          {done.skipped > 0 && `${done.skipped} skipped (already imported, or a membership). `}
          {done.invalid ? `${done.invalid} rows had no title. ` : ""}
          Next: open each draft, add its file or link, check the price, and publish.
        </p>
      </div>
      {done.limit && (
        <Alert variant="warning">
          <AlertDescription>Your store reached its product limit, so the rest were not imported.</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={productsHref}>See my products</Link>
        </Button>
        <Button type="button" variant="ghost" onClick={onAgain}>
          Import more
        </Button>
      </div>
    </Card>
  );
}

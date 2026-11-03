"use client";

import { Archive, ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronUp, CreditCard, FileText, ImageIcon, Link2, Plus, Rocket, Settings2, ShoppingCart, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import { ImageUploader } from "@/components/dashboard/image-uploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PriceTag } from "@/components/store/price-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAutoHide } from "@/components/ui/use-auto-hide";
import { CHECKOUT_QUESTIONS_MAX } from "@/lib/config";
import { changeProductStatus, removeProduct, saveProduct, type SaveProductState } from "@/lib/products/actions";
import { safeImageSrc } from "@/lib/media/media";
import { parseMoneyToCents, priceDecimals } from "@/lib/products/money";
import { savingPercent, type Priced } from "@/lib/products/pricing";
import { PRODUCT_LIMITS } from "@/lib/products/schemas";
import { cn } from "@/lib/utils";

export type EditorQuestion = { id: string; label: string; kind: "text" | "long_text" | "dropdown" | "checkbox"; required: boolean; options: string[] };

export type EditorProduct = {
  id: string;
  status: "draft" | "published" | "archived";
  title: string;
  slug: string;
  description: string;
  coverUrl: string;
  externalUrl: string;
  price: string;
  /** Discount toggle and the discounted price buyers pay (D-047). */
  discountOn: boolean;
  salePrice: string;
  buttonText: string;
  downloadLimit: string;
  headline: string;
  askPhone: boolean;
  questions: EditorQuestion[];
  thankYou: string;
  redirectUrl: string;
  emailSubject: string;
  emailBody: string;
};

type Tab = "details" | "checkout" | "after" | "settings";

const FIELD_TAB: Record<string, Tab> = {
  title: "details",
  description: "details",
  coverUrl: "details",
  externalUrl: "details",
  price: "details",
  salePrice: "details",
  buttonText: "details",
  headline: "checkout",
  questions: "checkout",
  thankYou: "after",
  redirectUrl: "after",
  emailSubject: "after",
  emailBody: "after",
  downloadLimit: "settings",
};

const KIND_LABELS: Record<EditorQuestion["kind"], string> = { text: "Short answer", long_text: "Long answer", dropdown: "Dropdown", checkbox: "Checkbox" };

const STATUS_BADGE: Record<EditorProduct["status"], { label: string; variant: "live" | "draft" }> = {
  draft: { label: "Draft", variant: "draft" },
  published: { label: "Published", variant: "live" },
  archived: { label: "Archived", variant: "draft" },
};

function tabOfField(field: string | undefined): Tab | null {
  if (!field) return null;
  if (field.startsWith("question-")) return "checkout";
  return FIELD_TAB[field] ?? null;
}

type Props = { initial: EditorProduct; currency: string; storeLink: string };

/**
 * Digital product editor (PRD F3, F11; reference: Stan-style centered editor): four tabs (Details,
 * Checkout, After purchase, Settings) beside a live card preview. The whole form is sent as one JSON
 * payload; the server cleans and validates every field again.
 */
export function ProductEditor({ initial, currency, storeLink }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [tab, setTab] = useState<Tab>("details");
  const [state, action, pending] = useActionState<SaveProductState, FormData>(saveProduct.bind(null, initial.id), null);
  const [statusPending, startStatus] = useTransition();
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => setValues((current) => ({ ...current, [key]: value }));

  const error = state && !state.ok ? state : null;
  const showSaved = useAutoHide(state?.ok ? state : null);
  // Errors stay until the next action; success notices hide themselves.
  const showNotice = useAutoHide(notice?.kind === "success" ? notice : null) || notice?.kind === "error";
  const fieldError = (field: string) => (error?.field === field ? error.error : null);

  // A failed save opens the tab that holds the problem field (state adjusted while rendering, not in an effect).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    const target = state && !state.ok ? tabOfField(state.field) : null;
    if (target) setTab(target);
  }

  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  const payload = JSON.stringify({
    title: values.title,
    description: values.description,
    coverUrl: values.coverUrl,
    externalUrl: values.externalUrl,
    price: values.price,
    discountOn: values.discountOn,
    salePrice: values.discountOn ? values.salePrice : "",
    buttonText: values.buttonText,
    downloadLimit: values.downloadLimit,
    headline: values.headline,
    askPhone: values.askPhone,
    questions: values.questions,
    thankYou: values.thankYou,
    redirectUrl: values.redirectUrl,
    emailSubject: values.emailSubject,
    emailBody: values.emailBody,
  });

  const changeStatus = (status: EditorProduct["status"]) => {
    setNotice(null);
    startStatus(async () => {
      const result = await changeProductStatus(values.id, status);
      if (!result.ok) {
        setNotice({ kind: "error", text: result.error });
        return;
      }
      set("status", status);
      setNotice({ kind: "success", text: status === "published" ? "Published. Buyers will see it once your store page is live." : status === "archived" ? "Archived." : "Back to draft." });
      router.refresh();
    });
  };

  const remove = () => {
    startStatus(async () => {
      const result = await removeProduct(values.id);
      if (!result.ok) {
        setNotice({ kind: "error", text: result.error });
        setConfirmDelete(false);
        return;
      }
      router.push("/dashboard/products");
    });
  };

  const badge = STATUS_BADGE[values.status];
  const priceCents = parseMoneyToCents(values.price, currency);
  const salePriceCents = values.discountOn ? parseMoneyToCents(values.salePrice, currency) : null;
  const previewPrice = priceCents === null ? null : { priceCents, salePriceCents };
  const saving = previewPrice ? savingPercent(previewPrice) : 0;
  const saleHint = saving > 0 ? `Buyers pay this instead. That is ${saving}% off.` : "Buyers pay this instead of the price above.";
  const busy = pending || statusPending;

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="payload" value={payload} />

      <div className="flex flex-col gap-4">
        <Link href="/dashboard/products" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Products
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="min-w-0 truncate font-display text-h1">{values.title.trim() || "Untitled product"}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {values.status === "published" ? (
              <Button type="button" variant="secondary" onClick={() => changeStatus("draft")} disabled={busy}>
                <Undo2 aria-hidden="true" className="size-4" />
                Unpublish
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => changeStatus("published")} disabled={busy}>
                <Rocket aria-hidden="true" className="size-4" />
                Publish
              </Button>
            )}
            <Button type="submit" loading={pending} disabled={statusPending}>
              Save changes
            </Button>
          </div>
        </div>
      </div>

      {showSaved && (
        <Alert variant="success">
          <AlertDescription>Saved. Your changes are in the preview.</AlertDescription>
        </Alert>
      )}
      {error && !error.field && (
        <Alert variant="error">
          <AlertDescription>{error.error}</AlertDescription>
        </Alert>
      )}
      {notice && showNotice && (
        <Alert variant={notice.kind === "error" ? "error" : "success"}>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 gap-0 p-0 sm:p-0">
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="gap-0">
            <TabsList aria-label="Product settings" className="px-4 sm:px-6">
              <TabsTrigger value="details">
                <FileText aria-hidden="true" />
                Details
              </TabsTrigger>
              <TabsTrigger value="checkout">
                <ShoppingCart aria-hidden="true" />
                Checkout
              </TabsTrigger>
              <TabsTrigger value="after">
                <CheckCircle2 aria-hidden="true" />
                After purchase
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings2 aria-hidden="true" />
                Settings
              </TabsTrigger>
            </TabsList>

            <div className="p-5 sm:p-6">
              <TabsContent value="details" className="gap-6">
                <Field id="title" label="Title" error={fieldError("title")} hint={`${values.title.length}/${PRODUCT_LIMITS.title}`}>
                  <Input id="title" value={values.title} maxLength={PRODUCT_LIMITS.title} onChange={(event) => set("title", event.target.value)} aria-invalid={!!fieldError("title")} placeholder="Instagram growth playbook" />
                </Field>
                <Field id="description" label="Description (optional)" error={fieldError("description")} hint={`${values.description.length}/${PRODUCT_LIMITS.description}. Plain text, no HTML.`}>
                  <Textarea id="description" rows={5} value={values.description} maxLength={PRODUCT_LIMITS.description} onChange={(event) => set("description", event.target.value)} placeholder="What do buyers get, and who is it for?" />
                </Field>
                <ImageUploader id="coverUrl" label="Cover image (optional)" kind="cover" shape="wide" value={values.coverUrl} onChange={(value) => set("coverUrl", value)} error={fieldError("coverUrl")} hint="Shown on your store and product page. JPG, PNG, WebP or GIF, up to 5 MB." />
                <Field id="externalUrl" label="Delivery link" error={fieldError("externalUrl")} hint="Where buyers get the product (Google Drive, Notion, Dropbox...). Only buyers see it, after paying.">
                  <Input id="externalUrl" type="url" inputMode="url" value={values.externalUrl} onChange={(event) => set("externalUrl", event.target.value)} placeholder="https://" aria-invalid={!!fieldError("externalUrl")} />
                </Field>

                <fieldset className="flex flex-col gap-4">
                  <legend className="mb-2 text-sm font-semibold">Price</legend>
                  <Field id="price" label="Price" error={fieldError("price")} hint={`In ${currency.toUpperCase()}. Use 0 for a free product.`}>
                    <MoneyInput id="price" currency={currency} value={values.price} onChange={(value) => set("price", value)} invalid={!!fieldError("price")} />
                  </Field>

                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md border border-line px-4 py-3">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">Add a discount</span>
                      <span className="text-sm text-mute">Buyers pay a lower price; your store shows the regular price struck through.</span>
                    </span>
                    <Switch checked={values.discountOn} onCheckedChange={(checked) => set("discountOn", checked)} aria-label="Add a discount" />
                  </label>

                  {values.discountOn && (
                    <Field id="salePrice" label="Discounted price" error={fieldError("salePrice")} hint={saleHint}>
                      <MoneyInput id="salePrice" currency={currency} value={values.salePrice} onChange={(value) => set("salePrice", value)} invalid={!!fieldError("salePrice")} />
                    </Field>
                  )}
                </fieldset>

                <Field id="buttonText" label="Button text" error={fieldError("buttonText")} hint={`${values.buttonText.length}/${PRODUCT_LIMITS.buttonText}. Shown on your store and product page.`}>
                  <Input id="buttonText" value={values.buttonText} maxLength={PRODUCT_LIMITS.buttonText} onChange={(event) => set("buttonText", event.target.value)} placeholder="Buy now" />
                </Field>
              </TabsContent>

              <TabsContent value="checkout" className="gap-6">
                <Field id="headline" label="Checkout headline (optional)" error={fieldError("headline")} hint={`${values.headline.length}/${PRODUCT_LIMITS.headline}`}>
                  <Input id="headline" value={values.headline} maxLength={PRODUCT_LIMITS.headline} onChange={(event) => set("headline", event.target.value)} placeholder="Get instant access" />
                </Field>

                <div className="flex flex-col gap-3 rounded-md border border-line bg-bg-subtle p-4">
                  <p className="text-sm font-semibold">Always asked</p>
                  <p className="text-sm text-mute">Name and email. Buyers get their receipt and access link by email.</p>
                  <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                    <input type="checkbox" className="size-5 accent-blue" checked={values.askPhone} onChange={(event) => set("askPhone", event.target.checked)} />
                    Also ask for a phone number
                  </label>
                </div>

                <QuestionList
                  questions={values.questions}
                  onChange={(questions) => set("questions", questions)}
                  errorFor={(index) => fieldError(`question-${index}`)}
                  listError={fieldError("questions")}
                />
              </TabsContent>

              <TabsContent value="after" className="gap-6">
                <Field id="thankYou" label="Thank-you message (optional)" error={fieldError("thankYou")} hint={`${values.thankYou.length}/${PRODUCT_LIMITS.thankYou}. Shown after payment.`}>
                  <Textarea id="thankYou" rows={3} value={values.thankYou} maxLength={PRODUCT_LIMITS.thankYou} onChange={(event) => set("thankYou", event.target.value)} placeholder="Thank you! Your files are on their way." />
                </Field>
                <Field id="redirectUrl" label="Redirect after purchase (optional)" error={fieldError("redirectUrl")} hint="Send buyers to your own page instead. Must start with https://">
                  <Input id="redirectUrl" type="url" inputMode="url" value={values.redirectUrl} onChange={(event) => set("redirectUrl", event.target.value)} placeholder="https://" aria-invalid={!!fieldError("redirectUrl")} />
                </Field>
                <div className="flex flex-col gap-4 rounded-md border border-line p-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold">Confirmation email</p>
                    <p className="text-sm text-mute">You can use these variables. The access link and your store name are always included.</p>
                    <ul className="flex flex-wrap gap-2 pt-1">
                      {["{{customer_name}}", "{{product_title}}", "{{download_link}}"].map((variable) => (
                        <li key={variable}>
                          <code className="rounded-sm bg-bg-subtle px-2 py-1 font-mono text-xs text-ink">{variable}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Field id="emailSubject" label="Subject (optional)" error={fieldError("emailSubject")} hint={`${values.emailSubject.length}/${PRODUCT_LIMITS.emailSubject}`}>
                    <Input id="emailSubject" value={values.emailSubject} maxLength={PRODUCT_LIMITS.emailSubject} onChange={(event) => set("emailSubject", event.target.value)} placeholder="Your {{product_title}} is ready" />
                  </Field>
                  <Field id="emailBody" label="Message (optional)" error={fieldError("emailBody")} hint={`${values.emailBody.length}/${PRODUCT_LIMITS.emailBody}`}>
                    <Textarea id="emailBody" rows={5} value={values.emailBody} maxLength={PRODUCT_LIMITS.emailBody} onChange={(event) => set("emailBody", event.target.value)} placeholder={"Hi {{customer_name}},\n\nThanks for buying {{product_title}}. Get it here: {{download_link}}"} />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="gap-6">
                <Field id="slug" label="Product link" hint="Made from the title. It stays the same once you publish.">
                  <p className="flex min-h-11 items-center rounded-md border border-line bg-bg-subtle px-3 font-mono text-sm break-all text-ink">
                    {storeLink}/{values.slug}
                  </p>
                </Field>
                <Field id="downloadLimit" label="Download limit (optional)" error={fieldError("downloadLimit")} hint={`How many times one buyer can download. Leave empty for no limit (max ${PRODUCT_LIMITS.downloadLimitMax}).`}>
                  <Input id="downloadLimit" inputMode="numeric" value={values.downloadLimit} onChange={(event) => set("downloadLimit", event.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="No limit" className="max-w-40" />
                </Field>

                <div className="flex flex-col gap-3 rounded-md border border-line p-4">
                  <p className="font-semibold">Status</p>
                  <p className="text-sm text-mute">
                    {values.status === "published" ? "Published products can be bought once your store is live." : values.status === "archived" ? "Archived products are hidden and cannot be bought." : "Drafts are only visible to you."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {values.status !== "archived" && (
                      <Button type="button" variant="secondary" onClick={() => changeStatus("archived")} disabled={busy}>
                        <Archive aria-hidden="true" className="size-4" />
                        Archive
                      </Button>
                    )}
                    {values.status === "archived" && (
                      <Button type="button" variant="secondary" onClick={() => changeStatus("draft")} disabled={busy}>
                        <Undo2 aria-hidden="true" className="size-4" />
                        Restore as draft
                      </Button>
                    )}
                    {values.status !== "published" &&
                      (confirmDelete ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">Delete &ldquo;{values.title.trim() || "Untitled product"}&rdquo; for good?</span>
                          <Button type="button" variant="destructive" onClick={remove} loading={statusPending}>
                            Yes, delete
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button type="button" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                          <Trash2 aria-hidden="true" className="size-4" />
                          Delete
                        </Button>
                      ))}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </Card>

        <aside aria-label="Preview" className="xl:sticky xl:top-22 xl:self-start">
          <ProductPreview values={values} currency={currency} price={previewPrice} />
        </aside>
      </div>
    </form>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | null; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
    </div>
  );
}

function MoneyInput({ id, currency, value, onChange, invalid }: { id: string; currency: string; value: string; onChange: (value: string) => void; invalid: boolean }) {
  return (
    <div className={cn("flex h-11 items-stretch overflow-hidden rounded-sm border bg-surface focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", invalid ? "border-danger" : "border-input")}>
      <span aria-hidden="true" className="flex items-center border-r border-line bg-bg-subtle px-3 text-sm font-semibold text-mute">
        {currency.toUpperCase()}
      </span>
      {/* Whole-number currencies (JPY, ISK...) get a number keyboard and a "0" placeholder (D-046). */}
      <input
        id={id}
        inputMode={priceDecimals(currency) === 0 ? "numeric" : "decimal"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={priceDecimals(currency) === 0 ? "0" : "0.00"}
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1 bg-transparent px-3 text-base text-ink outline-none tabular-nums placeholder:text-mute"
      />
    </div>
  );
}

function QuestionList({ questions, onChange, errorFor, listError }: { questions: EditorQuestion[]; onChange: (questions: EditorQuestion[]) => void; errorFor: (index: number) => string | null; listError: string | null }) {
  const update = (index: number, patch: Partial<EditorQuestion>) => onChange(questions.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target] as EditorQuestion, next[index] as EditorQuestion];
    onChange(next);
  };
  const full = questions.length >= CHECKOUT_QUESTIONS_MAX;

  return (
    <section aria-labelledby="questions-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id="questions-title" className="font-display text-h4">
          Your questions
        </h3>
        <p className="text-sm text-mute">Answers appear in your Customers tab. Don&apos;t ask for card numbers or ID numbers.</p>
      </div>

      {questions.length === 0 && <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-mute">No questions yet. Ask buyers anything you need to deliver well, for example their Instagram handle.</p>}

      <ol className="flex flex-col gap-3">
        {questions.map((question, index) => (
          <li key={question.id} className="flex flex-col gap-3 rounded-md border border-line p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-mute">Question {index + 1}</p>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move question ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                  <ChevronUp aria-hidden="true" className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move question ${index + 1} down`} disabled={index === questions.length - 1} onClick={() => move(index, 1)}>
                  <ChevronDown aria-hidden="true" className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove question ${index + 1}`} onClick={() => onChange(questions.filter((_, i) => i !== index))}>
                  <Trash2 aria-hidden="true" className="size-4 text-danger" />
                </Button>
              </div>
            </div>
            <Field id={`question-${index}`} label="Question" error={errorFor(index)}>
              <Input id={`question-${index}`} value={question.label} maxLength={PRODUCT_LIMITS.questionLabel} onChange={(event) => update(index, { label: event.target.value })} placeholder="What's your Instagram handle?" aria-invalid={!!errorFor(index)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field id={`question-kind-${index}`} label="Answer type">
                <Select id={`question-kind-${index}`} value={question.kind} onChange={(event) => update(index, { kind: event.target.value as EditorQuestion["kind"], options: event.target.value === "dropdown" && question.options.length === 0 ? ["", ""] : question.options })}>
                  {(Object.keys(KIND_LABELS) as EditorQuestion["kind"][]).map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-5 accent-blue" checked={question.required} onChange={(event) => update(index, { required: event.target.checked })} />
                Required
              </label>
            </div>
            {question.kind === "dropdown" && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Choices</p>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex gap-2">
                    <Input value={option} maxLength={PRODUCT_LIMITS.option} aria-label={`Choice ${optionIndex + 1}`} onChange={(event) => update(index, { options: question.options.map((value, i) => (i === optionIndex ? event.target.value : value)) })} placeholder={`Choice ${optionIndex + 1}`} />
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove choice ${optionIndex + 1}`} disabled={question.options.length <= 2} onClick={() => update(index, { options: question.options.filter((_, i) => i !== optionIndex) })}>
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                ))}
                {question.options.length < PRODUCT_LIMITS.optionsMax && (
                  <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => update(index, { options: [...question.options, ""] })}>
                    <Plus aria-hidden="true" className="size-4" />
                    Add choice
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {listError && <FieldError>{listError}</FieldError>}
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        disabled={full}
        onClick={() => onChange([...questions, { id: crypto.randomUUID().slice(0, 8), label: "", kind: "text", required: false, options: [] }])}
      >
        <Plus aria-hidden="true" className="size-4" />
        Add question
      </Button>
      {full && <p className="text-sm text-mute">You can add up to {CHECKOUT_QUESTIONS_MAX} questions.</p>}
    </section>
  );
}

/** Live card preview, drawn with our tokens (the creator's own theme applies on the store page itself). */
function ProductPreview({ values, currency, price }: { values: EditorProduct; currency: string; price: Priced | null }) {
  const cover = safeImageSrc(values.coverUrl);

  return (
    <Card className="gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-h4">Preview</h2>
        <Badge variant="example">Example layout</Badge>
      </div>
      <div className="flex flex-col overflow-hidden rounded-md border border-line">
        <div className="flex aspect-video items-center justify-center bg-blue-soft text-blue">
          {cover ? (
            // A creator's own https image on any host, so next/image (fixed remote hosts) cannot load it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            <ImageIcon aria-hidden="true" className="size-10" />
          )}
        </div>
        <div className="flex flex-col gap-2 p-4">
          <p className="font-display text-h4 break-words">{values.title.trim() || "Untitled product"}</p>
          {values.description.trim() && <p className="line-clamp-3 text-sm whitespace-pre-line text-mute">{values.description}</p>}
          <p className="font-display text-money-m">{price ? <PriceTag product={price} currency={currency} regularClassName="text-mute" /> : "Set a price"}</p>
          <span className="flex h-11 items-center justify-center rounded-md bg-primary text-button text-primary-foreground">{values.buttonText.trim() || "Buy now"}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm text-mute">
        <li className="flex items-center gap-2">
          {values.externalUrl.trim() ? <Check aria-hidden="true" className="size-4 text-mint" /> : <Link2 aria-hidden="true" className="size-4" />}
          {values.externalUrl.trim() ? "Delivery link added" : "Add a delivery link to publish"}
        </li>
        <li className="flex items-center gap-2">
          <CreditCard aria-hidden="true" className="size-4" />
          {values.questions.length} checkout {values.questions.length === 1 ? "question" : "questions"}
        </li>
      </ul>
    </Card>
  );
}

"use client";

import { Archive, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, Circle, CreditCard, FileText, FileUp, ImageIcon, Link2, Lock, Mail, Phone, Plus, Rocket, Settings2, ShoppingCart, Trash2, Undo2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import { Field, MoneyInput, StepHeading } from "@/components/dashboard/editor-fields";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { ProductFileField } from "@/components/dashboard/product-file-field";
import { RichTextEditor } from "@/components/dashboard/rich-text-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PriceTag } from "@/components/store/price-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAutoHide } from "@/components/ui/use-auto-hide";
import { CHECKOUT_QUESTIONS_MAX } from "@/lib/config";
import { changeProductStatus, removeProduct, saveProduct, type SaveProductState } from "@/lib/products/actions";
import { safeImageSrc } from "@/lib/media/media";
import { parseMoneyToCents } from "@/lib/products/money";
import { savingPercent, type Priced } from "@/lib/products/pricing";
import { plainTextOf, type RichDoc } from "@/lib/products/rich-text";
import { PRODUCT_STEPS, PRODUCT_STEP_LABELS, PRODUCT_STEP_SHORT_LABELS, detailsMissing, nextStep, previousStep, stepOfField, stepsDone, type ProductStep } from "@/lib/products/editor-steps";
import { publishProblems } from "@/lib/products/publish";
import { PRODUCT_LIMITS } from "@/lib/products/schemas";
import type { ProductFileInfo } from "@/lib/files/types";
import { cn } from "@/lib/utils";

export type EditorQuestion = { id: string; label: string; kind: "text" | "long_text" | "dropdown" | "checkbox"; required: boolean; options: string[] };

export type EditorProduct = {
  id: string;
  status: "draft" | "published" | "archived";
  title: string;
  slug: string;
  /** Rich description (D-049). */
  descriptionDoc: RichDoc;
  coverUrl: string;
  externalUrl: string;
  /** Upload file or Redirect to URL (D-050), and the uploaded file. */
  deliveryType: "link" | "file";
  file: ProductFileInfo | null;
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

const KIND_LABELS: Record<EditorQuestion["kind"], string> = { text: "Short answer", long_text: "Long answer", dropdown: "Dropdown", checkbox: "Checkbox" };

const STATUS_BADGE: Record<EditorProduct["status"], { label: string; variant: "live" | "draft" }> = {
  draft: { label: "Draft", variant: "draft" },
  published: { label: "Published", variant: "live" },
  archived: { label: "Archived", variant: "draft" },
};

const STEP_ICONS: Record<ProductStep, typeof FileText> = { details: FileText, checkout: ShoppingCart, publish: Rocket };

type Props = {
  initial: EditorProduct;
  currency: string;
  storeLink: string;
  /** Whether a paid product may be published now (lib/products/publish.ts paymentsReady). */
  paymentsOk: boolean;
  /** A product that was just created opens on step 1 with nothing checked yet. */
  isNew: boolean;
};

/**
 * Digital product editor (PRD F3, F11, D-048), one step at a time like Stan's: 1 Details, 2 Checkout
 * form, 3 Publish, beside a live card preview. "Next" saves and opens the next step; "Publish" saves
 * and then publishes, so nothing typed is lost. The whole form is one JSON payload; the server
 * cleans and validates every field again and checks the publish rules on the saved product.
 */
export function ProductEditor({ initial, currency, storeLink, paymentsOk, isNew }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSetup = searchParams.get("from") === "setup";
  const [values, setValues] = useState(initial);
  const [step, setStep] = useState<ProductStep>("details");
  const [furthest, setFurthest] = useState<ProductStep>(isNew ? "details" : "publish");
  const [state, action, pending] = useActionState<SaveProductState, FormData>(saveProduct.bind(null, initial.id), null);
  const [statusPending, startStatus] = useTransition();
  const [, startSave] = useTransition();
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The step "Save and continue" asked for; it opens once that save comes back fine.
  const [goAfterSave, setGoAfterSave] = useState<ProductStep | null>(null);

  const set = <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => setValues((current) => ({ ...current, [key]: value }));
  const open = (target: ProductStep) => {
    setStep(target);
    if (PRODUCT_STEPS.indexOf(target) > PRODUCT_STEPS.indexOf(furthest)) setFurthest(target);
  };

  const error = state && !state.ok ? state : null;
  const showSaved = useAutoHide(state?.ok && !state.data.published ? state : null);
  // Errors stay until the next action; success notices hide themselves.
  const showNotice = useAutoHide(notice?.kind === "success" ? notice : null) || notice?.kind === "error";
  const fieldError = (field: string) => (error?.field === field ? error.error : null);

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
      if (status === "published" && fromSetup) {
        router.push("/dashboard/setup?step=connect-payments");
        return;
      }
      router.refresh();
    });
  };

  // A save result: a failure opens the step with the problem field; a success opens the step that
  // "Save and continue" asked for, or shows that it was published (state adjusted while rendering).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state && !state.ok) {
      const target = stepOfField(state.field);
      if (target) setStep(target);
    } else if (state?.ok && state.data.published) {
      set("status", "published");
      setNotice({ kind: "success", text: "Published. Buyers will see it once your store page is live." });
      if (fromSetup) {
        router.push("/dashboard/setup?step=connect-payments");
      }
    } else if (state?.ok && goAfterSave) {
      open(goAfterSave);
    }
    setGoAfterSave(null);
  }

  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const payload = JSON.stringify({
    title: values.title,
    descriptionDoc: values.descriptionDoc,
    coverUrl: values.coverUrl,
    externalUrl: values.externalUrl,
    deliveryType: values.deliveryType,
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

  const delivered = values.deliveryType === "file" ? values.file !== null : values.externalUrl.trim() !== "";
  const missingDetails = detailsMissing({ title: values.title, priceValid: priceCents !== null, hasDelivery: delivered });
  const done = stepsDone({ detailsOk: missingDetails.length === 0, furthest, published: values.status === "published" });
  const toPublish = publishProblems(
    {
      title: values.title,
      priceCents: priceCents ?? 0,
      salePriceCents: salePriceCents ?? null,
      externalUrl: values.externalUrl.trim() || null,
      deliveryType: values.deliveryType,
      fileId: values.file?.id ?? null,
    },
    paymentsOk,
  );
  const blockers = [...new Set([...missingDetails, ...toPublish])];
  const next = nextStep(step);
  const previous = previousStep(step);

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      // Submitted by hand instead of `action={action}`: React resets a form after an action, and the
      // Radix switches (discount, phone) follow that reset back to their first value, undoing what
      // the creator turned on. The submitter is kept so "Save and publish" still sends intent=publish.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        startSave(() => action(data));
      }}
    >
      <input type="hidden" name="payload" value={payload} />

      <div className="flex flex-col gap-4">
        <Link href={fromSetup ? "/dashboard/setup?step=first-product" : "/dashboard/products"} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
          <ArrowLeft aria-hidden="true" className="size-4" />
          {fromSetup ? "Back to setup" : "Products"}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="min-w-0 truncate font-display text-h1">{values.title.trim() || "Untitled product"}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <Button type="submit" variant="secondary" loading={pending && !goAfterSave} disabled={statusPending} onClick={() => setGoAfterSave(null)}>
            Save
          </Button>
        </div>

        <nav aria-label="Product steps">
          <ol className="grid grid-cols-3 gap-2">
            {PRODUCT_STEPS.map((id, index) => {
              const Icon = STEP_ICONS[id];
              const active = id === step;
              return (
                <li key={id}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => open(id)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "h-auto min-h-14 w-full flex-col items-center justify-center gap-1.5 px-2 py-2 text-center font-normal whitespace-normal sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:text-left",
                      active ? "border-blue bg-blue-soft not-disabled:hover:bg-blue-soft" : "border-line",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                        done[id] ? "bg-mint text-surface" : active ? "bg-blue text-on-blue" : "bg-bg-subtle text-mute",
                      )}
                    >
                      {done[id] ? <Check className="size-4" /> : index + 1}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <Icon aria-hidden="true" className="hidden size-4 shrink-0 text-mute sm:block" />
                        {/* Phones get the short name so all three steps fit side by side. */}
                        <span className="sm:hidden">{PRODUCT_STEP_SHORT_LABELS[id]}</span>
                        <span className="hidden truncate sm:inline">{PRODUCT_STEP_LABELS[id]}</span>
                      </span>
                      <span className={cn("hidden text-xs sm:block", done[id] ? "text-mint" : "text-mute")}>{done[id] ? "Done" : active ? "In progress" : "To do"}</span>
                    </span>
                    <span className="sr-only">{done[id] ? "(done)" : "(not done)"}</span>
                  </Button>
                </li>
              );
            })}
          </ol>
        </nav>
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
        <Card className="min-w-0 gap-6">
          {step === "details" && (
            <>
              <StepHeading title="Details" body="What you sell, what it costs and how buyers get it." />
              <Field id="title" label="Title" error={fieldError("title")} hint={`${values.title.length}/${PRODUCT_LIMITS.title}`}>
                <Input id="title" value={values.title} maxLength={PRODUCT_LIMITS.title} onChange={(event) => set("title", event.target.value)} aria-invalid={!!fieldError("title")} placeholder="Instagram growth playbook" />
              </Field>
              <RichTextEditor id="descriptionDoc" label="Description (optional)" value={values.descriptionDoc} onChange={(doc) => set("descriptionDoc", doc)} error={fieldError("descriptionDoc")} />
              <ImageUploader id="coverUrl" label="Cover image (optional)" kind="cover" shape="wide" value={values.coverUrl} onChange={(value) => set("coverUrl", value)} error={fieldError("coverUrl")} hint="Shown on your store and product page. JPG, PNG, WebP or GIF, up to 5 MB." />
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold">How buyers get it</legend>
                <ToggleGroup
                  type="single"
                  variant="segment"
                  aria-label="Delivery"
                  value={values.deliveryType}
                  onValueChange={(value) => value && set("deliveryType", value as EditorProduct["deliveryType"])}
                  className="grid w-full grid-cols-2"
                >
                  <ToggleGroupItem value="file">
                    <FileUp aria-hidden="true" />
                    Upload file
                  </ToggleGroupItem>
                  <ToggleGroupItem value="link">
                    <Link2 aria-hidden="true" />
                    Redirect to URL
                  </ToggleGroupItem>
                </ToggleGroup>
                {values.deliveryType === "file" ? (
                  <ProductFileField productId={values.id} file={values.file} onChange={(file) => set("file", file)} />
                ) : (
                  <Field id="externalUrl" label="Delivery link" error={fieldError("externalUrl")} hint="Where buyers go after paying (Google Drive, Notion, Dropbox...). Only buyers see it.">
                    <Input id="externalUrl" type="url" inputMode="url" value={values.externalUrl} onChange={(event) => set("externalUrl", event.target.value)} placeholder="https://" aria-invalid={!!fieldError("externalUrl")} />
                  </Field>
                )}
              </fieldset>

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
            </>
          )}

          {step === "checkout" && (
            <>
              <StepHeading title="Checkout form" body="What buyers fill in before they pay. Answers appear in your Customers tab." />
              <Field id="headline" label="Checkout headline (optional)" error={fieldError("headline")} hint={`${values.headline.length}/${PRODUCT_LIMITS.headline}`}>
                <Input id="headline" value={values.headline} maxLength={PRODUCT_LIMITS.headline} onChange={(event) => set("headline", event.target.value)} placeholder="Get instant access" />
              </Field>

              <section aria-labelledby="collect-title" className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h3 id="collect-title" className="font-display text-h4">
                    Collect info
                  </h3>
                  <p className="text-sm text-mute">Name and email are always asked: buyers get their receipt and access link by email.</p>
                </div>
                <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
                  {[
                    { icon: UserRound, label: "Name" },
                    { icon: Mail, label: "Email" },
                  ].map(({ icon: Icon, label }) => (
                    <li key={label} className="flex min-h-14 items-center gap-3 px-4 py-3">
                      <Icon aria-hidden="true" className="size-5 shrink-0 text-mute" />
                      <span className="flex-1 font-medium">{label}</span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-mute">
                        <Lock aria-hidden="true" className="size-3.5" />
                        Always asked
                      </span>
                    </li>
                  ))}
                  <li>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
                      <Phone aria-hidden="true" className="size-5 shrink-0 text-mute" />
                      <span className="flex flex-1 flex-col">
                        <span className="font-medium">Phone number</span>
                        <span className="text-xs text-mute">Optional for buyers.</span>
                      </span>
                      <Switch checked={values.askPhone} onCheckedChange={(checked) => set("askPhone", checked)} aria-label="Ask for a phone number" />
                    </label>
                  </li>
                </ul>
              </section>

              <QuestionList
                questions={values.questions}
                onChange={(questions) => set("questions", questions)}
                errorFor={(index) => fieldError(`question-${index}`)}
                listError={fieldError("questions")}
              />
            </>
          )}

          {step === "publish" && (
            <>
              <StepHeading title="Publish" body="What buyers see after paying, a last check, then publish." />

              <section aria-labelledby="ready-title" className={cn("flex flex-col gap-3 rounded-md border p-4", blockers.length === 0 ? "border-mint/40 bg-mint-soft" : "border-line")}>
                <h3 id="ready-title" className="font-display text-h4">
                  {values.status === "published" ? "This product is live" : blockers.length === 0 ? "Ready to publish" : "Before you publish"}
                </h3>
                {blockers.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm">
                    <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 fill-mint text-surface" />
                    Title, price and delivery are set.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {blockers.map((problem) => (
                      <li key={problem} className="flex items-center gap-2 text-sm">
                        <Circle aria-hidden="true" className="size-5 shrink-0 text-warning" />
                        {problem}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

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

              <Accordion type="single" collapsible className="rounded-md border border-line">
                <AccordionItem value="more">
                  <AccordionTrigger className="px-4">
                    <span className="flex items-center gap-2">
                      <Settings2 aria-hidden="true" className="size-4 text-mute" />
                      More settings
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-5 border-t border-line p-4">
                  <Field id="slug" label="Product link" hint="Made from the title. It stays the same once you publish.">
                    <p className="flex min-h-11 items-center rounded-md border border-line bg-bg-subtle px-3 font-mono text-sm break-all text-ink">
                      {storeLink}/{values.slug}
                    </p>
                  </Field>
                  <Field id="downloadLimit" label="Download limit (optional)" error={fieldError("downloadLimit")} hint={`How many times one buyer can download. Leave empty for no limit (max ${PRODUCT_LIMITS.downloadLimitMax}).`}>
                    <Input id="downloadLimit" inputMode="numeric" value={values.downloadLimit} onChange={(event) => set("downloadLimit", event.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="No limit" className="max-w-40" />
                  </Field>
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
                    {confirmDelete ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">Delete &ldquo;{values.title.trim() || "Untitled product"}&rdquo;? Anyone who bought it keeps access.</span>
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
                      )}
                  </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {previous ? (
              <Button type="button" variant="ghost" onClick={() => open(previous)} disabled={busy}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button type="submit" loading={pending && goAfterSave !== null} disabled={statusPending} onClick={() => setGoAfterSave(next)}>
                Save and continue
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            ) : values.status === "published" ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => changeStatus("draft")} disabled={busy}>
                  <Undo2 aria-hidden="true" className="size-4" />
                  Unpublish
                </Button>
                <Button type="submit" loading={pending} disabled={statusPending} onClick={() => setGoAfterSave(null)}>
                  Save changes
                </Button>
              </div>
            ) : (
              <Button type="submit" name="intent" value="publish" loading={busy} disabled={blockers.length > 0 || values.status === "archived"} onClick={() => setGoAfterSave(null)}>
                <Rocket aria-hidden="true" className="size-4" />
                {fromSetup ? "Save, publish & continue setup" : "Save and publish"}
              </Button>
            )}
          </div>
        </Card>

        <aside aria-label="Preview" className="xl:sticky xl:top-22 xl:self-start">
          <ProductPreview values={values} currency={currency} price={previewPrice} />
        </aside>
      </div>
    </form>
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
          Extra fields
        </h3>
        <p className="text-sm text-mute">Up to {CHECKOUT_QUESTIONS_MAX} more. Answers appear in your Customers tab. Don&apos;t ask for card numbers or ID numbers.</p>
      </div>

      {questions.length === 0 && <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-mute">No extra fields yet. Ask anything you need to deliver well, for example their Instagram handle.</p>}

      <ol className="flex flex-col gap-3">
        {questions.map((question, index) => (
          <li key={question.id} className="flex flex-col gap-3 rounded-md border border-line p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-mute">Field {index + 1}</p>
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
                <Checkbox checked={question.required} onCheckedChange={(checked) => update(index, { required: checked === true })} />
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
        Add field
      </Button>
      {full && <p className="text-sm text-mute">You can add up to {CHECKOUT_QUESTIONS_MAX} extra fields.</p>}
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
          {plainTextOf(values.descriptionDoc) && <p className="line-clamp-3 text-sm whitespace-pre-line text-mute">{plainTextOf(values.descriptionDoc)}</p>}
          <p className="font-display text-money-m">{price ? <PriceTag product={price} currency={currency} regularClassName="text-mute" /> : "Set a price"}</p>
          <span className="flex h-11 items-center justify-center rounded-md bg-primary text-button text-primary-foreground">{values.buttonText.trim() || "Buy now"}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm text-mute">
        <li className="flex items-center gap-2">
          {(values.deliveryType === "file" ? values.file : values.externalUrl.trim()) ? <Check aria-hidden="true" className="size-4 text-mint" /> : <Link2 aria-hidden="true" className="size-4" />}
          {values.deliveryType === "file"
            ? values.file
              ? `File added: ${values.file.name}`
              : "Upload a file to publish"
            : values.externalUrl.trim()
              ? "Delivery link added"
              : "Add a delivery link to publish"}
        </li>
        <li className="flex items-center gap-2">
          <CreditCard aria-hidden="true" className="size-4" />
          {values.questions.length} checkout {values.questions.length === 1 ? "question" : "questions"}
        </li>
      </ul>
    </Card>
  );
}

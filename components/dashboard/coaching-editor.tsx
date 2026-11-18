"use client";

import { ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, Circle, Clock, CreditCard, FileText, Gift, Globe, ImageIcon, Link2, Mail, Plus, Rocket, Trash2, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { Field, MoneyInput, StepHeading } from "@/components/dashboard/editor-fields";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { RichTextEditor } from "@/components/dashboard/rich-text-editor";
import { PriceTag } from "@/components/store/price-tag";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAutoHide } from "@/components/ui/use-auto-hide";
import { saveCoachingDetails, type SaveCoachingState } from "@/lib/coaching/actions";
import {
  COACHING_STEPS,
  COACHING_STEP_LABELS,
  COACHING_STEP_SHORT_LABELS,
  coachingStepOfField,
  nextCoachingStep,
  previousCoachingStep,
  type CoachingStep,
} from "@/lib/coaching/editor-steps";
import {
  COACHING_BUFFERS,
  COACHING_DURATIONS,
  COACHING_LIMITS,
  COACHING_NOTICE_HOURS,
  COACHING_WINDOW_DAYS,
  WEEKDAYS,
  WEEKDAY_LABELS,
  availabilityProblems,
  durationLabel,
  minutesOf,
  weeklySummary,
} from "@/lib/coaching/settings";
import type { CoachingWindowDoc } from "@/lib/db/collections";
import { safeImageSrc } from "@/lib/media/media";
import { changeProductStatus, removeProduct } from "@/lib/products/actions";
import { parseMoneyToCents } from "@/lib/products/money";
import { savingPercent, type Priced } from "@/lib/products/pricing";
import { publishProblems } from "@/lib/products/publish";
import { plainTextOf, type RichDoc } from "@/lib/products/rich-text";
import { PRODUCT_LIMITS } from "@/lib/products/schemas";
import { cn } from "@/lib/utils";

export type EditorCoaching = {
  id: string;
  status: "draft" | "published" | "archived";
  title: string;
  descriptionDoc: RichDoc;
  coverUrl: string;
  durationMinutes: number;
  /** Empty until saved: the editor fills in the creator's browser time zone. */
  timeZone: string;
  weekly: CoachingWindowDoc[];
  bufferMinutes: number;
  minNoticeHours: number;
  bookingWindowDays: number;
  meeting: "link" | "later";
  meetingUrl: string;
  pricing: "paid" | "free";
  price: string;
  discountOn: boolean;
  salePrice: string;
};

const STATUS_BADGE: Record<EditorCoaching["status"], { label: string; variant: "live" | "draft" }> = {
  draft: { label: "Draft", variant: "draft" },
  published: { label: "Published", variant: "live" },
  archived: { label: "Archived", variant: "draft" },
};

const STEP_ICONS: Record<CoachingStep, typeof FileText> = { details: FileText, availability: CalendarClock, publish: Rocket };

// Phones: the field fills its column and the clock icon hides (tapping opens the picker anyway).
const TIME_INPUT = "w-full min-w-0 px-2 tabular-nums sm:w-40 sm:px-3 max-sm:[&::-webkit-calendar-picker-indicator]:hidden";

/** "HH:MM" for minutes after midnight. */
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const noticeLabel = (hours: number) => (hours === 0 ? "No notice needed" : hours < 24 ? `${hours} ${hours === 1 ? "hour" : "hours"} ahead` : `${hours / 24} ${hours === 24 ? "day" : "days"} ahead`);

const noSubscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";

/** Every time zone the browser knows, with the creator's own first. */
function timeZoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  return [...new Set([current, "UTC", ...zones].filter(Boolean))];
}

type Props = {
  initial: EditorCoaching;
  currency: string;
  /** Whether a paid call may be published now (lib/products/publish.ts paymentsReady). */
  paymentsOk: boolean;
  /** A call that was just created opens on step 1 with nothing checked yet. */
  isNew: boolean;
};

/**
 * Coaching call editor (D-081), one step at a time like the course editor: 1 Details (title,
 * description, cover, call length), 2 Availability (time zone, weekly hours, break, notice, how far
 * ahead, meeting link), 3 Price & publish, beside a live card preview. The whole form saves as one
 * JSON payload that the server checks again. Buyers pick a time at checkout (D-083).
 */
export function CoachingEditor({ initial, currency, paymentsOk, isNew }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSetup = searchParams.get("from") === "setup";
  const [values, setValues] = useState(initial);
  const [step, setStep] = useState<CoachingStep>("details");
  const [furthest, setFurthest] = useState<CoachingStep>(isNew ? "details" : "publish");
  const [state, action, pending] = useActionState<SaveCoachingState, FormData>(saveCoachingDetails.bind(null, initial.id), null);
  const [, startSave] = useTransition();
  const [removing, startRemove] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [goAfterSave, setGoAfterSave] = useState<CoachingStep | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const showSuccess = useAutoHide(success);
  // "Save and publish": the details are saved first, then the call is published.
  const publishAfterSave = useRef(false);

  const set = <K extends keyof EditorCoaching>(key: K, value: EditorCoaching[K]) => setValues((current) => ({ ...current, [key]: value }));
  const open = (target: CoachingStep) => {
    setStep(target);
    if (COACHING_STEPS.indexOf(target) > COACHING_STEPS.indexOf(furthest)) setFurthest(target);
  };

  // A call saved before has its own time zone; a new one starts with the creator's browser zone
  // (read in the browser; the server does not know it).
  const browserZone = useSyncExternalStore(noSubscribe, browserTimeZone, () => "");
  const timeZone = values.timeZone || browserZone;
  const zones = useMemo(() => timeZoneOptions(timeZone), [timeZone]);

  const error = state && !state.ok ? state : null;
  const showSaved = useAutoHide(state?.ok ? state : null);
  const fieldError = (field: string) => (error?.field === field ? error.error : null);

  // A failed save opens the step with the problem field; a good one opens the step that "Save and
  // continue" asked for (state adjusted while rendering, as in the course editor).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state && !state.ok) {
      const target = coachingStepOfField(state.field);
      if (target) setStep(target);
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

  const changeStatus = (status: EditorCoaching["status"]) => {
    startStatus(async () => {
      setNotice(null);
      const result = await changeProductStatus(values.id, status);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      set("status", status);
      setSuccess(status === "published" ? "Published. Buyers can book once your store page is live." : "Back to draft. It is hidden from your store.");
      router.refresh();
    });
  };

  const remove = () => {
    startRemove(async () => {
      const result = await removeProduct(values.id);
      if (!result.ok) {
        setNotice(result.error);
        setConfirmDelete(false);
        return;
      }
      router.push("/dashboard/products");
    });
  };

  // "Save and publish": publish once that save comes back fine, after rendering (changeStatus starts
  // a transition). Any save result clears the request, so a failed one never publishes later.
  useEffect(() => {
    if (!state || !publishAfterSave.current) return;
    publishAfterSave.current = false;
    if (state.ok) changeStatus("published");
    // changeStatus is redefined every render; only a new save result may trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const payload = JSON.stringify({
    title: values.title,
    descriptionDoc: values.descriptionDoc,
    coverUrl: values.coverUrl,
    durationMinutes: values.durationMinutes,
    timeZone,
    weekly: values.weekly,
    bufferMinutes: values.bufferMinutes,
    minNoticeHours: values.minNoticeHours,
    bookingWindowDays: values.bookingWindowDays,
    meeting: values.meeting,
    meetingUrl: values.meeting === "link" ? values.meetingUrl : "",
    pricing: values.pricing,
    price: values.pricing === "paid" ? values.price : "",
    discountOn: values.pricing === "paid" && values.discountOn,
    salePrice: values.pricing === "paid" && values.discountOn ? values.salePrice : "",
  });

  const priceCents = values.pricing === "free" ? 0 : parseMoneyToCents(values.price, currency);
  const salePriceCents = values.pricing === "paid" && values.discountOn ? parseMoneyToCents(values.salePrice, currency) : null;
  const previewPrice = priceCents === null ? null : { priceCents, salePriceCents };
  const saving = previewPrice ? savingPercent(previewPrice) : 0;

  const hoursProblems = availabilityProblems(values.weekly, values.durationMinutes);
  const meetingMissing = values.meeting === "link" && !values.meetingUrl.trim();
  const priceMissing = values.pricing === "paid" && !(priceCents !== null && priceCents > 0);
  const done: Record<CoachingStep, boolean> = {
    details: values.title.trim() !== "" && COACHING_STEPS.indexOf(furthest) > 0,
    availability: hoursProblems.length === 0 && !meetingMissing && timeZone !== "" && COACHING_STEPS.indexOf(furthest) > 1,
    publish: values.status === "published",
  };
  const blockers = [
    ...new Set([
      ...(meetingMissing ? ["Add your meeting link, or pick “I'll send it later”."] : []),
      ...(priceMissing ? ["Enter a price above 0, or pick Free."] : []),
      ...publishProblems(
        {
          type: "coaching",
          coaching: { ...values, timeZone: timeZone || null, meetingUrl: values.meetingUrl || null },
          title: values.title,
          priceCents: priceCents ?? 0,
          salePriceCents,
          externalUrl: null,
          deliveryType: "link",
          fileId: null,
        },
        paymentsOk,
      ),
    ]),
  ];
  const busy = pending || statusPending || removing;
  const next = nextCoachingStep(step);
  const previous = previousCoachingStep(step);
  const badge = STATUS_BADGE[values.status];

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      // Submitted by hand instead of `action={action}`, so React's form reset does not undo the
      // Radix switches and toggles (see the product editor).
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
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
            <h1 className="min-w-0 truncate font-display text-h1">{values.title.trim() || "Untitled coaching call"}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <Button type="submit" variant="secondary" loading={pending && !goAfterSave} disabled={removing} onClick={() => setGoAfterSave(null)}>
            Save
          </Button>
        </div>

        <nav aria-label="Coaching call steps">
          <ol className="grid grid-cols-3 gap-2">
            {COACHING_STEPS.map((id, index) => {
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
                      "h-auto min-h-14 w-full flex-col items-center justify-center gap-1.5 px-1 py-2 text-center font-normal whitespace-normal sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:text-left",
                      active && "bg-blue-soft not-disabled:hover:bg-blue-soft",
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
                        <Icon aria-hidden="true" className="hidden size-4 shrink-0 text-mute lg:block" />
                        <span className="sm:hidden">{COACHING_STEP_SHORT_LABELS[id]}</span>
                        <span className="hidden truncate sm:inline">{COACHING_STEP_LABELS[id]}</span>
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
      {notice && (
        <Alert variant="error">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {success && showSuccess && (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 gap-6">
          {step === "details" && (
            <>
              <StepHeading title="Details" body="What the call is, who it is for, and how long it lasts." />
              <Field id="title" label="Title" error={fieldError("title")} hint={`${values.title.length}/${PRODUCT_LIMITS.title}`}>
                <Input id="title" value={values.title} maxLength={PRODUCT_LIMITS.title} onChange={(event) => set("title", event.target.value)} aria-invalid={!!fieldError("title")} placeholder="1:1 portfolio review" />
              </Field>
              <RichTextEditor id="descriptionDoc" label="Description (optional)" value={values.descriptionDoc} onChange={(doc) => set("descriptionDoc", doc)} error={fieldError("descriptionDoc")} />
              <ImageUploader id="coverUrl" label="Cover image (optional)" kind="cover" shape="wide" value={values.coverUrl} onChange={(value) => set("coverUrl", value)} error={fieldError("coverUrl")} hint="The banner on your store and booking page. JPG, PNG, WebP or GIF, up to 4 MB." />
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold">Call length</legend>
                <ToggleGroup
                  type="single"
                  variant="segment"
                  aria-label="Call length"
                  value={String(values.durationMinutes)}
                  onValueChange={(value) => value && set("durationMinutes", Number(value))}
                  className="grid w-full grid-cols-3 sm:grid-cols-5"
                >
                  {COACHING_DURATIONS.map((minutes) => (
                    <ToggleGroupItem key={minutes} value={String(minutes)}>
                      {durationLabel(minutes)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {fieldError("durationMinutes") && <FieldError id="durationMinutes-error">{fieldError("durationMinutes")}</FieldError>}
              </fieldset>
            </>
          )}

          {step === "availability" && (
            <>
              <StepHeading title="Availability" body="When buyers can book you. They see open times in their own time zone." />
              <Field id="timeZone" label="Your time zone" error={fieldError("timeZone")} hint="Your weekly hours below are in this time zone.">
                <NativeSelect id="timeZone" value={timeZone} onChange={(event) => set("timeZone", event.target.value)} aria-invalid={!!fieldError("timeZone")}>
                  {zones.map((zone) => (
                    <NativeSelectOption key={zone} value={zone}>
                      {zone.replaceAll("_", " ")}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              <WeeklyHours weekly={values.weekly} onChange={(weekly) => set("weekly", weekly)} problems={hoursProblems} serverError={fieldError("weekly")} />

              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="bufferMinutes" label="Break after each call" error={fieldError("bufferMinutes")}>
                  <NativeSelect id="bufferMinutes" value={String(values.bufferMinutes)} onChange={(event) => set("bufferMinutes", Number(event.target.value))}>
                    {COACHING_BUFFERS.map((minutes) => (
                      <NativeSelectOption key={minutes} value={String(minutes)}>
                        {minutes === 0 ? "No break" : `${minutes} min`}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field id="minNoticeHours" label="Minimum notice" error={fieldError("minNoticeHours")}>
                  <NativeSelect id="minNoticeHours" value={String(values.minNoticeHours)} onChange={(event) => set("minNoticeHours", Number(event.target.value))}>
                    {COACHING_NOTICE_HOURS.map((hours) => (
                      <NativeSelectOption key={hours} value={String(hours)}>
                        {noticeLabel(hours)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field id="bookingWindowDays" label="Book up to" error={fieldError("bookingWindowDays")}>
                  <NativeSelect id="bookingWindowDays" value={String(values.bookingWindowDays)} onChange={(event) => set("bookingWindowDays", Number(event.target.value))}>
                    {COACHING_WINDOW_DAYS.map((days) => (
                      <NativeSelectOption key={days} value={String(days)}>
                        {days} days ahead
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold">Meeting link</legend>
                <ToggleGroup
                  type="single"
                  variant="segment"
                  aria-label="Meeting link"
                  value={values.meeting}
                  onValueChange={(value) => value && set("meeting", value as EditorCoaching["meeting"])}
                  className="grid w-full grid-cols-2"
                >
                  <ToggleGroupItem value="link">
                    <Link2 aria-hidden="true" />
                    Fixed link
                  </ToggleGroupItem>
                  <ToggleGroupItem value="later">
                    <Mail aria-hidden="true" />
                    I&apos;ll send it later
                  </ToggleGroupItem>
                </ToggleGroup>
                {values.meeting === "link" ? (
                  <Field id="meetingUrl" label="Your Zoom, Google Meet or Teams link" error={fieldError("meetingUrl")} hint="Sent only to buyers after they book. Never shown on your store.">
                    <Input
                      id="meetingUrl"
                      type="url"
                      inputMode="url"
                      value={values.meetingUrl}
                      maxLength={COACHING_LIMITS.meetingUrl}
                      onChange={(event) => set("meetingUrl", event.target.value)}
                      aria-invalid={!!fieldError("meetingUrl")}
                      placeholder="https://zoom.us/j/1234567890"
                    />
                  </Field>
                ) : (
                  <p className="text-sm text-mute">You email the link to each buyer yourself before the call.</p>
                )}
              </fieldset>
            </>
          )}

          {step === "publish" && (
            <>
              <StepHeading title="Price & publish" body="What a call costs, then publish it to your store." />
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold">Price type</legend>
                <ToggleGroup
                  type="single"
                  variant="segment"
                  aria-label="Price type"
                  value={values.pricing}
                  onValueChange={(value) => value && set("pricing", value as EditorCoaching["pricing"])}
                  className="grid w-full grid-cols-2"
                >
                  <ToggleGroupItem value="paid">
                    <CreditCard aria-hidden="true" />
                    Paid
                  </ToggleGroupItem>
                  <ToggleGroupItem value="free">
                    <Gift aria-hidden="true" />
                    Free
                  </ToggleGroupItem>
                </ToggleGroup>
                {values.pricing === "free" && <p className="text-sm text-mute">Buyers book with their name and email, at no cost.</p>}
              </fieldset>

              {values.pricing === "paid" && (
                <fieldset className="flex flex-col gap-4">
                  <legend className="sr-only">Price</legend>
                  <Field id="price" label="Price per call" error={fieldError("price")} hint={`In ${currency.toUpperCase()}.`}>
                    <MoneyInput id="price" currency={currency} value={values.price} onChange={(value) => set("price", value)} invalid={!!fieldError("price")} />
                  </Field>
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-line px-4 py-3">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">Add a discount</span>
                      <span className="text-sm text-mute">Buyers pay a lower price; the regular price shows struck through.</span>
                    </span>
                    <Switch checked={values.discountOn} onCheckedChange={(checked) => set("discountOn", checked)} aria-label="Add a discount" />
                  </label>
                  {values.discountOn && (
                    <Field id="salePrice" label="Discounted price" error={fieldError("salePrice")} hint={saving > 0 ? `Buyers pay this instead. That is ${saving}% off.` : "Buyers pay this instead of the price above."}>
                      <MoneyInput id="salePrice" currency={currency} value={values.salePrice} onChange={(value) => set("salePrice", value)} invalid={!!fieldError("salePrice")} />
                    </Field>
                  )}
                </fieldset>
              )}

              <section aria-labelledby="ready-title" className="flex flex-col gap-3 rounded-lg border border-line p-4">
                <h3 id="ready-title" className="font-display text-h4">
                  {values.status === "published" ? "This call is live" : blockers.length === 0 ? "Ready to publish" : "Before you publish"}
                </h3>
                <ul className="flex flex-col gap-2 text-sm">
                  {blockers.length === 0 ? (
                    <li className="flex items-center gap-2">
                      <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-mint" />
                      Everything is in place.
                    </li>
                  ) : (
                    blockers.map((problem) => (
                      <li key={problem} className="flex items-start gap-2">
                        <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mute" />
                        {problem}
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
                {confirmDelete ? (
                  <>
                    <span className="text-sm font-medium">Delete &ldquo;{values.title.trim() || "Untitled coaching call"}&rdquo;?</span>
                    <Button type="button" variant="destructive" onClick={remove} loading={removing}>
                      Yes, delete
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)} disabled={pending}>
                    <Trash2 aria-hidden="true" className="size-4" />
                    Delete coaching call
                  </Button>
                )}
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {previous ? (
              <Button type="button" variant="ghost" onClick={() => open(previous)} disabled={pending}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button type="submit" loading={pending && goAfterSave !== null} disabled={removing || statusPending} onClick={() => setGoAfterSave(next)}>
                Save and continue
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            ) : values.status === "published" ? (
              <Button type="button" variant="secondary" onClick={() => changeStatus("draft")} loading={statusPending} disabled={busy}>
                <Undo2 aria-hidden="true" className="size-4" />
                Unpublish
              </Button>
            ) : (
              <Button type="submit" loading={busy} disabled={blockers.length > 0 || values.status === "archived"} onClick={() => (publishAfterSave.current = true)}>
                <Rocket aria-hidden="true" className="size-4" />
                Save and publish
              </Button>
            )}
          </div>
        </Card>

        <aside aria-label="Preview" className="xl:sticky xl:top-22 xl:self-start">
          <CoachingPreview values={{ ...values, timeZone }} currency={currency} price={previewPrice} />
        </aside>
      </div>
    </form>
  );
}

/**
 * Weekly hours: one row per weekday with an on/off switch and up to 3 time ranges. Problems show
 * as the creator types (the same rules the server checks).
 */
function WeeklyHours({ weekly, onChange, problems, serverError }: { weekly: CoachingWindowDoc[]; onChange: (weekly: CoachingWindowDoc[]) => void; problems: string[]; serverError: string | null }) {
  const rangesOf = (day: number) => weekly.map((window, index) => ({ window, index })).filter((item) => item.window.day === day);
  const update = (index: number, patch: Partial<CoachingWindowDoc>) => onChange(weekly.map((window, i) => (i === index ? { ...window, ...patch } : window)));
  const removeAt = (index: number) => onChange(weekly.filter((_, i) => i !== index));
  const toggleDay = (day: number, on: boolean) => onChange(on ? [...weekly, { day, start: "09:00", end: "17:00" }] : weekly.filter((window) => window.day !== day));
  // A new range starts where the last one ends and runs an hour (to 23:55 at the latest).
  const addRange = (day: number) => {
    const lastEnd = minutesOf(rangesOf(day).at(-1)?.window.end ?? "") ?? 17 * 60;
    const start = Math.min(lastEnd, 23 * 60);
    onChange([...weekly, { day, start: clock(start), end: clock(Math.min(start + 60, 23 * 60 + 55)) }]);
  };

  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={problems.length > 0 || serverError ? "weekly-error" : undefined}>
      <legend className="mb-2 text-sm font-semibold">Weekly hours</legend>
      <ul id="weekly" tabIndex={-1} className="flex flex-col divide-y divide-line rounded-lg border border-line">
        {WEEKDAYS.map((day) => {
          const ranges = rangesOf(day);
          const on = ranges.length > 0;
          const label = WEEKDAY_LABELS[day] as string;
          return (
            <li key={day} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:px-4 sm:items-start">
              <label className="flex min-h-11 w-36 shrink-0 cursor-pointer items-center gap-3">
                <Switch checked={on} onCheckedChange={(checked) => toggleDay(day, checked)} aria-label={`Take calls on ${label}`} />
                <span className="text-sm font-semibold">{label}</span>
              </label>
              {on ? (
                <div className="flex flex-1 flex-col gap-2">
                  {ranges.map(({ window, index }, position) => (
                    <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 sm:flex">
                      <Input type="time" step={300} value={window.start} onChange={(event) => update(index, { start: event.target.value })} aria-label={`${label} start ${position + 1}`} className={TIME_INPUT} />
                      <span className="text-sm text-mute">to</span>
                      <Input type="time" step={300} value={window.end} onChange={(event) => update(index, { end: event.target.value })} aria-label={`${label} end ${position + 1}`} className={TIME_INPUT} />
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeAt(index)} aria-label={`Remove ${label} time range ${position + 1}`}>
                        <X aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {ranges.length < COACHING_LIMITS.windowsPerDay && (
                    <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => addRange(day)}>
                      <Plus aria-hidden="true" className="size-4" />
                      Add time range
                    </Button>
                  )}
                </div>
              ) : (
                <p className="flex min-h-11 items-center text-sm text-mute">Unavailable</p>
              )}
            </li>
          );
        })}
      </ul>
      {(serverError || problems.length > 0) && (
        <div id="weekly-error" className="flex flex-col gap-1">
          {(serverError ? [serverError] : problems).map((problem) => (
            <FieldError key={problem}>{problem}</FieldError>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function CoachingPreview({ values, currency, price }: { values: EditorCoaching; currency: string; price: Priced | null }) {
  const cover = safeImageSrc(values.coverUrl);
  const description = plainTextOf(values.descriptionDoc);
  return (
    <Card className="gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-h4">Preview</h2>
        <Badge variant="example">Example layout</Badge>
      </div>
      <div className="flex flex-col overflow-hidden rounded-lg border border-line">
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
          <Badge variant="draft">{durationLabel(values.durationMinutes)} call</Badge>
          <p className="font-display text-h4 break-words">{values.title.trim() || "Untitled coaching call"}</p>
          {description && <p className="line-clamp-3 text-sm whitespace-pre-line text-mute">{description}</p>}
          <p className="font-display text-money-m">{values.pricing === "free" ? "Free" : price ? <PriceTag product={price} currency={currency} regularClassName="text-mute" /> : "Set a price"}</p>
          <span className="flex h-11 items-center justify-center rounded-md bg-primary text-button text-primary-foreground">Book a call</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm text-mute">
        <li className="flex items-center gap-2">
          <Clock aria-hidden="true" className="size-4" />
          {weeklySummary(values.weekly)}
        </li>
        <li className="flex items-center gap-2">
          <Globe aria-hidden="true" className="size-4" />
          {values.timeZone ? values.timeZone.replaceAll("_", " ") : "Time zone not set"}
        </li>
      </ul>
    </Card>
  );
}

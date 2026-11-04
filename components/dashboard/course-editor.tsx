"use client";

import { ArrowLeft, ArrowRight, BookOpen, CalendarClock, Check, CheckCircle2, Circle, Clock, CreditCard, Eye, FileText, ImageIcon, Infinity as InfinityIcon, ListTree, Plus, Rocket, Tag, Trash2, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { CurriculumBuilder } from "@/components/dashboard/curriculum-builder";
import { Field, MoneyInput, StepHeading } from "@/components/dashboard/editor-fields";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { RichTextEditor } from "@/components/dashboard/rich-text-editor";
import { PriceTag } from "@/components/store/price-tag";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAutoHide } from "@/components/ui/use-auto-hide";
import { saveCourseDetails, saveCourseRelease, type SaveCourseState } from "@/lib/courses/actions";
import { lessonCount, lessonHasContent, type Curriculum, type EditorModule } from "@/lib/courses/curriculum-types";
import { DRIP_DAYS_MAX, unlockLabel } from "@/lib/courses/drip";
import {
  COURSE_STEPS,
  COURSE_STEP_LABELS,
  COURSE_STEP_SHORT_LABELS,
  basicsMissing,
  courseStepOfField,
  nextCourseStep,
  previousCourseStep,
  pricingMissing,
  type CourseStep,
} from "@/lib/courses/editor-steps";
import { COURSE_CATEGORIES, COURSE_CATEGORY_LABELS, COURSE_LIMITS, accessLabel, type CourseCategory } from "@/lib/courses/settings";
import { safeImageSrc } from "@/lib/media/media";
import { changeProductStatus, removeProduct } from "@/lib/products/actions";
import { parseMoneyToCents } from "@/lib/products/money";
import { savingPercent, type Priced } from "@/lib/products/pricing";
import { publishProblems } from "@/lib/products/publish";
import { plainTextOf, type RichDoc } from "@/lib/products/rich-text";
import { PRODUCT_LIMITS } from "@/lib/products/schemas";
import { cn } from "@/lib/utils";

export type EditorCourse = {
  id: string;
  status: "draft" | "published" | "archived";
  title: string;
  descriptionDoc: RichDoc;
  coverUrl: string;
  category: CourseCategory | "";
  tags: string[];
  pricing: "paid" | "free";
  price: string;
  discountOn: boolean;
  salePrice: string;
  access: "lifetime" | "days";
  accessDays: string;
  /** Drip (D-056): modules open N days after purchase instead of all at once. */
  drip: boolean;
};

const STATUS_BADGE: Record<EditorCourse["status"], { label: string; variant: "live" | "draft" }> = {
  draft: { label: "Draft", variant: "draft" },
  published: { label: "Published", variant: "live" },
  archived: { label: "Archived", variant: "draft" },
};

const STEP_ICONS: Record<CourseStep, typeof FileText> = { basic: FileText, pricing: CreditCard, curriculum: ListTree, publish: Rocket };

type Props = {
  initial: EditorCourse;
  currency: string;
  /** Whether a paid course may be published now (lib/products/publish.ts paymentsReady). */
  paymentsOk: boolean;
  /** A course that was just created opens on step 1 with nothing checked yet. */
  isNew: boolean;
  /** Modules and lessons (D-055), and whether Bunny video upload is set up. */
  curriculum: Curriculum;
  videoUploadReady: boolean;
};

/**
 * Course editor (course flow, D-054), one step at a time like the product editor: 1 Basic info,
 * 2 Pricing, 3 Curriculum, 4 Publish, beside a live card preview. Steps 1 and 2 save as one JSON
 * payload that the server checks again; the curriculum builder (G2) and publishing (G3) follow.
 */
export function CourseEditor({ initial, currency, paymentsOk, isNew, curriculum: initialCurriculum, videoUploadReady }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSetup = searchParams.get("from") === "setup";
  const [values, setValues] = useState(initial);
  const [curriculum, setCurriculum] = useState(initialCurriculum);
  const [step, setStep] = useState<CourseStep>("basic");
  const [furthest, setFurthest] = useState<CourseStep>(isNew ? "basic" : "publish");
  const [state, action, pending] = useActionState<SaveCourseState, FormData>(saveCourseDetails.bind(null, initial.id), null);
  const [, startSave] = useTransition();
  const [removing, startRemove] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [goAfterSave, setGoAfterSave] = useState<CourseStep | null>(null);
  // "Save and publish": the details are saved first, then the course is published.
  const publishAfterSave = useRef(false);
  const [statusPending, startStatus] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const showSuccess = useAutoHide(success);

  const changeStatus = (status: EditorCourse["status"]) => {
    startStatus(async () => {
      setNotice(null);
      const result = await changeProductStatus(values.id, status);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      set("status", status);
      setSuccess(status === "published" ? "Published. Students can buy it once your store page is live." : "Back to draft. It is hidden from your store.");
      if (status === "published" && fromSetup) {
        router.push("/dashboard/setup?step=connect-payments");
        return;
      }
      router.refresh();
    });
  };

  const set = <K extends keyof EditorCourse>(key: K, value: EditorCourse[K]) => setValues((current) => ({ ...current, [key]: value }));
  const open = (target: CourseStep) => {
    setStep(target);
    if (COURSE_STEPS.indexOf(target) > COURSE_STEPS.indexOf(furthest)) setFurthest(target);
  };

  const error = state && !state.ok ? state : null;
  const showSaved = useAutoHide(state?.ok ? state : null);
  const fieldError = (field: string) => (error?.field === field ? error.error : null);

  // A failed save opens the step with the problem field; a good one opens the step that "Save and
  // continue" asked for (state adjusted while rendering, as in the product editor).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state && !state.ok) {
      const target = courseStepOfField(state.field);
      if (target) setStep(target);
    } else if (state?.ok && goAfterSave) {
      open(goAfterSave);
    }
    setGoAfterSave(null);
  }

  // "Save and publish": publish once that save comes back fine, after rendering (changeStatus starts
  // a transition). Any save result clears the request, so a failed one never publishes later.
  useEffect(() => {
    if (!state || !publishAfterSave.current) return;
    publishAfterSave.current = false;
    if (state.ok) changeStatus("published");
    // changeStatus is redefined every render; only a new save result may trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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
    category: values.category,
    tags: values.tags,
    pricing: values.pricing,
    price: values.pricing === "paid" ? values.price : "",
    discountOn: values.pricing === "paid" && values.discountOn,
    salePrice: values.pricing === "paid" && values.discountOn ? values.salePrice : "",
    access: values.access,
    accessDays: values.access === "days" ? values.accessDays : "",
  });

  const priceCents = values.pricing === "free" ? 0 : parseMoneyToCents(values.price, currency);
  const salePriceCents = values.pricing === "paid" && values.discountOn ? parseMoneyToCents(values.salePrice, currency) : null;
  const previewPrice = priceCents === null ? null : { priceCents, salePriceCents };
  const saving = previewPrice ? savingPercent(previewPrice) : 0;

  const missingBasics = basicsMissing({ title: values.title, category: values.category });
  const missingPricing = pricingMissing({ pricing: values.pricing, priceCents, access: values.access, accessDays: values.accessDays });
  const done: Record<CourseStep, boolean> = {
    basic: missingBasics.length === 0,
    pricing: missingBasics.length === 0 && missingPricing.length === 0 && COURSE_STEPS.indexOf(furthest) > COURSE_STEPS.indexOf("pricing"),
    curriculum: curriculum.modules.some((module) => module.lessons.some(lessonHasContent)),
    publish: values.status === "published",
  };
  const readyLessons = curriculum.modules.reduce((sum, item) => sum + item.lessons.filter(lessonHasContent).length, 0);
  const processing = curriculum.modules.some((item) => item.lessons.some((lesson) => lesson.video?.kind === "bunny" && lesson.video.status !== "ready"));
  const busy = pending || statusPending || removing;
  const blockers = [
    ...new Set([
      ...missingBasics,
      ...missingPricing,
      ...publishProblems(
        { type: "course", courseLessons: readyLessons, title: values.title, priceCents: priceCents ?? 0, salePriceCents, externalUrl: null, deliveryType: "link", fileId: null },
        paymentsOk,
      ),
    ]),
  ];
  const next = nextCourseStep(step);
  const previous = previousCourseStep(step);
  const badge = STATUS_BADGE[values.status];

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
            <h1 className="min-w-0 truncate font-display text-h1">{values.title.trim() || "Untitled course"}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <Button type="submit" variant="secondary" loading={pending && !goAfterSave} disabled={removing} onClick={() => setGoAfterSave(null)}>
            Save
          </Button>
        </div>

        <nav aria-label="Course steps">
          <ol className="grid grid-cols-4 gap-2">
            {COURSE_STEPS.map((id, index) => {
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
                        <Icon aria-hidden="true" className="hidden size-4 shrink-0 text-mute lg:block" />
                        {/* Phones get the short name so all four steps fit side by side. */}
                        <span className="sm:hidden">{COURSE_STEP_SHORT_LABELS[id]}</span>
                        <span className="hidden truncate sm:inline">{COURSE_STEP_LABELS[id]}</span>
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
          {step === "basic" && (
            <>
              <StepHeading title="Basic info" body="What your course is called, what students will learn and who it is for." />
              <Field id="title" label="Course title" error={fieldError("title")} hint={`${values.title.length}/${PRODUCT_LIMITS.title}`}>
                <Input id="title" value={values.title} maxLength={PRODUCT_LIMITS.title} onChange={(event) => set("title", event.target.value)} aria-invalid={!!fieldError("title")} placeholder="Advanced UI/UX Design Masterclass" />
              </Field>
              <RichTextEditor id="descriptionDoc" label="Description (optional)" value={values.descriptionDoc} onChange={(doc) => set("descriptionDoc", doc)} error={fieldError("descriptionDoc")} />
              <ImageUploader id="coverUrl" label="Cover image (optional)" kind="cover" shape="wide" value={values.coverUrl} onChange={(value) => set("coverUrl", value)} error={fieldError("coverUrl")} hint="The banner on your store and course page. JPG, PNG, WebP or GIF, up to 5 MB." />
              <Field id="category" label="Category" error={fieldError("category")} hint="Helps students understand what the course is about.">
                <NativeSelect id="category" value={values.category} onChange={(event) => set("category", event.target.value as EditorCourse["category"])} aria-invalid={!!fieldError("category")}>
                  <NativeSelectOption value="">Pick a category</NativeSelectOption>
                  {COURSE_CATEGORIES.map((category) => (
                    <NativeSelectOption key={category} value={category}>
                      {COURSE_CATEGORY_LABELS[category]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <TagsField tags={values.tags} onChange={(tags) => set("tags", tags)} error={fieldError("tags")} />
            </>
          )}

          {step === "pricing" && (
            <>
              <StepHeading title="Pricing & access" body="Sell it, or give it away free as a lead magnet, and decide how long students keep it." />
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold">Price type</legend>
                <ToggleGroup
                  type="single"
                  variant="segment"
                  aria-label="Price type"
                  value={values.pricing}
                  onValueChange={(value) => value && set("pricing", value as EditorCourse["pricing"])}
                  className="grid w-full grid-cols-2"
                >
                  <ToggleGroupItem value="paid">
                    <CreditCard aria-hidden="true" />
                    Paid
                  </ToggleGroupItem>
                  <ToggleGroupItem value="free">
                    <BookOpen aria-hidden="true" />
                    Free
                  </ToggleGroupItem>
                </ToggleGroup>
                {values.pricing === "free" && <p className="text-sm text-mute">Students enroll with their name and email, at no cost.</p>}
              </fieldset>

              {values.pricing === "paid" && (
                <fieldset className="flex flex-col gap-4">
                  <legend className="sr-only">Price</legend>
                  <Field id="price" label="Price" error={fieldError("price")} hint={`In ${currency.toUpperCase()}.`}>
                    <MoneyInput id="price" currency={currency} value={values.price} onChange={(value) => set("price", value)} invalid={!!fieldError("price")} />
                  </Field>
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md border border-line px-4 py-3">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">Add a discount</span>
                      <span className="text-sm text-mute">Students pay a lower price; the regular price shows struck through.</span>
                    </span>
                    <Switch checked={values.discountOn} onCheckedChange={(checked) => set("discountOn", checked)} aria-label="Add a discount" />
                  </label>
                  {values.discountOn && (
                    <Field id="salePrice" label="Discounted price" error={fieldError("salePrice")} hint={saving > 0 ? `Students pay this instead. That is ${saving}% off.` : "Students pay this instead of the price above."}>
                      <MoneyInput id="salePrice" currency={currency} value={values.salePrice} onChange={(value) => set("salePrice", value)} invalid={!!fieldError("salePrice")} />
                    </Field>
                  )}
                </fieldset>
              )}

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold">Course access</legend>
                <ToggleGroup
                  type="single"
                  variant="segment"
                  aria-label="Course access"
                  value={values.access}
                  onValueChange={(value) => value && set("access", value as EditorCourse["access"])}
                  className="grid w-full grid-cols-2"
                >
                  <ToggleGroupItem value="lifetime">
                    <InfinityIcon aria-hidden="true" />
                    Lifetime
                  </ToggleGroupItem>
                  <ToggleGroupItem value="days">
                    <Clock aria-hidden="true" />
                    Limited time
                  </ToggleGroupItem>
                </ToggleGroup>
                {values.access === "days" ? (
                  <Field id="accessDays" label="Access period" error={fieldError("accessDays")} hint={`Counted from the day a student buys. 1 to ${COURSE_LIMITS.accessDaysMax} days.`}>
                    <InputGroup className={cn("max-w-56", fieldError("accessDays") && "border-danger")}>
                      <InputGroupInput
                        id="accessDays"
                        inputMode="numeric"
                        value={values.accessDays}
                        onChange={(event) => set("accessDays", event.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="365"
                        aria-invalid={!!fieldError("accessDays")}
                        className="px-3 tabular-nums"
                      />
                      <InputGroupAddon align="inline-end">days</InputGroupAddon>
                    </InputGroup>
                  </Field>
                ) : (
                  <p className="text-sm text-mute">Students keep access for as long as your store is open.</p>
                )}
              </fieldset>
            </>
          )}

          {step === "curriculum" && (
            <>
              <StepHeading title="Curriculum" body="Modules and lessons: videos, attachments and written notes." />
              <CurriculumBuilder courseId={values.id} curriculum={curriculum} videoUploadReady={videoUploadReady} onChange={setCurriculum} />
            </>
          )}

          {step === "publish" && (
            <>
              <StepHeading title="Publish" body="How the course opens for students, a look at the student view, then publish." />
              <ReleaseSection courseId={values.id} drip={values.drip} modules={curriculum.modules} onSaved={(drip, modules) => (set("drip", drip), setCurriculum({ modules }))} />
              <section aria-labelledby="ready-title" className={cn("flex flex-col gap-3 rounded-md border p-4", blockers.length === 0 ? "border-mint/40 bg-mint-soft" : "border-line")}>
                <h3 id="ready-title" className="font-display text-h4">
                  {values.status === "published" ? "This course is live" : blockers.length === 0 ? "Ready to publish" : "Before you publish"}
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
              {processing && <p className="text-sm text-mute">Some videos are still being processed. Students see them as soon as Bunny finishes.</p>}
              <Button asChild variant="secondary" className="self-start">
                <Link href={`/dashboard/products/${values.id}/preview`} target="_blank" rel="noopener">
                  <Eye aria-hidden="true" className="size-4" />
                  Preview as a student
                </Link>
              </Button>

              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
                  {confirmDelete ? (
                    <>
                      <span className="text-sm font-medium">Delete &ldquo;{values.title.trim() || "Untitled course"}&rdquo;? Students who bought it keep access.</span>
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
                      Delete course
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
                {fromSetup ? "Save, publish & continue setup" : "Save and publish"}
              </Button>
            )}
          </div>
        </Card>

        <aside aria-label="Preview" className="xl:sticky xl:top-22 xl:self-start">
          <CoursePreview values={values} currency={currency} price={previewPrice} lessons={lessonCount(curriculum)} modules={curriculum.modules.length} />
        </aside>
      </div>
    </form>
  );
}

/** Up to 5 short tags: type and press Enter (or Add), remove with the x on each. */
function TagsField({ tags, onChange, error }: { tags: string[]; onChange: (tags: string[]) => void; error: string | null }) {
  const [draft, setDraft] = useState("");
  const full = tags.length >= COURSE_LIMITS.tagsMax;
  const add = () => {
    const tag = draft.trim().replace(/\s+/g, " ").slice(0, COURSE_LIMITS.tag);
    if (tag && !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase()) && !full) onChange([...tags, tag]);
    setDraft("");
  };
  return (
    <Field id="tags" label="Tags (optional)" error={error} hint={`Up to ${COURSE_LIMITS.tagsMax}, like "figma" or "beginners". Press Enter to add.`}>
      <div className="flex gap-2">
        <Input
          id="tags"
          value={draft}
          maxLength={COURSE_LIMITS.tag}
          disabled={full}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={full ? "Tag limit reached" : "Add a tag"}
          aria-invalid={!!error}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={full || !draft.trim()}>
          <Plus aria-hidden="true" className="size-4" />
          Add
        </Button>
      </div>
      {tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag}>
              <Badge variant="example" className="gap-1 py-1 pr-1 pl-2.5 text-sm">
                <Tag aria-hidden="true" className="size-3.5" />
                {tag}
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove tag ${tag}`} onClick={() => onChange(tags.filter((value) => value !== tag))} className="size-6 rounded-full">
                  <X aria-hidden="true" className="size-3.5" />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}

/** Live course card preview, drawn with our tokens (the creator's own theme applies on the store). */
function CoursePreview({ values, currency, price, lessons, modules }: { values: EditorCourse; currency: string; price: Priced | null; lessons: number; modules: number }) {
  const cover = safeImageSrc(values.coverUrl);
  const description = plainTextOf(values.descriptionDoc);
  const days = Number(values.accessDays);
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
          {values.category && <Badge variant="draft">{COURSE_CATEGORY_LABELS[values.category]}</Badge>}
          <p className="font-display text-h4 break-words">{values.title.trim() || "Untitled course"}</p>
          {description && <p className="line-clamp-3 text-sm whitespace-pre-line text-mute">{description}</p>}
          <p className="font-display text-money-m">{values.pricing === "free" ? "Free" : price ? <PriceTag product={price} currency={currency} regularClassName="text-mute" /> : "Set a price"}</p>
          <span className="flex h-11 items-center justify-center rounded-md bg-primary text-button text-primary-foreground">{values.pricing === "free" ? "Enroll for free" : "Enroll now"}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm text-mute">
        <li className="flex items-center gap-2">
          <ListTree aria-hidden="true" className="size-4" />
          {lessons === 0 ? "No lessons yet" : `${modules} ${modules === 1 ? "module" : "modules"}, ${lessons} ${lessons === 1 ? "lesson" : "lessons"}`}
        </li>
        <li className="flex items-center gap-2">
          <Clock aria-hidden="true" className="size-4" />
          {values.access === "days" && days >= 1 ? accessLabel(days) : accessLabel(null)}
        </li>
      </ul>
    </Card>
  );
}

/** All lessons at once, or drip: each module opens a set number of days after purchase (D-056). */
function ReleaseSection({ courseId, drip: savedDrip, modules, onSaved }: { courseId: string; drip: boolean; modules: EditorModule[]; onSaved: (drip: boolean, modules: EditorModule[]) => void }) {
  const [drip, setDrip] = useState(savedDrip);
  const [days, setDays] = useState<Record<string, string>>(() => Object.fromEntries(modules.map((item) => [item.id, String(item.dripDays ?? 0)])));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ at: number } | null>(null);
  const showSaved = useAutoHide(saved);

  const dayOf = (id: string) => {
    const value = Number(days[id] ?? "0");
    return Number.isInteger(value) ? value : NaN;
  };
  const changed = drip !== savedDrip || modules.some((item) => dayOf(item.id) !== (item.dripDays ?? 0));

  const save = async () => {
    setSaving(true);
    setProblem(null);
    const result = await saveCourseRelease(courseId, { drip, modules: modules.map((item) => ({ id: item.id, dripDays: dayOf(item.id) })) });
    setSaving(false);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setSaved({ at: result.data.savedAt });
    onSaved(drip, modules.map((item) => ({ ...item, dripDays: dayOf(item.id) })));
  };

  return (
    <section aria-labelledby="release-title" className="flex flex-col gap-3 rounded-md border border-line p-4">
      <h3 id="release-title" className="font-display text-h4">
        How lessons open
      </h3>
      <ToggleGroup type="single" variant="segment" aria-label="How lessons open" value={drip ? "drip" : "all"} onValueChange={(value) => value && setDrip(value === "drip")} className="grid w-full grid-cols-2">
        <ToggleGroupItem value="all">
          <BookOpen aria-hidden="true" />
          All at once
        </ToggleGroupItem>
        <ToggleGroupItem value="drip">
          <CalendarClock aria-hidden="true" />
          Drip
        </ToggleGroupItem>
      </ToggleGroup>
      {!drip ? (
        <p className="text-sm text-mute">Students get every lesson as soon as they buy.</p>
      ) : modules.length === 0 ? (
        <p className="text-sm text-mute">Add modules in the Curriculum step, then set when each one opens.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {modules.map((item) => {
            const value = dayOf(item.id);
            return (
              <li key={item.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{item.title}</span>
                  <span className="text-xs text-mute">{Number.isNaN(value) ? "Enter a number of days" : unlockLabel(true, value)}</span>
                </span>
                <InputGroup className="h-10 w-36 shrink-0">
                  <InputGroupAddon className="text-xs">Day</InputGroupAddon>
                  <InputGroupInput
                    aria-label={`Days after purchase when ${item.title} opens`}
                    inputMode="numeric"
                    value={days[item.id] ?? "0"}
                    onChange={(event) => setDays((current) => ({ ...current, [item.id]: event.target.value.replace(/\D/g, "").slice(0, 3) }))}
                    // Enter saves these days, not the course editor's form around them.
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      void save();
                    }}
                    className="px-2 tabular-nums"
                  />
                </InputGroup>
              </li>
            );
          })}
        </ul>
      )}
      {drip && <p className="text-xs text-mute">Day 0 opens right away. Days count from each student&apos;s purchase, up to {DRIP_DAYS_MAX}.</p>}
      {problem && (
        <Alert variant="error">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={save} loading={saving} disabled={!changed}>
          Save how lessons open
        </Button>
        {saved && showSaved && (
          <span className="flex items-center gap-1 text-sm text-mint" role="status">
            <Check aria-hidden="true" className="size-4" />
            Saved
          </span>
        )}
      </div>
    </section>
  );
}

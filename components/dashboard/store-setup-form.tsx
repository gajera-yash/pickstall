"use client";

import { ArrowRight, Check, CheckCircle2, Circle, Eye, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type FormEvent } from "react";

import { CurrencyPicker } from "@/components/dashboard/currency-picker";
import { SocialLinksFields, type SocialValues } from "@/components/dashboard/social-links-fields";
import { StorePreview, type PreviewProduct } from "@/components/dashboard/store-preview";
import { ThemeFields, accentReadable } from "@/components/dashboard/theme-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FormField, describedBy } from "@/components/ui/form-field";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { IconInput } from "@/components/ui/icon-input";
import { useAutoHide } from "@/components/ui/use-auto-hide";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SOCIAL_LINK_KINDS, type Currency, type SocialLinkKind } from "@/lib/config";
import { errorFor } from "@/lib/result";
import { saveStoreSetup, type StoreSetupState } from "@/lib/stores/actions";
import { STORE_BIO_MAX_LENGTH, STORE_NAME_MAX_LENGTH } from "@/lib/stores/schemas";
import { checkSocialValue, displayValueFor, socialFieldName } from "@/lib/stores/social-handles";
import { THEME_PRESETS, type ThemePresetId } from "@/lib/themes";
import { cn } from "@/lib/utils";

type Values = {
  name: string;
  bio: string;
  avatarUrl: string;
  currency: Currency;
  socialLinks: { kind: SocialLinkKind; url: string }[];
};

type Props = {
  initial: Values;
  slug: string;
  /** Edited here only in the setup wizard; in Settings it lives on My Store > Page design. */
  theme: { preset: ThemePresetId; accent: string };
  /**
   * "setup": step 1 of the setup wizard (D-045). Adds the theme fields and a done/to-do summary,
   * and "Save and continue" goes to `continueHref` after a successful save.
   */
  mode?: "settings" | "setup";
  continueHref?: string;
  products?: PreviewProduct[];
  /** True once the store has a product: prices are in this currency, so it cannot change (D-046). */
  currencyLocked?: boolean;
  /** Currencies the payment provider takes (PayPal, D-118); all when missing. */
  allowedCurrencies?: readonly Currency[];
};

const NAME_REQUIRED = "Enter a store name.";

/** One value per platform row, filled from the saved links (usernames, email or website). */
const toSocialValues = (links: Values["socialLinks"]): SocialValues => {
  const values = Object.fromEntries(SOCIAL_LINK_KINDS.map((kind) => [kind, ""])) as SocialValues;
  for (const link of links) if (values[link.kind] === "") values[link.kind] = displayValueFor(link.kind, link.url);
  return values;
};

/** The links the rows make right now, valid ones only (for the preview and the summary). */
const linksFrom = (social: SocialValues) =>
  SOCIAL_LINK_KINDS.flatMap((kind) => {
    const check = checkSocialValue(kind, social[kind]);
    return check?.ok ? [{ kind, url: check.url }] : [];
  });

const snapshot = (values: Omit<Values, "socialLinks">, social: SocialValues, design: { preset: ThemePresetId; accent: string }) =>
  JSON.stringify([values, SOCIAL_LINK_KINDS.map((kind) => social[kind].trim()), design.preset, design.accent.toUpperCase()]);

/**
 * Store setup (PRD F8, DESIGN.md 10.3 and 9.13): profile cards in one column with a sticky live
 * preview on wide screens (behind a Preview button otherwise), social links list, unsaved-changes
 * guard, and "Saving..." then "Saved" on the button.
 */
export function StoreSetupForm({ initial, slug, theme, mode = "settings", continueHref, products, currencyLocked = false, allowedCurrencies }: Props) {
  const router = useRouter();
  const setup = mode === "setup";
  const [state, action, pending] = useActionState<StoreSetupState, FormData>(saveStoreSetup, null);
  const { socialLinks: initialLinks, ...initialFields } = initial;
  const [values, setValues] = useState(initialFields);
  const [social, setSocial] = useState<SocialValues>(() => toSocialValues(initialLinks));
  const [design, setDesign] = useState(theme);
  const [saved, setSaved] = useState(() => snapshot(initialFields, toSocialValues(initialLinks), theme));

  const current = snapshot(values, social, design);
  const dirty = current !== saved;
  // Step 1 counts as done with a photo or a bio (lib/dashboard/checklist.ts), so the wizard asks for one.
  const links = linksFrom(social);
  const linkCount = links.length;

  const set = <K extends keyof typeof values>(field: K, value: (typeof values)[K]) => setValues((prev) => ({ ...prev, [field]: value }));
  const setSocialValue = (kind: SocialLinkKind, value: string) => setSocial((prev) => ({ ...prev, [kind]: value }));

  const error = state && !state.ok ? state : null;
  // What was sent with the last save: a server message stays on a field only until that field changes
  // (QA 2026-11: the Instagram error stayed on the emptied, optional field).
  const [sent, setSent] = useState<{ values: typeof values; social: SocialValues } | null>(null);
  const unchangedSince = (field: string) => {
    if (!sent) return true;
    const kind = SOCIAL_LINK_KINDS.find((item) => socialFieldName(item) === field);
    if (kind) return sent.social[kind] === social[kind];
    return field in values ? sent.values[field as keyof typeof values] === values[field as keyof typeof values] : true;
  };
  // Checked in the browser before sending, so an empty name gets its message under the field.
  const [nameMissing, setNameMissing] = useState(false);
  const fieldError = (field: string) => {
    if (field === "name" && nameMissing && !values.name.trim()) return NAME_REQUIRED;
    return unchangedSince(field) ? errorFor(error, field) : null;
  };
  const designError = (field: "themePreset" | "accent") => fieldError(field);
  const formError = error && !error.field ? error.error : null;
  const justSaved = useAutoHide(state?.ok ? state : null) && !dirty;

  // What was sent becomes the saved snapshot when the result comes back ok.
  const [submitted, setSubmitted] = useState(saved);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setSaved(submitted);
  }

  // In the wizard a successful save moves straight on to the next step.
  useEffect(() => {
    if (setup && state?.ok && continueHref) {
      router.push(continueHref);
      router.refresh();
    }
  }, [setup, state, continueHref, router]);

  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (!values.name.trim()) {
      event.preventDefault();
      setNameMissing(true);
      document.getElementById("name")?.focus();
      return;
    }
    setNameMissing(false);
    setSubmitted(current);
    setSent({ values, social });
  };

  // Unsaved-changes guard (DESIGN.md 9.13).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const previewData = {
    slug,
    name: values.name,
    bio: values.bio,
    avatarUrl: values.avatarUrl,
    socialLinks: links,
    themePreset: design.preset,
    accent: design.accent,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <form action={action} onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-6">
        {justSaved && (
          <Alert variant="success">
            <AlertDescription>Your store is saved.</AlertDescription>
          </Alert>
        )}
        {formError && (
          <Alert variant="error">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {setup && (
          <SetupSummary
            items={[
              { label: "Store name", done: Boolean(values.name.trim()), detail: values.name.trim() || "Missing" },
              { label: "Profile photo", done: Boolean(values.avatarUrl.trim()), detail: values.avatarUrl.trim() ? "Added" : "Optional" },
              { label: "Bio", done: Boolean(values.bio.trim()), detail: values.bio.trim() ? "Added" : "Optional" },
              { label: "Theme", done: true, detail: THEME_PRESETS[design.preset].name },
              { label: "Social links", done: linkCount > 0, detail: linkCount > 0 ? `${linkCount} added` : "Optional" },
            ]}
            hint={null}
          />
        )}

        <Card>
          <CardHeader>
            <h2 className="font-display text-h3">Profile</h2>
            <p className="text-sm text-mute">What buyers see at the top of your store page.</p>
          </CardHeader>

          <FormField id="name" label="Store name" error={fieldError("name")} hint={`${values.name.trim().length}/${STORE_NAME_MAX_LENGTH}`}>
            <IconInput
              icon={Store}
              id="name"
              name="name"
              required
              maxLength={STORE_NAME_MAX_LENGTH}
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              aria-invalid={fieldError("name") ? true : undefined}
              aria-describedby={describedBy("name", fieldError("name"), "hint")}
            />
          </FormField>

          <input type="hidden" name="avatarUrl" value={values.avatarUrl} />
          <ImageUploader
            id="avatarUrl"
            label="Profile photo (optional)"
            kind="avatar"
            value={values.avatarUrl}
            onChange={(value) => set("avatarUrl", value)}
            error={fieldError("avatarUrl")}
          />

          <FormField id="bio" label="Bio (optional)" error={fieldError("bio")} hint={`${values.bio.length}/${STORE_BIO_MAX_LENGTH}`}>
            <Textarea
              id="bio"
              name="bio"
              rows={3}
              maxLength={STORE_BIO_MAX_LENGTH}
              placeholder="I teach busy people to cook in 20 minutes."
              value={values.bio}
              onChange={(event) => set("bio", event.target.value)}
              aria-invalid={fieldError("bio") ? true : undefined}
              aria-describedby={describedBy("bio", fieldError("bio"), "hint")}
            />
          </FormField>
        </Card>

        {setup && (
          <Card>
            <CardHeader>
              <h2 className="font-display text-h3">Theme and color</h2>
              <p className="text-sm text-mute">Pick a look for your store page. You can change it any time.</p>
            </CardHeader>
            <ThemeFields
              themePreset={design.preset}
              accent={design.accent}
              onThemePreset={(preset) => setDesign((prev) => ({ ...prev, preset }))}
              onAccent={(accent) => setDesign((prev) => ({ ...prev, accent }))}
              fieldError={designError}
            />
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="font-display text-h3">Social links</h2>
            <p className="text-sm text-mute">Type just your username. We build the link and show the logo under your bio. Leave a row empty to hide it.</p>
          </CardHeader>
          <SocialLinksFields values={social} onChange={setSocialValue} fieldError={fieldError} />
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-h3">Currency</h2>
          </CardHeader>
          <CurrencyPicker value={values.currency} onChange={(currency) => set("currency", currency)} locked={currencyLocked} error={fieldError("currency")} allowed={allowedCurrencies} />
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          {setup ? (
            <Button type="submit" loading={pending} disabled={!accentReadable(design.accent)}>
              {pending ? "Saving..." : "Save and continue"}
              {!pending && <ArrowRight aria-hidden="true" />}
            </Button>
          ) : (
          <Button type="submit" loading={pending} disabled={!dirty && !pending}>
            {pending ? "Saving..." : justSaved ? (
              <>
                <Check aria-hidden="true" />
                Saved
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="secondary" className="xl:hidden">
                <Eye aria-hidden="true" />
                Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-bg-subtle sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Preview</DialogTitle>
              </DialogHeader>
              <StorePreview data={previewData} products={products} currency={values.currency} />
            </DialogContent>
          </Dialog>
          {dirty && !pending && <p className="text-sm text-mute">You have unsaved changes.</p>}
        </div>
      </form>

      <div className="hidden flex-col gap-3 xl:sticky xl:top-20 xl:flex">
        <p className="text-sm font-semibold text-mute">Live preview</p>
        <StorePreview data={previewData} products={products} currency={values.currency} />
      </div>
    </div>
  );
}

/** What step 1 of the wizard has and still needs, updated as the creator types. */
function SetupSummary({ items, hint }: { items: { label: string; done: boolean; detail: string }[]; hint: string | null }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <h2 className="font-display text-h3">Your store so far</h2>
        <p className="text-sm text-mute">This list updates as you fill in the form.</p>
      </CardHeader>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.label} className={cn("flex items-center gap-3 rounded-lg border border-line px-3 py-2.5", item.done ? "bg-bg-subtle" : "bg-surface")}>
            {item.done ? (
              <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 fill-mint text-surface" />
            ) : (
              <Circle aria-hidden="true" className="size-5 shrink-0 text-mute" />
            )}
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">
                {item.label}
                <span className="sr-only">{item.done ? " (done)" : " (not done)"}</span>
              </span>
              <span className="truncate text-xs text-mute">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {hint && <p className="text-sm font-medium text-warning">{hint}</p>}
    </Card>
  );
}

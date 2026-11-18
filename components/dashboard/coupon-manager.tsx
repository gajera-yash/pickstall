"use client";

import { Percent, Plus, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import { Field, MoneyInput } from "@/components/dashboard/editor-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createCouponAction, setCouponActiveAction, type CreateCouponState } from "@/lib/coupons/actions";

export type ManagedCoupon = {
  id: string;
  code: string;
  label: string;
  products: string;
  uses: string;
  ends: string | null;
  expired: boolean;
  active: boolean;
};

type Props = { coupons: ManagedCoupon[]; products: { id: string; title: string }[]; currency: string };

/**
 * Coupons on the Marketing page (D-088): the store's codes with their discount, products, uses and
 * end date, an on/off switch each, and "New coupon". Buyers enter a code at checkout.
 */
export function CouponManager({ coupons, products, currency }: Props) {
  return (
    <Card className="gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-display text-h3">
            <Percent aria-hidden="true" className="size-5 text-blue" />
            Coupons
          </h2>
          <p className="text-sm text-mute">Discount codes buyers enter at checkout.</p>
        </div>
        <NewCouponDialog products={products} currency={currency} />
      </div>

      {coupons.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center">
          <Tag aria-hidden="true" className="size-6 text-mute" />
          <p className="font-semibold">No coupons yet</p>
          <p className="text-sm text-mute">Create a code like SAVE20 and share it with your audience.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {coupons.map((coupon) => (
            <CouponRow key={coupon.id} coupon={coupon} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function CouponRow({ coupon }: { coupon: ManagedCoupon }) {
  const router = useRouter();
  const [active, setActive] = useState(coupon.active);
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const toggle = (next: boolean) => {
    setProblem(null);
    setActive(next);
    startTransition(async () => {
      const result = await setCouponActiveAction(coupon.id, next);
      if (!result.ok) {
        setActive(!next);
        setProblem(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{coupon.code}</span>
          <Badge variant="draft">{coupon.label}</Badge>
          {coupon.expired ? <Badge variant="draft">Ended</Badge> : !active ? <Badge variant="draft">Off</Badge> : <Badge variant="live">Active</Badge>}
        </span>
        <span className="text-sm text-mute">
          {coupon.products} · {coupon.uses}
          {coupon.ends ? ` · ${coupon.expired ? "Ended" : "Ends"} ${coupon.ends}` : ""}
        </span>
        {problem && (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <Switch checked={active} onCheckedChange={toggle} disabled={pending} aria-label={`${coupon.code} is ${active ? "on" : "off"}`} />
        {active ? "On" : "Off"}
      </label>
    </li>
  );
}

type FormValues = { code: string; kind: "percent" | "amount"; percentOff: string; amountOff: string; allProducts: boolean; productIds: string[]; maxRedemptions: string; oncePerEmail: boolean; expiresOn: string };

const EMPTY: FormValues = { code: "", kind: "percent", percentOff: "", amountOff: "", allProducts: true, productIds: [], maxRedemptions: "", oncePerEmail: false, expiresOn: "" };

function NewCouponDialog({ products, currency }: { products: { id: string; title: string }[]; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [state, action, pending] = useActionState<CreateCouponState, FormData>(createCouponAction, null);
  const [, startSave] = useTransition();
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  const error = state && !state.ok ? state : null;
  const fieldError = (field: string) => (error?.field === field ? error.error : null);

  // A saved coupon closes the dialog and refreshes the list (state adjusted while rendering).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) {
      setOpen(false);
      setValues(EMPTY);
    }
  }
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  // The end date is the end of that day in the creator's own time zone.
  const expiresAt = values.expiresOn ? new Date(`${values.expiresOn}T23:59:59`).toISOString() : "";
  const payload = JSON.stringify({
    code: values.code,
    kind: values.kind,
    percentOff: values.kind === "percent" ? values.percentOff : "",
    amountOff: values.kind === "amount" ? values.amountOff : "",
    productIds: values.allProducts ? null : values.productIds,
    maxRedemptions: values.maxRedemptions,
    oncePerEmail: values.oncePerEmail,
    expiresAt,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus aria-hidden="true" className="size-4" />
          New coupon
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New coupon</DialogTitle>
          <DialogDescription>Buyers type the code at checkout. The discount comes off the price they would pay.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startSave(() => action(data));
          }}
        >
          <input type="hidden" name="payload" value={payload} />
          {error && !error.field && (
            <Alert variant="error">
              <AlertDescription>{error.error}</AlertDescription>
            </Alert>
          )}
          <Field id="code" label="Code" error={fieldError("code")} hint="3 to 20 letters, numbers, - or _.">
            <Input id="code" value={values.code} maxLength={20} onChange={(event) => set("code", event.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="SAVE20" className="font-mono uppercase" aria-invalid={!!fieldError("code")} />
          </Field>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">Discount</legend>
            <ToggleGroup type="single" variant="segment" aria-label="Discount type" value={values.kind} onValueChange={(value) => value && set("kind", value as FormValues["kind"])} className="grid w-full grid-cols-2">
              <ToggleGroupItem value="percent">Percent</ToggleGroupItem>
              <ToggleGroupItem value="amount">Fixed amount</ToggleGroupItem>
            </ToggleGroup>
            {values.kind === "percent" ? (
              <Field id="percentOff" label="Percent off" error={fieldError("percentOff")}>
                <Input id="percentOff" inputMode="numeric" value={values.percentOff} onChange={(event) => set("percentOff", event.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="20" className="max-w-32 tabular-nums" aria-invalid={!!fieldError("percentOff")} />
              </Field>
            ) : (
              <Field id="amountOff" label="Amount off" error={fieldError("amountOff")} hint={`In ${currency.toUpperCase()}.`}>
                <MoneyInput id="amountOff" currency={currency} value={values.amountOff} onChange={(value) => set("amountOff", value)} invalid={!!fieldError("amountOff")} />
              </Field>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">Products</legend>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={values.allProducts} onCheckedChange={(checked) => set("allProducts", checked === true)} />
              Works for every product
            </label>
            {!values.allProducts && (
              <ul id="productIds" tabIndex={-1} className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-lg border border-line p-3">
                {products.length === 0 ? (
                  <li className="text-sm text-mute">You have no products yet.</li>
                ) : (
                  products.map((product) => (
                    <li key={product.id}>
                      <label className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={values.productIds.includes(product.id)}
                          onCheckedChange={(checked) => set("productIds", checked === true ? [...values.productIds, product.id] : values.productIds.filter((id) => id !== product.id))}
                        />
                        <span className="min-w-0 truncate">{product.title}</span>
                      </label>
                    </li>
                  ))
                )}
              </ul>
            )}
            {fieldError("productIds") && <p className="text-sm text-danger">{fieldError("productIds")}</p>}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="maxRedemptions" label="Total uses (optional)" error={fieldError("maxRedemptions")} hint="Empty means no limit.">
              <Input id="maxRedemptions" inputMode="numeric" value={values.maxRedemptions} onChange={(event) => set("maxRedemptions", event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="100" className="tabular-nums" aria-invalid={!!fieldError("maxRedemptions")} />
            </Field>
            <Field id="expiresAt" label="Ends on (optional)" error={fieldError("expiresAt")} hint="Works until the end of that day.">
              <Input id="expiresAt" type="date" value={values.expiresOn} onChange={(event) => set("expiresOn", event.target.value)} aria-invalid={!!fieldError("expiresAt")} />
            </Field>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-line px-4 py-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">One use per buyer</span>
              <span className="text-sm text-mute">Each email can use the code once.</span>
            </span>
            <Switch checked={values.oncePerEmail} onCheckedChange={(checked) => set("oncePerEmail", checked)} aria-label="One use per buyer" />
          </label>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create coupon
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

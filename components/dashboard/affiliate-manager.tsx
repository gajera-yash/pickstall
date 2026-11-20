"use client";

import { Check, Copy, HandCoins, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Field, MoneyInput } from "@/components/dashboard/editor-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createAffiliateAction, recordAffiliatePayoutAction, setAffiliateActiveAction } from "@/lib/affiliates/actions";
import { AFFILIATE_LIMITS, AFFILIATE_PARAM } from "@/lib/affiliates/rules";

export type ManagedAffiliate = {
  id: string;
  name: string;
  email: string | null;
  code: string;
  commissionPercent: number;
  active: boolean;
  orders: number;
  sales: string;
  commission: string;
  paid: string;
  owed: string;
  owedCents: number;
};

/**
 * Affiliates (D-113): each one's link, sales and commission, what the creator recorded as paid and
 * what is still owed. Tracking only: creators pay affiliates themselves, outside the platform.
 */
export function AffiliateManager({ affiliates, currency, storeUrl }: { affiliates: ManagedAffiliate[]; currency: string; storeUrl: string }) {
  return (
    <Card className="gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-display text-h3">
            <Users aria-hidden="true" className="size-5 text-blue" />
            Your affiliates
          </h2>
          <p className="text-sm text-mute">
            {affiliates.length} of {AFFILIATE_LIMITS.perStore}. Sales count when a buyer opens their link, then pays in the same browser tab.
          </p>
        </div>
        {affiliates.length < AFFILIATE_LIMITS.perStore && <NewAffiliateDialog />}
      </div>

      {affiliates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center">
          <Users aria-hidden="true" className="size-6 text-mute" />
          <p className="font-semibold">No affiliates yet</p>
          <p className="text-sm text-mute">Add someone who will share your store, and give them their own link.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {affiliates.map((affiliate) => (
            <AffiliateRow key={affiliate.id} affiliate={affiliate} currency={currency} link={`${storeUrl}?${AFFILIATE_PARAM}=${affiliate.code}`} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function AffiliateRow({ affiliate, currency, link }: { affiliate: ManagedAffiliate; currency: string; link: string }) {
  const router = useRouter();
  const [active, setActive] = useState(affiliate.active);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const toggle = (next: boolean) => {
    setActive(next);
    setProblem(null);
    start(async () => {
      const result = await setAffiliateActiveAction(affiliate.id, next);
      if (!result.ok) {
        setActive(!next);
        setProblem(result.error);
      } else router.refresh();
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setProblem("Couldn't copy. Select the link and copy it yourself.");
    }
  };

  const stats = [
    { label: "Orders", value: String(affiliate.orders) },
    { label: "Sales", value: affiliate.sales },
    { label: "Commission", value: affiliate.commission },
    { label: "Paid", value: affiliate.paid },
    { label: "Owed", value: affiliate.owed },
  ];

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="break-words">{affiliate.name}</span>
            <Badge variant="draft">{affiliate.commissionPercent}%</Badge>
            {active ? <Badge variant="live">Active</Badge> : <Badge variant="draft">Paused</Badge>}
          </p>
          {affiliate.email && <p className="truncate text-sm text-mute">{affiliate.email}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={toggle} disabled={pending} aria-label={`Count sales from ${affiliate.name}'s link`} />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-md bg-bg-subtle px-3 py-2 font-mono text-xs">{link}</code>
        <Button type="button" variant="secondary" size="sm" onClick={copy} className="shrink-0">
          {copied ? <Check aria-hidden="true" className="size-4 text-mint" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col">
            <dt className="text-xs text-mute">{stat.label}</dt>
            <dd className="font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <PayoutDialog affiliate={affiliate} currency={currency} />
        {problem && <p className="text-sm text-danger">{problem}</p>}
      </div>
    </li>
  );
}

const EMPTY = { name: "", email: "", code: "", commissionPercent: "20" };

function NewAffiliateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [problem, setProblem] = useState<{ field?: string; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof EMPTY, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const fieldError = (field: string) => (problem?.field === field ? problem.text : null);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setProblem(null);
    start(async () => {
      const percent = values.commissionPercent.trim() === "" ? NaN : Number(values.commissionPercent);
      const result = await createAffiliateAction({ ...values, commissionPercent: Number.isNaN(percent) ? null : percent });
      if (!result.ok) {
        setProblem({ field: result.field, text: result.error });
        return;
      }
      setOpen(false);
      setValues(EMPTY);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus aria-hidden="true" className="size-4" />
          Add affiliate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add affiliate</DialogTitle>
          <DialogDescription>They get a link with their code. You pay their commission yourself; Pickstall only keeps count.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          {problem && !problem.field && (
            <Alert variant="error">
              <AlertDescription>{problem.text}</AlertDescription>
            </Alert>
          )}
          <Field id="affiliateName" label="Name" error={fieldError("name")}>
            <Input id="affiliateName" value={values.name} maxLength={AFFILIATE_LIMITS.name} onChange={(event) => set("name", event.target.value)} aria-invalid={!!fieldError("name")} />
          </Field>
          <Field id="affiliateEmail" label="Email (optional)" error={fieldError("email")} hint="Only for your records. They are not emailed.">
            <Input id="affiliateEmail" type="email" inputMode="email" value={values.email} onChange={(event) => set("email", event.target.value)} aria-invalid={!!fieldError("email")} />
          </Field>
          <Field id="affiliateCode" label="Code" error={fieldError("code")} hint="In their link: ?ref=code. Letters, numbers and dashes, 3-20.">
            <Input id="affiliateCode" value={values.code} maxLength={20} onChange={(event) => set("code", event.target.value.toLowerCase())} placeholder="asha" aria-invalid={!!fieldError("code")} />
          </Field>
          <Field id="affiliatePercent" label="Commission (%)" error={fieldError("commissionPercent")} hint={`${AFFILIATE_LIMITS.percentMin}% to ${AFFILIATE_LIMITS.percentMax}% of each sale they bring, after refunds.`}>
            <Input
              id="affiliatePercent"
              type="number"
              inputMode="numeric"
              min={AFFILIATE_LIMITS.percentMin}
              max={AFFILIATE_LIMITS.percentMax}
              value={values.commissionPercent}
              onChange={(event) => set("commissionPercent", event.target.value)}
              className="w-28"
              aria-invalid={!!fieldError("commissionPercent")}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Add affiliate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayoutDialog({ affiliate, currency }: { affiliate: ManagedAffiliate; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<{ field?: string; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setProblem(null);
    start(async () => {
      const result = await recordAffiliatePayoutAction(affiliate.id, { amount, note });
      if (!result.ok) {
        setProblem({ field: result.field, text: result.error });
        return;
      }
      setOpen(false);
      setAmount("");
      setNote("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <HandCoins aria-hidden="true" className="size-4" />
          Record a payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment to {affiliate.name}</DialogTitle>
          <DialogDescription>Note a payment you already made (bank transfer, PayPal, UPI). No money moves through Pickstall. Owed now: {affiliate.owed}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          {problem && !problem.field && (
            <Alert variant="error">
              <AlertDescription>{problem.text}</AlertDescription>
            </Alert>
          )}
          <Field id={`payout-${affiliate.id}`} label="Amount paid" error={problem?.field === "amount" ? problem.text : null}>
            <MoneyInput id={`payout-${affiliate.id}`} currency={currency} value={amount} onChange={setAmount} invalid={problem?.field === "amount"} />
          </Field>
          <Field id={`payout-note-${affiliate.id}`} label="Note (optional)" error={problem?.field === "note" ? problem.text : null}>
            <Input id={`payout-note-${affiliate.id}`} value={note} maxLength={AFFILIATE_LIMITS.note} onChange={(event) => setNote(event.target.value)} placeholder="November commission, bank transfer" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

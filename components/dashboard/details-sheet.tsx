"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * A details drawer opened by the URL (`?order=` or `?customer=`), so it can be linked and the back
 * button closes it. The server renders what is inside; closing goes to `closeHref`.
 */
export function DetailsSheet({ closeHref, title, description, children }: { closeHref: string; title: ReactNode; description?: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setOpen(false);
        router.replace(closeHref, { scroll: false });
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">Details</SheetDescription>}
        </SheetHeader>
        <SheetBody>{children}</SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/** A filter <select> that applies itself on change; inside a GET form, so Enter still works without JS. */
export function FilterSelect({ label, name, value, options }: { label: string; name: string; value: string; options: { value: string; label: string }[] }) {
  return (
    <label className="flex min-w-0 flex-col">
      <span className="sr-only">{label}</span>
      <Select name={name} defaultValue={value} onChange={(event) => event.currentTarget.form?.requestSubmit()} className="h-10 text-sm">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

/** Copies a value (an email) with a short confirmation. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-mute transition-colors duration-(--dur-fast) hover:bg-bg-subtle hover:text-ink"
    >
      {copied ? <Check aria-hidden="true" className="size-4 text-mint" /> : <Copy aria-hidden="true" className="size-4" />}
    </button>
  );
}

"use client";

import { Check, ChevronDown, Globe, Lock } from "lucide-react";
import { useMemo, useState } from "react";

import { CountryFlag } from "@/components/auth/country-flag";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Currency } from "@/lib/config";
import { currencyOptions, type CurrencyOption } from "@/lib/currencies";
import { cn } from "@/lib/utils";

/** cmdk filter: a code or name that starts with the search ranks first, then any other match. */
function currencyFilter(value: string, search: string): number {
  const query = search.trim().toLowerCase();
  const text = value.toLowerCase();
  if (query === "") return 1;
  if (text.startsWith(query) || text.split(" ").some((word) => word.startsWith(query))) return 1;
  return text.includes(query) ? 0.5 : 0;
}

function Flag({ option }: { option: CurrencyOption | undefined }) {
  if (!option?.flag) {
    return (
      <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-bg-subtle">
        <Globe className="size-3.5 text-mute" />
      </span>
    );
  }
  return <CountryFlag country={option.flag} />;
}

/**
 * Store currency (D-046): a searchable shadcn Popover + Command list of every Stripe currency with
 * its flag, code and name. Submits one field, `currency`. Locked once the store has a product,
 * because prices are stored in the currency's own units and would change meaning (D-046).
 */
export function CurrencyPicker({
  value,
  onChange,
  locked,
  error,
}: {
  value: Currency;
  onChange: (currency: Currency) => void;
  locked: boolean;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => currencyOptions(), []);
  const current = options.find((option) => option.code === value);
  const hintId = error ? "currency-error" : "currency-hint";

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="currency">Store currency</Label>
      <input type="hidden" name="currency" value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id="currency"
            type="button"
            disabled={locked}
            aria-describedby={hintId}
            className={cn(
              "flex h-11 w-full min-w-0 items-center gap-3 rounded-md border bg-surface px-3 text-left text-field text-ink",
              "hover:bg-bg-subtle disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:hover:bg-bg-subtle",
              error ? "border-danger" : "border-input",
            )}
          >
            <Flag option={current} />
            <span className="font-semibold uppercase tabular-nums">{value}</span>
            <span className="min-w-0 flex-1 truncate text-mute">{current?.name}</span>
            {locked ? (
              <Lock aria-hidden="true" className="size-4 shrink-0 text-mute" />
            ) : (
              <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-mute transition-transform duration-(--dur-fast)", open && "rotate-180")} />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
          <Command filter={currencyFilter}>
            <CommandInput placeholder="Search by name or code" aria-label="Search currencies" />
            <CommandList>
              <CommandEmpty>No currency found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.code}
                    value={`${option.code} ${option.name}`}
                    onSelect={() => {
                      onChange(option.code);
                      setOpen(false);
                    }}
                  >
                    <Flag option={option} />
                    <span className="w-11 shrink-0 font-semibold uppercase tabular-nums">{option.code}</span>
                    <span className="flex-1 truncate">{option.name}</span>
                    <Check aria-hidden="true" className={cn("size-4 text-blue", option.code === value ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? (
        <FieldError id="currency-error">{error}</FieldError>
      ) : (
        <FieldHint id="currency-hint">
          {locked
            ? "Your prices are set in this currency, so it can't change once you have a product."
            : "Prices on your store use this currency. It locks once you add your first product."}
        </FieldHint>
      )}
    </div>
  );
}

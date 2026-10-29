"use client";

import { Check, ChevronDown } from "lucide-react";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";

import { CountryFlag } from "@/components/auth/country-flag";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_HINT,
  composePhone,
  countryFromLocale,
  phoneCountryOptions,
  splitPhone,
  type PhoneCountry,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

const noSubscribe = () => () => {};

/** cmdk filter: names that start with the search rank first, then any other match. */
function countryFilter(value: string, search: string): number {
  const query = search.trim().toLowerCase().replace(/^\+/, "");
  const text = value.toLowerCase();
  if (query === "") return 1;
  if (text.startsWith(query)) return 1;
  return text.includes(query) ? 0.5 : 0;
}

/**
 * Optional phone with a searchable country picker (reference docs/ui-reference/username.webp and
 * the founder's dropdown sketch): flag, dial code and a chevron open a shadcn Popover + Command list
 * with search, flags, names and codes. The form gets one value, `phone`, in international format;
 * the server validates it (optionalPhoneSchema).
 */
export function PhoneField({ error, defaultValue }: { error?: string | null; defaultValue?: string | null }) {
  // The browser's country is the default (the server renders the fallback, so hydration matches).
  const localeCountry = useSyncExternalStore(
    noSubscribe,
    () => countryFromLocale(navigator.language),
    () => DEFAULT_PHONE_COUNTRY,
  );
  // A saved number (Settings > Account) starts with its own country and national number.
  const [saved] = useState(() => splitPhone(defaultValue));
  const [picked, setPicked] = useState<PhoneCountry | null>(saved?.country ?? null);
  const country = picked ?? localeCountry;
  const [national, setNational] = useState(saved?.national ?? "");
  const [open, setOpen] = useState(false);
  const numberRef = useRef<HTMLInputElement>(null);
  // After picking a country, focus goes to the number field; Esc or a click outside returns it to the picker.
  const focusNumberOnClose = useRef(false);

  const options = useMemo(() => phoneCountryOptions(), []);
  const current = options.find((option) => option.country === country);
  const describedBy = error ? "phone-error" : "phone-hint";

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="phone">
        Phone <span className="font-normal text-mute">(optional)</span>
      </Label>
      <input type="hidden" name="phone" value={composePhone(country, national)} />
      <div
        className={cn(
          "flex h-11 w-full min-w-0 items-stretch overflow-hidden rounded-md border bg-surface",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          error ? "border-danger" : "border-input",
        )}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Country code: ${current?.name ?? country} +${current?.dial ?? ""}. Change`}
              className="flex shrink-0 items-center gap-2 border-r border-line pr-3 pl-3 outline-none hover:bg-bg-subtle focus-visible:bg-blue-soft"
            >
              <CountryFlag country={country} />
              <span className="text-field font-medium text-ink tabular-nums">+{current?.dial}</span>
              <ChevronDown aria-hidden="true" className={cn("size-4 text-mute transition-transform duration-(--dur-fast)", open && "rotate-180")} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(20rem,calc(100vw-2rem))] p-0"
            onCloseAutoFocus={(event) => {
              if (!focusNumberOnClose.current) return;
              focusNumberOnClose.current = false;
              event.preventDefault();
              numberRef.current?.focus();
            }}
          >
            <Command
              // Search by country name, ISO code or dial code ("india", "IN", "91" or "+91").
              filter={countryFilter}
            >
              <CommandInput placeholder="Search" aria-label="Search countries" />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.country}
                      value={`${option.name} ${option.country} ${option.dial}`}
                      onSelect={() => {
                        setPicked(option.country);
                        focusNumberOnClose.current = true;
                        setOpen(false);
                        // Focus now, not after the close animation, so typing right away lands in the number.
                        numberRef.current?.focus();
                      }}
                    >
                      <CountryFlag country={option.country} />
                      <span className="flex-1 truncate">{option.name}</span>
                      <span className="text-mute tabular-nums">+{option.dial}</span>
                      <Check
                        aria-hidden="true"
                        className={cn("size-4 text-blue", option.country === country ? "opacity-100" : "opacity-0")}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <input
          ref={numberRef}
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="98765 43210"
          value={national}
          onChange={(event) => setNational(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 bg-transparent px-3 text-field text-ink outline-none placeholder:text-mute"
        />
      </div>
      {error ? <FieldError id="phone-error">{error}</FieldError> : <FieldHint id="phone-hint">{PHONE_HINT}</FieldHint>}
    </div>
  );
}

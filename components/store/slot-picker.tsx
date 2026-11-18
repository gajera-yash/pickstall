"use client";

import { CalendarX2, Globe } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { FieldError } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { durationLabel } from "@/lib/coaching/settings";
import { slotsByDay } from "@/lib/coaching/slots";

const noSubscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

type Props = {
  /** Open call starts from the server's slot engine, as ISO strings. */
  slots: { start: string; end: string }[];
  durationMinutes: number;
  error: string | null;
};

/**
 * The booking calendar at checkout (D-083): a day, then a time, both in the buyer's own time zone
 * (read in the browser). The chosen start and the time zone go to the server as hidden fields; the
 * server checks the start against the slot engine again before it holds it.
 */
export function SlotPicker({ slots, durationMinutes, error }: Props) {
  const timeZone = useSyncExternalStore(noSubscribe, browserTimeZone, () => "");
  const days = useMemo(
    () => (timeZone ? slotsByDay(slots.map((slot) => ({ start: new Date(slot.start), end: new Date(slot.end) })), timeZone) : []),
    [slots, timeZone],
  );
  const [dayKey, setDayKey] = useState<string>("");
  const [start, setStart] = useState<string>("");
  const day = days.find((item) => item.key === dayKey) ?? days[0];

  const dayFormat = useMemo(() => (timeZone ? new Intl.DateTimeFormat(undefined, { timeZone, weekday: "short", day: "numeric", month: "short" }) : null), [timeZone]);
  const longDay = useMemo(() => (timeZone ? new Intl.DateTimeFormat(undefined, { timeZone, weekday: "long", day: "numeric", month: "long" }) : null), [timeZone]);
  const timeFormat = useMemo(() => (timeZone ? new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit" }) : null), [timeZone]);
  const longFormat = useMemo(() => (timeZone ? new Intl.DateTimeFormat(undefined, { timeZone, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : null), [timeZone]);

  return (
    <fieldset id="slotStart" tabIndex={-1} className="flex min-w-0 flex-col gap-4" aria-describedby={error ? "slotStart-error" : undefined}>
      <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-2 text-sm font-semibold">
        <span>Pick a time for your {durationLabel(durationMinutes)} call</span>
      </legend>
      <input type="hidden" name="slotStart" value={start} />
      <input type="hidden" name="buyerTimeZone" value={timeZone} />

      {!timeZone ? (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Loading open times</span>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : days.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center">
          <CalendarX2 aria-hidden="true" className="size-6 text-mute" />
          <p className="font-semibold">No open times right now</p>
          <p className="text-sm text-mute">Every slot is booked. Please check back soon.</p>
        </div>
      ) : (
        <>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label="Day"
            value={day?.key ?? ""}
            onValueChange={(value) => {
              if (!value) return;
              setDayKey(value);
              setStart("");
            }}
            className="flex w-full min-w-0 justify-start gap-2 overflow-x-auto pb-1"
          >
            {days.map((item) => {
              const first = item.slots[0];
              return (
                <ToggleGroupItem key={item.key} value={item.key} aria-label={`${first && longDay ? longDay.format(first.start) : item.key}, ${item.slots.length} ${item.slots.length === 1 ? "time" : "times"} open`} className="min-w-20 shrink-0 flex-col gap-0 rounded-lg border-line py-2 data-[state=on]:border-line">
                  <span>{first && dayFormat ? dayFormat.format(first.start) : item.key}</span>
                  <span className="text-xs font-normal text-mute">
                    {item.slots.length} {item.slots.length === 1 ? "time" : "times"}
                  </span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>

          {day && (
            <ToggleGroup type="single" variant="outline" aria-label="Time" value={start} onValueChange={(value) => value && setStart(value)} className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4">
              {day.slots.map((slot) => (
                <ToggleGroupItem key={slot.start.toISOString()} value={slot.start.toISOString()} className="rounded-lg border-line tabular-nums data-[state=on]:border-line">
                  {timeFormat?.format(slot.start)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}

          <p className="flex items-center gap-1.5 text-xs text-mute">
            <Globe aria-hidden="true" className="size-3.5" />
            Times are in your time zone: {timeZone.replaceAll("_", " ")}
          </p>
          {start && longFormat && (
            <p className="rounded-lg border border-line bg-bg-subtle px-3 py-2 text-sm" aria-live="polite">
              Your call: <span className="font-semibold">{longFormat.format(new Date(start))}</span>
            </p>
          )}
        </>
      )}
      {error && <FieldError id="slotStart-error">{error}</FieldError>}
    </fieldset>
  );
}

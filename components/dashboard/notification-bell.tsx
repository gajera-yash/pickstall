"use client";

import { Bell, BellOff, BellRing, CircleAlert, ReceiptText, RotateCcw, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getNotifications, markNotificationsRead } from "@/lib/notifications/actions";
import type { NotificationItem } from "@/lib/notifications/queries";
import { timeAgo } from "@/lib/notifications/time";
import { cn } from "@/lib/utils";

/** How often the bell checks: often while you look at the dashboard, less when the tab is hidden. */
const VISIBLE_MS = 20_000;
const HIDDEN_MS = 60_000;

const ICONS: Record<NotificationItem["kind"], typeof Bell> = { sale: ReceiptText, refund: RotateCcw, video_ready: Video, video_failed: CircleAlert };

type DesktopAlerts = "unsupported" | NotificationPermission;

/**
 * The live notification bell (D-061): new sales, refunds and lesson videos that finished or failed.
 * It checks every 20 seconds (every minute in a hidden tab), shows an unread count, and with the
 * creator's permission shows a desktop pop-up for news that arrives while the tab is hidden.
 * Opening it marks everything read.
 */
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [alerts, setAlerts] = useState<DesktopAlerts>("unsupported");
  // Ids already seen, so only news that arrives after the page opened makes a pop-up.
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const result = await getNotifications();
    if (!result.ok) return;
    const fresh = result.data.items.filter((item) => !item.read && seen.current !== null && !seen.current.has(item.id));
    seen.current = new Set([...(seen.current ?? []), ...result.data.items.map((item) => item.id)]);
    setItems(result.data.items);
    setUnread(result.data.unread);
    setNow(Date.now());
    setLoaded(true);
    if (fresh.length > 0 && document.hidden && "Notification" in window && Notification.permission === "granted") {
      for (const item of fresh.slice(0, 3)) {
        const popup = new Notification(item.title, { body: item.body, tag: item.id });
        popup.onclick = () => {
          window.focus();
          router.push(item.href);
          popup.close();
        };
      }
    }
  }, [router]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      await load();
      if (!stopped) timer = setTimeout(tick, document.hidden ? HIDDEN_MS : VISIBLE_MS);
    };
    void tick();
    // Coming back to the tab checks right away.
    const onVisible = () => {
      if (document.hidden) return;
      clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    // Read once on the client: the Notification API does not exist on the server.
    const timer = setTimeout(() => setAlerts("Notification" in window ? Notification.permission : "unsupported"), 0);
    return () => clearTimeout(timer);
  }, []);

  const onOpenChange = (open: boolean) => {
    if (!open || unread === 0) return;
    setUnread(0);
    void markNotificationsRead();
  };

  const enableAlerts = async () => {
    if (!("Notification" in window)) return;
    setAlerts(await Notification.requestPermission());
  };

  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <Popover onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={label} className="relative rounded-full data-[state=open]:bg-bg-subtle">
              <Bell aria-hidden="true" />
              {unread > 0 && (
                <span aria-hidden="true" className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] leading-none font-bold text-on-danger tabular-nums">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <p className="border-b border-line px-4 py-3 font-display text-h4">Notifications</p>
        <div aria-live="polite" className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <Empty className="border-0 px-6 py-8">
              <EmptyHeader>
                <EmptyMedia className="size-11 rounded-full bg-bg-subtle text-mute">
                  <BellOff aria-hidden="true" className="size-5" />
                </EmptyMedia>
                <EmptyTitle className="font-sans text-base font-semibold">{loaded ? "You're all caught up" : "Loading..."}</EmptyTitle>
                <EmptyDescription>New sales, refunds and lesson videos show up here as they happen.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {items.map((item) => {
                const Icon = ICONS[item.kind];
                return (
                  <li key={item.id}>
                    <Link href={item.href} className={cn("flex gap-3 px-4 py-3 transition-colors duration-(--dur-fast) hover:bg-bg-subtle", !item.read && "bg-blue-soft/40")}>
                      <span aria-hidden="true" className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", item.kind === "video_failed" ? "bg-danger-soft text-danger" : item.kind === "refund" ? "bg-bg-subtle text-mute" : "bg-mint-soft text-mint")}>
                        <Icon className="size-4" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                          {item.title}
                          {item.test && <Badge variant="testMode">Test</Badge>}
                        </span>
                        <span className="text-sm break-words text-mute">{item.body}</span>
                        <span className="text-xs text-mute">{timeAgo(item.createdAt, now)}</span>
                      </span>
                      {!item.read && <span className="sr-only">(new)</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {alerts !== "unsupported" && alerts !== "granted" && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
            {alerts === "default" ? (
              <>
                <span className="text-xs text-mute">Get a desktop pop-up when the dashboard is in another tab.</span>
                <Button type="button" variant="secondary" size="sm" onClick={enableAlerts} className="shrink-0">
                  <BellRing aria-hidden="true" className="size-4" />
                  Turn on
                </Button>
              </>
            ) : (
              <span className="text-xs text-mute">Desktop pop-ups are blocked. Allow notifications for this site in your browser settings to get them.</span>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

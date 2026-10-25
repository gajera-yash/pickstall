"use client";

import { useCallback, useEffect, useState } from "react";

import { secondsRemaining } from "@/lib/auth/code";
import { OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/config";

export type ResendCooldown = { secondsLeft: number; start: () => void };

/**
 * Countdown for the "Resend code" button. Call `start()` whenever a code is requested.
 * `now` only changes inside the interval callback and in `start`, so render stays pure.
 */
export function useResendCooldown(seconds: number = OTP_RESEND_COOLDOWN_SECONDS): ResendCooldown {
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const secondsLeft = secondsRemaining(endsAt, now);
  const cooling = secondsLeft > 0;

  useEffect(() => {
    if (!cooling) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooling]);

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setEndsAt(t + seconds * 1000);
  }, [seconds]);

  return { secondsLeft, start };
}

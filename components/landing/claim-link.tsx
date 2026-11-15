"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { UsernameField } from "@/components/auth/username-field";
import { Button } from "@/components/ui/button";
import { TRIAL_DAYS } from "@/lib/config";

/**
 * "Claim your stall link": the same live username check as signup, then signup opens with the
 * name filled in. Nothing is reserved here; the store is created at the end of signup.
 */
export function ClaimLink() {
  const router = useRouter();
  const [username, setUsername] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    router.push(username ? `/signup?username=${encodeURIComponent(username)}` : "/signup");
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-4 text-left">
      <UsernameField value={username} onChange={setUsername} />
      <Button type="submit" size="lg" className="w-full">
        Claim my stall
        <ArrowRight aria-hidden="true" />
      </Button>
      <p className="text-center text-xs text-mute">{TRIAL_DAYS}-day free trial. You pick the final link when you create your account.</p>
    </form>
  );
}

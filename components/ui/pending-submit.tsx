"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * A submit button for a server-action form that shows a spinner and stays disabled while the form
 * is being sent, so a slow action cannot be started twice by a second click.
 */
export function PendingSubmit(props: Omit<ComponentProps<typeof Button>, "type" | "loading">) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending} {...props} />;
}

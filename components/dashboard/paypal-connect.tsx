"use client";

import { ExternalLink, KeyRound, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField, describedBy } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { errorFor } from "@/lib/result";
import { connectPayPalAction, disconnectPayPalAction, type PayPalConnectState } from "@/lib/stores/paypal-actions";

type Props = {
  connected: boolean;
  /** "Sandbox" or "Live": the kind of PayPal app the creator must use. */
  modeLabel: string;
  /** The last characters of the connected app's Client ID, to recognise it. */
  clientIdEnd: string | null;
  /** In the setup wizard: where to go once connected (D-045). */
  continueHref?: string;
};

/**
 * Connect a PayPal REST app (D-118): Client ID and Secret, checked on the server with PayPal. Until
 * PayPal partner onboarding exists, this is how a creator's buyers pay straight into their PayPal.
 */
export function PayPalConnect({ connected, modeLabel, clientIdEnd, continueHref }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PayPalConnectState, FormData>(connectPayPalAction, null);
  const [replacing, setReplacing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [disconnecting, startDisconnect] = useTransition();
  const error = state && !state.ok ? state : null;

  useEffect(() => {
    if (!state?.ok) return;
    if (continueHref) router.push(continueHref);
    router.refresh();
  }, [state, continueHref, router]);

  const disconnect = () => {
    setProblem(null);
    startDisconnect(async () => {
      const result = await disconnectPayPalAction();
      setConfirming(false);
      if (!result.ok) setProblem(result.error);
      else router.refresh();
    });
  };

  const showForm = !connected || replacing;

  return (
    <div className="flex flex-col gap-4">
      {state?.ok && (
        <Alert variant={state.data.webhook ? "success" : "warning"}>
          <AlertTitle>PayPal is connected</AlertTitle>
          <AlertDescription>
            {state.data.webhook
              ? "Buyers can now pay you through your own PayPal account."
              : "Saved, but this server's address can't receive PayPal notifications, so orders won't confirm here. This only happens on a local test server."}
          </AlertDescription>
        </Alert>
      )}
      {(error && !error.field) || problem ? (
        <Alert variant="error">
          <AlertDescription>{problem ?? error?.error}</AlertDescription>
        </Alert>
      ) : null}

      {connected && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm">
            Connected {modeLabel} app{clientIdEnd ? <span className="font-mono"> …{clientIdEnd}</span> : null}.
          </p>
          {!replacing && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setReplacing(true)}>
              <KeyRound aria-hidden="true" className="size-4" />
              Use different keys
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={() => setConfirming(true)} disabled={disconnecting}>
            <Unplug aria-hidden="true" className="size-4" />
            Disconnect
          </Button>
        </div>
      )}

      {showForm && (
        <form action={action} noValidate className="flex flex-col gap-4">
          <FormField id="clientId" label="Client ID" error={errorFor(error, "clientId")} hint={`From your ${modeLabel} app on developer.paypal.com.`}>
            <Input
              id="clientId"
              name="clientId"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              required
              maxLength={128}
              aria-invalid={errorFor(error, "clientId") ? true : undefined}
              aria-describedby={describedBy("clientId", errorFor(error, "clientId"), "hint")}
              className="font-mono"
            />
          </FormField>
          <FormField id="secret" label="Secret" error={errorFor(error, "secret")} hint="Stored encrypted. Pickstall never shows it again.">
            <Input
              id="secret"
              name="secret"
              type="password"
              autoComplete="off"
              required
              maxLength={128}
              aria-invalid={errorFor(error, "secret") ? true : undefined}
              aria-describedby={describedBy("secret", errorFor(error, "secret"), "hint")}
              className="font-mono"
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={pending}>
              {connected ? "Save new keys" : "Connect PayPal"}
            </Button>
            {replacing && (
              <Button type="button" variant="ghost" onClick={() => setReplacing(false)} disabled={pending}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}

      {showForm && (
        <details className="rounded-md border border-line px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold">How to get your Client ID and Secret</summary>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-mute">
            <li>You need a PayPal Business account. Sign in with it at developer.paypal.com.</li>
            <li>
              Open <span className="font-semibold text-ink">Apps &amp; Credentials</span> and switch to <span className="font-semibold text-ink">{modeLabel}</span>.
            </li>
            <li>Click Create App, give it a name like &ldquo;Pickstall&rdquo;, choose Merchant, and create it.</li>
            <li>Copy the Client ID and the Secret into the boxes above. We set up the payment notifications for you.</li>
          </ol>
          <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 font-semibold text-blue underline-offset-4 hover:underline">
            Open PayPal Apps &amp; Credentials
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </details>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect PayPal?</DialogTitle>
            <DialogDescription>Buyers can&apos;t pay for your paid products until you connect again. Past orders and refunds in PayPal are not affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={disconnecting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={disconnect} loading={disconnecting}>
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

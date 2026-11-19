"use client";

import { Eye, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Field } from "@/components/dashboard/editor-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveWelcomeEmailAction, sendBroadcastAction, sendTestListEmail } from "@/lib/broadcasts/actions";
import { LIST_EMAIL_LIMITS, renderListEmail } from "@/lib/broadcasts/rules";

type Message = { kind: "success" | "error"; text: string } | null;

/** Subject, message and a live preview of what a subscriber sees, footer included (D-095). */
function EmailFields({
  idPrefix,
  subject,
  body,
  onSubject,
  onBody,
  storeName,
  error,
}: {
  idPrefix: string;
  subject: string;
  body: string;
  onSubject: (value: string) => void;
  onBody: (value: string) => void;
  storeName: string;
  error: { field?: string; text: string } | null;
}) {
  const [preview, setPreview] = useState(false);
  const rendered = renderListEmail({ storeName, subject: subject || "(no subject)", body: body || "(no message)", name: "Asha", unsubscribeUrl: "#" });
  return (
    <div className="flex flex-col gap-4">
      <Field id={`${idPrefix}-subject`} label="Subject" error={error?.field === "subject" ? error.text : null} hint={`${subject.length}/${LIST_EMAIL_LIMITS.subject}`}>
        <Input id={`${idPrefix}-subject`} value={subject} maxLength={LIST_EMAIL_LIMITS.subject} onChange={(event) => onSubject(event.target.value)} aria-invalid={error?.field === "subject" ? true : undefined} />
      </Field>
      <Field
        id={`${idPrefix}-body`}
        label="Message"
        error={error?.field === "body" ? error.text : null}
        hint={`${body.length.toLocaleString("en")}/${LIST_EMAIL_LIMITS.body.toLocaleString("en")}. Plain text; links starting with https:// become clickable. {{customer_name}} adds their first name.`}
      >
        <Textarea id={`${idPrefix}-body`} value={body} rows={10} maxLength={LIST_EMAIL_LIMITS.body} onChange={(event) => onBody(event.target.value)} aria-invalid={error?.field === "body" ? true : undefined} />
      </Field>
      <Button type="button" variant="ghost" className="self-start" onClick={() => setPreview((open) => !open)} aria-expanded={preview}>
        <Eye aria-hidden="true" className="size-4" />
        {preview ? "Hide preview" : "Preview"}
      </Button>
      {preview && (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-bg-subtle p-4">
          <p className="text-sm">
            <span className="font-semibold">{rendered.subject}</span>
          </p>
          <pre className="font-sans text-sm whitespace-pre-wrap text-ink">{rendered.text.replace("Unsubscribe: #", "Unsubscribe (link)")}</pre>
        </div>
      )}
    </div>
  );
}

function Feedback({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
      <AlertDescription>{message.text}</AlertDescription>
    </Alert>
  );
}

/** Writing and sending a broadcast to everyone subscribed (D-095). */
export function BroadcastComposer({ storeName, subscribed, blocked }: { storeName: string; subscribed: number; blocked: string | null }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [testing, startTest] = useTransition();
  const [sending, startSend] = useTransition();

  const test = () =>
    startTest(async () => {
      setError(null);
      const result = await sendTestListEmail({ subject, body });
      if (result.ok) setMessage({ kind: "success", text: `Test sent to ${result.data.to}.` });
      else {
        setError({ field: result.field, text: result.error });
        setMessage(result.field ? null : { kind: "error", text: result.error });
      }
    });

  const send = () =>
    startSend(async () => {
      setError(null);
      const result = await sendBroadcastAction({ subject, body });
      setConfirming(false);
      if (!result.ok) {
        setError({ field: result.field, text: result.error });
        setMessage(result.field ? null : { kind: "error", text: result.error });
        return;
      }
      setSubject("");
      setBody("");
      setMessage({ kind: "success", text: `Sending to ${result.data.recipients.toLocaleString("en")} subscribers. It shows below as it goes.` });
      router.refresh();
    });

  return (
    <section aria-labelledby="new-broadcast" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="new-broadcast" className="font-display text-h3">
          New broadcast
        </h2>
        <p className="text-sm text-mute">Goes to everyone subscribed to your list. Send yourself a test first.</p>
      </div>
      <EmailFields idPrefix="broadcast" subject={subject} body={body} onSubject={setSubject} onBody={setBody} storeName={storeName} error={error} />
      <Feedback message={message} />
      {blocked && (
        <Alert variant="info">
          <AlertDescription>{blocked}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={test} loading={testing} disabled={!subject.trim() || !body.trim()}>
          Send me a test
        </Button>
        <Button type="button" onClick={() => setConfirming(true)} disabled={!subject.trim() || !body.trim() || blocked !== null}>
          <Send aria-hidden="true" className="size-4" />
          Send to {subscribed.toLocaleString("en")} {subscribed === 1 ? "subscriber" : "subscribers"}
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to {subscribed.toLocaleString("en")} subscribers?</DialogTitle>
            <DialogDescription>&ldquo;{subject}&rdquo; goes out now and can&apos;t be stopped or edited once sent.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
              Cancel
            </Button>
            <Button type="button" onClick={send} loading={sending}>
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** The welcome email new subscribers get once (D-095). */
export function WelcomeEmailForm({ storeName, initial }: { storeName: string; initial: { enabled: boolean; subject: string; body: string } }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [message, setMessage] = useState<Message>(null);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [saving, startSave] = useTransition();

  const save = () =>
    startSave(async () => {
      setError(null);
      const result = await saveWelcomeEmailAction({ enabled, subject, body });
      if (result.ok) {
        setMessage({ kind: "success", text: result.data.enabled ? "Saved. New subscribers get this email." : "Saved. The welcome email is off." });
        router.refresh();
      } else {
        setError({ field: result.field, text: result.error });
        setMessage(result.field ? null : { kind: "error", text: result.error });
      }
    });

  return (
    <section aria-labelledby="welcome-email" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
        <span className="flex flex-col gap-0.5">
          <span id="welcome-email" className="font-display text-h4">
            Welcome email
          </span>
          <span className="text-sm text-mute">Sent once to each new subscriber, right after they join.</span>
        </span>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Send a welcome email" />
      </label>
      <EmailFields idPrefix="welcome" subject={subject} body={body} onSubject={setSubject} onBody={setBody} storeName={storeName} error={error} />
      <Feedback message={message} />
      <Button type="button" className="self-end" onClick={save} loading={saving}>
        Save welcome email
      </Button>
    </section>
  );
}

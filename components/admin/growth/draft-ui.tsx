"use client";

import { Check, Copy, ExternalLink, PenLine, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markFollowUpSentAction, writeDraftAction, type DraftView } from "@/lib/marketing/draft-actions";
import { updateLeadAction } from "@/lib/marketing/lead-actions";

// DM draft pieces for the Growth pages (D-121). The founder copies a message, sends it from their own
// account, then marks it sent here. Every action is checked again on the server.

type Message = { kind: "success" | "error"; text: string } | null;

/** One message with a copy button. Text is shown as plain text (never HTML). */
export function MessageBox({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-bg-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-mute uppercase">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check aria-hidden="true" className="size-4 text-mint" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-sm whitespace-pre-line">{text}</p>
      <span className="text-xs text-mute">{text.length} characters</span>
    </div>
  );
}

export function WriterBadge({ draft }: { draft: Pick<DraftView, "writer" | "model"> }) {
  return <Badge variant={draft.writer === "template" ? "draft" : "soon"}>{draft.writer === "template" ? "Template" : `AI · ${draft.model ?? draft.writer}`}</Badge>;
}

function Note({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
      <AlertDescription>{message.text}</AlertDescription>
    </Alert>
  );
}

/** The lead page's draft: write or rewrite, then copy the first message or the follow-up. */
export function LeadDraft({ leadId, initial }: { leadId: string; initial: DraftView | null }) {
  const [draft, setDraft] = useState<DraftView | null>(initial);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  const write = () =>
    start(async () => {
      setMessage(null);
      const result = await writeDraftAction({ leadId });
      if (!result.ok) return setMessage({ kind: "error", text: result.error });
      setDraft(result.data);
      if (result.data.note) setMessage({ kind: "error", text: result.data.note });
    });
  return (
    <div className="flex flex-col gap-3">
      {draft ? (
        <>
          <div className="flex items-center gap-2">
            <WriterBadge draft={draft} />
            <span className="text-xs text-mute">Read it before sending; change anything you like.</span>
          </div>
          <MessageBox label="First message" text={draft.firstMessage} />
          <MessageBox label="Follow-up (4 days later, if no reply)" text={draft.followUp} />
        </>
      ) : (
        <p className="text-sm text-mute">No draft yet.</p>
      )}
      <Note message={message} />
      <Button type="button" variant="secondary" className="self-start" loading={pending} onClick={write}>
        {draft ? <PenLine aria-hidden="true" className="size-4" /> : <Sparkles aria-hidden="true" className="size-4" />}
        {draft ? "Write another" : "Write draft"}
      </Button>
    </div>
  );
}

type CardLead = { id: string; title: string; handle: string; profileUrl: string | null };

function LeadHeader({ lead, children }: { lead: CardLead; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 flex-col">
        <Link href={`/admin/growth/${lead.id}`} className="truncate font-semibold hover:underline">
          {lead.title}
        </Link>
        <span className="truncate text-xs text-mute">@{lead.handle}</span>
      </div>
      {children}
    </div>
  );
}

function ProfileLink({ url, handle }: { url: string | null; handle: string }) {
  if (!url) return null;
  return (
    <Button asChild variant="secondary" size="sm">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink aria-hidden="true" className="size-4" />
        Open profile
        <span className="sr-only">of @{handle} (opens in a new tab)</span>
      </a>
    </Button>
  );
}

/** A new lead to contact today: fit, draft, open profile, copy, mark sent. */
export function ContactCard({ lead, fit, initial }: { lead: CardLead; fit: { score: number; reasons: string[]; warning: string | null }; initial: DraftView | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftView | null>(initial);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <li className="flex items-center gap-2 rounded-lg border border-line bg-surface p-4 text-sm text-mute">
        <Check aria-hidden="true" className="size-4 text-mint" /> {lead.title} marked as contacted.
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <LeadHeader lead={lead}>
        <Badge variant={fit.score >= 60 ? "live" : "draft"}>Fit {fit.score}</Badge>
      </LeadHeader>
      {fit.reasons.length > 0 && <p className="text-xs text-mute">{fit.reasons.join(" · ")}</p>}
      {fit.warning && <p className="text-xs text-warning">{fit.warning}</p>}
      {draft ? (
        <>
          <WriterBadge draft={draft} />
          <MessageBox label="First message" text={draft.firstMessage} />
        </>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          loading={pending}
          onClick={() =>
            start(async () => {
              setMessage(null);
              const result = await writeDraftAction({ leadId: lead.id });
              if (!result.ok) return setMessage({ kind: "error", text: result.error });
              setDraft(result.data);
              if (result.data.note) setMessage({ kind: "error", text: result.data.note });
            })
          }
        >
          <Sparkles aria-hidden="true" className="size-4" />
          Write draft
        </Button>
      )}
      <Note message={message} />
      <div className="flex flex-wrap gap-2">
        <ProfileLink url={lead.profileUrl} handle={lead.handle} />
        <Button
          type="button"
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              setMessage(null);
              const result = await updateLeadAction({ action: "contacted", leadId: lead.id });
              if (!result.ok) return setMessage({ kind: "error", text: result.error });
              setDone(true);
              router.refresh();
            })
          }
        >
          <Send aria-hidden="true" className="size-4" />
          Mark sent
        </Button>
      </div>
    </li>
  );
}

/** A contacted lead whose one follow-up is due. */
export function FollowUpCard({ lead, initial, contactedOn }: { lead: CardLead; initial: DraftView | null; contactedOn: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftView | null>(initial);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  if (done) {
    return (
      <li className="flex items-center gap-2 rounded-lg border border-line bg-surface p-4 text-sm text-mute">
        <Check aria-hidden="true" className="size-4 text-mint" /> Follow-up to {lead.title} marked as sent.
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <LeadHeader lead={lead}>
        <span className="text-xs text-mute">Messaged {contactedOn}</span>
      </LeadHeader>
      {draft ? (
        <MessageBox label="Follow-up" text={draft.followUp} />
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          loading={pending}
          onClick={() =>
            start(async () => {
              const result = await writeDraftAction({ leadId: lead.id });
              if (!result.ok) return setMessage({ kind: "error", text: result.error });
              setDraft(result.data);
            })
          }
        >
          <Sparkles aria-hidden="true" className="size-4" />
          Write follow-up
        </Button>
      )}
      <Note message={message} />
      <div className="flex flex-wrap gap-2">
        <ProfileLink url={lead.profileUrl} handle={lead.handle} />
        <Button
          type="button"
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              const result = await markFollowUpSentAction({ leadId: lead.id });
              if (!result.ok) return setMessage({ kind: "error", text: result.error });
              setDone(true);
              router.refresh();
            })
          }
        >
          <Send aria-hidden="true" className="size-4" />
          Mark follow-up sent
        </Button>
      </div>
    </li>
  );
}

/** No reply after the follow-up: a suggestion to close the lead. Nothing changes unless clicked. */
export function NoReplyCard({ lead, followedUpOn }: { lead: CardLead; followedUpOn: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  if (done) return null;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <LeadHeader lead={lead}>
        <span className="text-xs text-mute">Follow-up {followedUpOn}</span>
      </LeadHeader>
      <Note message={message} />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="self-start"
        loading={pending}
        onClick={() =>
          start(async () => {
            const result = await updateLeadAction({ action: "stage", leadId: lead.id, stage: "not_interested" });
            if (!result.ok) return setMessage({ kind: "error", text: result.error });
            setDone(true);
            router.refresh();
          })
        }
      >
        Mark not interested
      </Button>
    </li>
  );
}

/** Writes drafts one lead at a time (one request each, so a slow AI never times out a page). */
export function WriteAllDrafts({ leadIds }: { leadIds: string[] }) {
  const router = useRouter();
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  if (leadIds.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        loading={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            let written = 0;
            let fallbacks = 0;
            for (const leadId of leadIds) {
              setProgress(`Writing ${written + 1} of ${leadIds.length}...`);
              const result = await writeDraftAction({ leadId });
              if (!result.ok) {
                setProgress(null);
                setMessage({ kind: "error", text: written ? `${written} written, then: ${result.error}` : result.error });
                router.refresh();
                return;
              }
              written += 1;
              if (result.data.note) fallbacks += 1;
            }
            setProgress(null);
            setMessage({ kind: "success", text: `${written} drafts written.${fallbacks ? ` ${fallbacks} used the template because the AI was not available or its draft broke a rule.` : ""}` });
            router.refresh();
          })
        }
      >
        <Sparkles aria-hidden="true" className="size-4" />
        Write drafts for {leadIds.length} {leadIds.length === 1 ? "creator" : "creators"}
      </Button>
      {progress && (
        <p role="status" className="text-sm text-mute">
          {progress}
        </p>
      )}
      <Note message={message} />
    </div>
  );
}

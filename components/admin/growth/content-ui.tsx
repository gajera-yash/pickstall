"use client";

import { Check, Copy, Download, ExternalLink, PenLine, RotateCcw, Send, SkipForward, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action-call";
import { markPostedAction, savePostAction, saveContentSettingsAction, setPostStatusAction, writeDayPostsAction } from "@/lib/marketing/content/actions";
import {
  CONTENT_LIMITS,
  CONTENT_PILLAR_LABELS,
  CONTENT_PLATFORMS,
  CONTENT_PLATFORM_LABELS,
  CONTENT_POST_URLS,
  POST_TEXT_MAX,
  type ContentPillar,
  type ContentPlatform,
  type ContentSettings,
  type PostStatus,
} from "@/lib/marketing/content/rules";

// Daily social posts (D-136): the founder reads and edits a post, copies it, downloads the images,
// posts it from their own account, then marks it posted. Every action is checked again on the server.

type Message = { kind: "success" | "error"; text: string } | null;

export type PostView = {
  id: string;
  platform: ContentPlatform;
  pillar: ContentPillar;
  topic: string;
  text: string;
  title: string | null;
  script: string | null;
  writer: "template" | "groq";
  model: string | null;
  note: string | null;
  status: PostStatus;
  postedUrl: string | null;
  imageCount: number;
  version: number;
};

function Note({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
      <AlertDescription>{message.text}</AlertDescription>
    </Alert>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
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
      {copied ? "Copied" : label}
    </Button>
  );
}

const STATUS_BADGE: Record<PostStatus, { variant: "draft" | "live" | "example"; label: string }> = {
  draft: { variant: "draft", label: "To post" },
  posted: { variant: "live", label: "Posted" },
  skipped: { variant: "example", label: "Skipped" },
};

/** Writes today's posts, or rewrites the drafts. */
export function WriteDayButton({ day, hasPosts }: { day: string; hasPosts: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        size="sm"
        variant={hasPosts ? "secondary" : "default"}
        loading={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const result = await callAction(() => writeDayPostsAction({ day, replace: hasPosts }));
            setMessage(result.ok ? { kind: "success", text: result.data.message } : { kind: "error", text: result.error });
            if (result.ok) router.refresh();
          })
        }
      >
        {hasPosts ? <PenLine aria-hidden="true" className="size-4" /> : <Sparkles aria-hidden="true" className="size-4" />}
        {hasPosts ? "Rewrite today's drafts" : "Write today's posts"}
      </Button>
      <Note message={message} />
    </div>
  );
}

/** One platform's post for the day. */
export function PostCard({ post }: { post: PostView }) {
  const router = useRouter();
  const [text, setText] = useState(post.text);
  const [title, setTitle] = useState(post.title ?? "");
  const [script, setScript] = useState(post.script ?? "");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  const draft = post.status === "draft";
  const changed = text !== post.text || title !== (post.title ?? "") || script !== (post.script ?? "");
  const badge = STATUS_BADGE[post.status];
  const label = CONTENT_PLATFORM_LABELS[post.platform];
  const max = POST_TEXT_MAX[post.platform];
  const imageUrl = (slide: number, download = false) => `/admin/growth/content/${post.id}/image?slide=${slide}&v=${post.version}${download ? "&download=1" : ""}`;

  const run = (action: () => Promise<{ ok: true; data: { message: string } } | { ok: false; error: string }>) =>
    start(async () => {
      setMessage(null);
      const result = await callAction(action);
      setMessage(result.ok ? { kind: "success", text: result.data.message } : { kind: "error", text: result.error });
      if (result.ok) router.refresh();
    });

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-h4">{label}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={post.writer === "template" ? "draft" : "soon"}>{post.writer === "template" ? "Template" : `AI · ${post.model ?? post.writer}`}</Badge>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>
      <p className="text-xs text-mute">
        {CONTENT_PILLAR_LABELS[post.pillar]} · {post.topic}
      </p>
      {post.note && <p className="text-xs text-warning">{post.note}</p>}

      {post.platform === "youtube" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`title-${post.id}`}>Shorts title</Label>
          <Input id={`title-${post.id}`} value={title} maxLength={CONTENT_LIMITS.youtubeTitle} disabled={!draft} onChange={(event) => setTitle(event.target.value)} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`text-${post.id}`}>{post.platform === "youtube" ? "Description" : post.platform === "instagram" ? "Caption" : "Post"}</Label>
          <CopyButton text={text} label="Copy" />
        </div>
        <Textarea id={`text-${post.id}`} value={text} rows={post.platform === "x" ? 4 : 8} maxLength={max} disabled={!draft} onChange={(event) => setText(event.target.value)} />
        <span className={text.length > max ? "text-xs text-danger" : "text-xs text-mute"}>
          {text.length} / {max} characters
        </span>
      </div>
      {post.platform === "youtube" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`script-${post.id}`}>Script to record (about 30 seconds, vertical)</Label>
            <CopyButton text={script} label="Copy script" />
          </div>
          <Textarea id={`script-${post.id}`} value={script} rows={6} maxLength={CONTENT_LIMITS.youtubeScript} disabled={!draft} onChange={(event) => setScript(event.target.value)} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wide text-mute uppercase">
          {post.imageCount === 1 ? (post.platform === "youtube" ? "Thumbnail" : "Image") : `Images (${post.imageCount}, post them in this order)`}
        </span>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: post.imageCount }, (_, slide) => (
            <li key={slide} className="flex shrink-0 flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-only image from our own route */}
              <img src={imageUrl(slide)} alt={`${label} image ${slide + 1}`} loading="lazy" className={post.imageCount === 1 ? "h-24 w-auto rounded-md border border-line" : "h-32 w-auto rounded-md border border-line"} />
              <a href={imageUrl(slide, true)} className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-blue underline underline-offset-4">
                <Download aria-hidden="true" className="size-3" />
                Download<span className="sr-only"> {label} image {slide + 1}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <Note message={message} />

      {draft ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {changed && (
              <Button type="button" size="sm" variant="secondary" loading={pending} onClick={() => run(() => savePostAction({ postId: post.id, text, title, script }))}>
                Save changes
              </Button>
            )}
            <Button asChild size="sm" variant="secondary">
              <a href={CONTENT_POST_URLS[post.platform]} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" className="size-4" />
                Open {label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
            <Button type="button" size="sm" variant="ghost" loading={pending} onClick={() => run(() => setPostStatusAction({ postId: post.id, status: "skipped" }))}>
              <SkipForward aria-hidden="true" className="size-4" />
              Skip today
            </Button>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`url-${post.id}`}>Link to the live post (optional)</Label>
              <Input id={`url-${post.id}`} type="url" inputMode="url" placeholder="https://" value={url} onChange={(event) => setUrl(event.target.value)} />
            </div>
            <Button type="button" size="sm" loading={pending} disabled={changed} onClick={() => run(() => markPostedAction({ postId: post.id, url }))}>
              <Send aria-hidden="true" className="size-4" />
              Mark posted
            </Button>
          </div>
          {changed && <p className="text-xs text-mute">Save your changes before marking it posted.</p>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {post.postedUrl && (
            <a href={post.postedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-blue underline underline-offset-4">
              <ExternalLink aria-hidden="true" className="size-4" />
              View the post<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          <Button type="button" size="sm" variant="ghost" loading={pending} onClick={() => run(() => setPostStatusAction({ postId: post.id, status: "draft" }))}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Back to draft
          </Button>
        </div>
      )}
    </li>
  );
}

/** Platforms, the real-numbers switch and the founder's weekly update. */
export function ContentSettingsForm({ initial }: { initial: ContentSettings }) {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<ContentPlatform[]>(initial.platforms);
  const [numbers, setNumbers] = useState(initial.shareRealNumbers);
  const [update, setUpdate] = useState(initial.update);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  const toggle = (platform: ContentPlatform, on: boolean) => setPlatforms((list) => (on ? [...new Set([...list, platform])] : list.filter((item) => item !== platform)));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setMessage(null);
          const result = await callAction(() => saveContentSettingsAction({ platforms, shareRealNumbers: numbers, update }));
          setMessage(result.ok ? { kind: "success", text: result.data.message } : { kind: "error", text: result.error });
          if (result.ok) router.refresh();
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Platforms that get a post every day</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {CONTENT_PLATFORMS.map((platform) => (
            <label key={platform} className="inline-flex min-h-10 items-center gap-2 text-sm">
              <Checkbox checked={platforms.includes(platform)} onCheckedChange={(checked) => toggle(platform, checked === true)} />
              {CONTENT_PLATFORM_LABELS[platform]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="share-numbers">Share real numbers</Label>
          <p className="text-xs text-mute">On Thursdays, &quot;building in public&quot; posts quote real counts from the database: creators signed up, live stores, new signups this week, products on sale. Counts of zero are left out.</p>
        </div>
        <Switch id="share-numbers" checked={numbers} onCheckedChange={setNumbers} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content-update">This week&apos;s update (optional)</Label>
        <Textarea id="content-update" rows={3} maxLength={CONTENT_LIMITS.update} value={update} onChange={(event) => setUpdate(event.target.value)} placeholder="What you shipped or learned this week, in your own words." />
        <span className="text-xs text-mute">The only source for &quot;what shipped&quot; in posts, so nothing is made up. {update.length} / {CONTENT_LIMITS.update}</span>
      </div>
      <Note message={message} />
      <Button type="submit" className="self-start" loading={pending}>
        Save content settings
      </Button>
    </form>
  );
}

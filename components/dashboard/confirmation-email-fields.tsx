"use client";

import type { ReactNode } from "react";

import { Field } from "@/components/dashboard/editor-fields";
import { HelpTip } from "@/components/ui/help-tip";
import { EmailTemplatePicker } from "@/components/dashboard/email-template-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_LIMITS } from "@/lib/products/schemas";
import { EMAIL_VARIABLES } from "@/lib/products/text";

/**
 * The creator's confirmation email (PRD F7, D-014), shared by the product and course editors
 * (D-078): an optional subject and message with the three allowed variables. The server checks
 * both again and always adds the store name and the access link.
 */
export function ConfirmationEmailFields({
  subject,
  body,
  onSubject,
  onBody,
  fieldError,
  linkLabel = "open their purchase",
  footer,
  productTitle,
}: {
  subject: string;
  body: string;
  onSubject: (value: string) => void;
  onBody: (value: string) => void;
  fieldError: (field: string) => string | null;
  /** What {{download_link}} does for this kind of product, in the hint. */
  linkLabel?: string;
  /** Optional actions under the fields (for example a Save button). */
  footer?: ReactNode;
  /** The product's title, as context for "Write with AI" (D-131). */
  productTitle?: string;
}) {
  return (
    <section aria-labelledby="confirmation-email-title" className="flex flex-col gap-4 rounded-md border border-line p-4">
      <div className="flex flex-col gap-1">
        <h3 id="confirmation-email-title" className="flex items-center gap-1 font-semibold">
          Confirmation email
          <HelpTip label="Email variables">{"Variables are filled in for each buyer: {{customer_name}} is their name, {{product_title}} the product, {{download_link}} their personal access link."}</HelpTip>
        </h3>
        <p className="text-sm text-mute">
          Sent to every buyer after they pay. You can use these variables; {"{{download_link}}"} is the link where they {linkLabel}. The access link and your
          store name are always included.
        </p>
        <ul className="flex flex-wrap gap-2 pt-1">
          {EMAIL_VARIABLES.map((name) => (
            <li key={name}>
              <code className="rounded-sm bg-bg-subtle px-2 py-1 font-mono text-xs text-ink">{`{{${name}}}`}</code>
            </li>
          ))}
        </ul>
      </div>
      <EmailTemplatePicker
        kind="confirmation"
        ai={{ title: productTitle ?? "", subject, body }}
        hasText={subject.trim() !== "" || body.trim() !== ""}
        onPick={(preset) => {
          onSubject(preset.subject);
          onBody(preset.body);
        }}
      />
      <Field id="emailSubject" label="Subject (optional)" error={fieldError("emailSubject")} hint={`${subject.length}/${PRODUCT_LIMITS.emailSubject}`}>
        <Input
          id="emailSubject"
          value={subject}
          maxLength={PRODUCT_LIMITS.emailSubject}
          onChange={(event) => onSubject(event.target.value)}
          placeholder="Your {{product_title}} is ready"
          aria-invalid={fieldError("emailSubject") ? true : undefined}
        />
      </Field>
      <Field id="emailBody" label="Message (optional)" error={fieldError("emailBody")} hint={`${body.length}/${PRODUCT_LIMITS.emailBody}`}>
        <Textarea
          id="emailBody"
          rows={5}
          value={body}
          maxLength={PRODUCT_LIMITS.emailBody}
          onChange={(event) => onBody(event.target.value)}
          placeholder={"Hi {{customer_name}},\n\nThanks for buying {{product_title}}. Get it here: {{download_link}}"}
          aria-invalid={fieldError("emailBody") ? true : undefined}
        />
      </Field>
      {footer}
    </section>
  );
}

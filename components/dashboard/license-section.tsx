"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";

import { FieldError } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { saveProductLicenseAction } from "@/lib/licenses/actions";

/** License keys on or off for a digital product (D-114). Saves as soon as it is switched. */
export function LicenseSection({ productId, initial }: { productId: string; initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const change = async (next: boolean) => {
    setEnabled(next);
    setSaving(true);
    setProblem(null);
    const result = await saveProductLicenseAction(productId, next);
    setSaving(false);
    if (!result.ok) {
      setEnabled(!next);
      setProblem(result.error);
    }
  };

  return (
    <section aria-labelledby="license-title" className="flex flex-col gap-2 rounded-md border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="license-title" className="flex items-center gap-2 font-display text-h4">
          <KeyRound aria-hidden="true" className="size-5 text-blue" />
          License key
        </h3>
        <Switch checked={enabled} onCheckedChange={change} disabled={saving} aria-label="Give each buyer a unique license key" />
      </div>
      <p className="text-sm text-mute">
        {enabled
          ? "Each buyer gets a unique key in their library and confirmation email. A refund makes the key invalid, and you can revoke one from the order. Your software can check keys with the verify API."
          : "For software, plugins or templates: turn on to give each buyer a unique key."}
      </p>
      {problem && <FieldError>{problem}</FieldError>}
    </section>
  );
}

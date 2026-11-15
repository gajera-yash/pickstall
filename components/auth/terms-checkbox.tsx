import Link from "next/link";

import { FieldError } from "@/components/ui/field";

/**
 * Required agreement to the Terms and Privacy Policy before a store is created (D-074). The server
 * checks it too (`acceptTerms` in the signup and username schemas) and saves the accepted version.
 * The links open in a new tab so the form keeps what was typed.
 */
export function TermsCheckbox({ error }: { error?: string | null }) {
  const errorId = "acceptTerms-error";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="acceptTerms" className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          id="acceptTerms"
          name="acceptTerms"
          type="checkbox"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-blue"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" rel="noopener" className="font-semibold text-blue underline underline-offset-4">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" rel="noopener" className="font-semibold text-blue underline underline-offset-4">
            Privacy Policy
          </Link>
          , and I am at least 18.
        </span>
      </label>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

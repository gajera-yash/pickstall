"use client";

import { Award, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimCertificate } from "@/lib/certificates/actions";
import { CERTIFICATE_NAME_MAX } from "@/lib/certificates/rules";

/**
 * The student's certificate card on the course page (D-111): what is left before it unlocks, the
 * name form once the course is finished, or a link to the certificate after it is issued.
 */
export function CertificateCard({
  orderId,
  finished,
  defaultName,
  certificateId: issuedId,
}: {
  orderId: string;
  finished: boolean;
  defaultName: string;
  certificateId: string | null;
}) {
  const [name, setName] = useState(defaultName);
  const [certificateId, setCertificateId] = useState(issuedId);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const claim = (event: React.FormEvent) => {
    event.preventDefault();
    setProblem(null);
    start(async () => {
      const result = await claimCertificate(orderId, name);
      if (result.ok) setCertificateId(result.data.id);
      else setProblem(result.error);
    });
  };

  return (
    <Card className="gap-3">
      <h2 className="flex items-center gap-2 font-display text-h4">
        <Award aria-hidden="true" className="size-5 text-blue" />
        Certificate
      </h2>
      {certificateId ? (
        <>
          <p className="text-sm text-mute">You finished the course. Open your certificate to print it or save it as a PDF.</p>
          <Button asChild className="self-start">
            <Link href={`/certificates/${certificateId}`} target="_blank" rel="noopener">
              View certificate
              <ExternalLink aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </>
      ) : !finished ? (
        <p className="text-sm text-mute">Finish every lesson (and pass every quiz) to get your certificate.</p>
      ) : (
        <form onSubmit={claim} className="flex flex-col gap-2">
          <p className="text-sm text-mute">You finished every lesson. Check how your name should appear: it can&apos;t be changed later.</p>
          <Label htmlFor="certificateName">Name on the certificate</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="certificateName" value={name} maxLength={CERTIFICATE_NAME_MAX} onChange={(event) => setName(event.target.value)} autoComplete="name" aria-invalid={!!problem} />
            <Button type="submit" loading={pending} className="shrink-0">
              Get certificate
            </Button>
          </div>
          {problem ? <FieldError>{problem}</FieldError> : <FieldHint>Anyone with the certificate link can see this name.</FieldHint>}
        </form>
      )}
    </Card>
  );
}

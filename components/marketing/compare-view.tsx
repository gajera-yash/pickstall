import { Check } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/landing/ui";
import { APP_NAME } from "@/lib/config";
import type { ComparePage, UseCasePage } from "@/lib/seo/pages";

/** A comparison table, why creators pick Pickstall, when the other option fits better, and the source (D-134). */
export function CompareView({ page }: { page: ComparePage }) {
  return (
    <Container className="flex flex-col gap-10 pb-16">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            {APP_NAME} compared with {page.name}
          </caption>
          <thead className="bg-bg-subtle">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                &nbsp;
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {APP_NAME}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {page.name}
              </th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row) => (
              <tr key={row.topic} className="border-t border-line">
                <th scope="row" className="px-4 py-3 font-semibold">
                  {row.topic}
                </th>
                <td className="px-4 py-3">{row.pickstall}</td>
                <td className="px-4 py-3 text-mute">{row.other}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-mute">
        {page.name} facts are from the{" "}
        <a href={page.source.url} rel="nofollow noopener" target="_blank" className="underline underline-offset-4">
          {page.source.label}
        </a>
        , checked {page.source.checkedOn}. Prices and plans can change; check their site for the latest. {page.name} is a trademark of its owner.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="why-pickstall" className="flex flex-col gap-3 rounded-lg border border-line p-6">
          <h2 id="why-pickstall" className="font-display text-h3">
            Why creators pick {APP_NAME}
          </h2>
          <ul className="flex flex-col gap-2">
            {page.whyPickstall.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mint" />
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="when-other" className="flex flex-col gap-3 rounded-lg border border-line p-6">
          <h2 id="when-other" className="font-display text-h3">
            When {page.name} may suit you better
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
            {page.whenOther.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
      <p className="text-sm">
        See all plans on the{" "}
        <Link href="/pricing" className="font-semibold text-blue underline underline-offset-4">
          pricing page
        </Link>{" "}
        or read the{" "}
        <Link href="/faq" className="font-semibold text-blue underline underline-offset-4">
          FAQ
        </Link>
        .
      </p>
    </Container>
  );
}

/** What a kind of creator sells with Pickstall and the tools that help (D-134). */
export function UseCaseView({ page }: { page: UseCasePage }) {
  const list = (title: string, items: string[]) => (
    <section className="flex flex-col gap-3 rounded-lg border border-line p-6">
      <h2 className="font-display text-h3">{title}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mint" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <Container className="flex flex-col gap-8 pb-16">
      <div className="grid gap-6 md:grid-cols-2">
        {list("What you can sell", page.sells)}
        {list("Tools that help", page.tools)}
      </div>
      <p className="text-sm">
        Compare plans on the{" "}
        <Link href="/pricing" className="font-semibold text-blue underline underline-offset-4">
          pricing page
        </Link>
        , see{" "}
        <Link href="/features" className="font-semibold text-blue underline underline-offset-4">
          all features
        </Link>
        , or start with a ready-made store template.
      </p>
    </Container>
  );
}

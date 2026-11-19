import { Download, Upload } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

// Settings > Data (D-100): every export in one place, and where to import a list. Each link goes to
// a route that checks the session and exports only the signed-in creator's store.

const EXPORTS = [
  { title: "Products", body: "Title, type, price, status and link of every product. No delivery links or files.", href: "/dashboard/products/export" },
  { title: "Orders", body: "Every order with buyer details, amounts, status and checkout answers.", href: "/dashboard/orders/export" },
  { title: "Customers", body: "Everyone who paid, with their orders and answers.", href: "/dashboard/customers/export" },
  { title: "Email subscribers", body: "Your email list with status and where each person joined.", href: "/dashboard/marketing/subscribers/export" },
] as const;

export default function DataSettingsPage() {
  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="font-display text-h3">Export</h2>
          <p className="text-sm text-mute">Download your data as CSV files that open in Excel, Google Sheets or Numbers. Your data is yours.</p>
        </CardHeader>
        <ul className="flex flex-col divide-y divide-line">
          {EXPORTS.map((item) => (
            <li key={item.href} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{item.title}</span>
                <span className="text-sm text-mute">{item.body}</span>
              </span>
              <Button asChild variant="secondary" className="shrink-0">
                <a href={item.href} download>
                  <Download aria-hidden="true" className="size-4" />
                  Export CSV
                </a>
              </Button>
            </li>
          ))}
        </ul>
        <p className="text-sm text-mute">
          Need everything about your account in one file?{" "}
          <Link href="/account" className="font-semibold text-blue underline underline-offset-4">
            Download my data
          </Link>
        </p>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-h3">Import</h2>
          <p className="text-sm text-mute">Bring your email list from Stan, Gumroad, Mailchimp or anywhere else as a CSV file.</p>
        </CardHeader>
        <Button asChild className="self-start">
          <Link href="/dashboard/marketing/subscribers">
            <Upload aria-hidden="true" className="size-4" />
            Import subscribers
          </Link>
        </Button>
      </Card>
    </>
  );
}

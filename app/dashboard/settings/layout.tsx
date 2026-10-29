import { SettingsNav } from "@/components/dashboard/settings-nav";

// Settings (PRD F8, DESIGN.md 10.2): sub-nav Store, Payments, Account next to the page content.
export default function SettingsLayout({ children }: LayoutProps<"/dashboard/settings">) {
  return (
    <>
      <h1 className="font-display text-h1">Settings</h1>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-20 lg:w-48 lg:shrink-0">
          <SettingsNav />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </>
  );
}

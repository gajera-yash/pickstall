// Dashboard sections (docs/DECISIONS.md D-011). Icons are mapped in the nav component.

export const DASHBOARD_SECTIONS = [
  { id: "store", label: "My Store", href: "/dashboard" },
  { id: "income", label: "Income", href: "/dashboard/income" },
  { id: "customers", label: "Customers", href: "/dashboard/customers" },
  { id: "settings", label: "Settings", href: "/dashboard/settings" },
] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]["id"];

/** Settings sub-nav (DESIGN.md 10.2). Store setup is the first Settings page (D-028). */
export const SETTINGS_SECTIONS = [
  { id: "store", label: "Store", href: "/dashboard/settings" },
  { id: "payments", label: "Payments", href: "/dashboard/settings/payments" },
  { id: "account", label: "Account", href: "/dashboard/settings/account" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

/** My Store matches /dashboard and products; the other sections also match their sub-pages. */
export function isSectionActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/products");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Settings sub-nav items match exactly (the Store item is the Settings root). */
export function isSettingsSectionActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard/settings" && pathname.startsWith(`${href}/`));
}

export type Crumb = { label: string; href: string };

/**
 * Breadcrumb for the top bar: the section, then the Settings page when inside Settings.
 * Unknown dashboard paths fall back to the section they live under.
 */
export function breadcrumbFor(pathname: string): Crumb[] {
  const section = DASHBOARD_SECTIONS.find((item) => isSectionActive(pathname, item.href)) ?? DASHBOARD_SECTIONS[0];
  const crumbs: Crumb[] = [{ label: section.label, href: section.href }];
  if (section.id === "settings") {
    const page = SETTINGS_SECTIONS.find((item) => isSettingsSectionActive(pathname, item.href));
    if (page) crumbs.push({ label: page.label, href: page.href });
  }
  return crumbs;
}

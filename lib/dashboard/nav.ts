// Dashboard sections (D-029, reference docs/ui-reference/dashboard.webp). Icons are mapped in the
// nav component. The first four are the mobile bottom bar; the rest sit under "More" there.

export const DASHBOARD_SECTIONS = [
  { id: "store", label: "My Store", href: "/dashboard" },
  { id: "products", label: "Products", href: "/dashboard/products" },
  { id: "orders", label: "Orders", href: "/dashboard/orders" },
  { id: "customers", label: "Customers", href: "/dashboard/customers" },
  { id: "income", label: "Income", href: "/dashboard/income" },
  { id: "marketing", label: "Marketing", href: "/dashboard/marketing" },
  { id: "analytics", label: "Analytics", href: "/dashboard/analytics" },
  { id: "settings", label: "Settings", href: "/dashboard/settings" },
] as const;

/** Tabs on the My Store page. Lives here, not in the client tabs file, so the server can read it. */
export const MY_STORE_TABS = ["products", "design", "links", "analytics"] as const;
export type MyStoreTab = (typeof MY_STORE_TABS)[number];

/** How many sections the mobile bottom bar shows before "More". */
export const BOTTOM_BAR_SECTIONS = 4;

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]["id"];

/** Settings sub-nav (DESIGN.md 10.2). Store setup is the first Settings page (D-028). */
export const SETTINGS_SECTIONS = [
  { id: "store", label: "Store", href: "/dashboard/settings" },
  { id: "payments", label: "Payments", href: "/dashboard/settings/payments" },
  { id: "account", label: "Account", href: "/dashboard/settings/account" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

/** My Store matches /dashboard only; the other sections also match their sub-pages. */
export function isSectionActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
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
  // The setup wizard (D-045) lives under My Store.
  if (pathname === "/dashboard/setup" || pathname.startsWith("/dashboard/setup/")) crumbs.push({ label: "Setup", href: "/dashboard/setup" });
  return crumbs;
}

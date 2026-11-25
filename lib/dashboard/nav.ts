// Dashboard sections (D-029, reference docs/ui-reference/dashboard.webp). Icons are mapped in the
// nav component. BOTTOM_BAR_IDS are the mobile bottom bar; the rest sit under "More" there.

export const DASHBOARD_SECTIONS = [
  { id: "store", label: "My Store", href: "/dashboard" },
  { id: "design", label: "Store design", href: "/dashboard/design" },
  { id: "products", label: "Products", href: "/dashboard/products" },
  { id: "orders", label: "Orders", href: "/dashboard/orders" },
  { id: "customers", label: "Customers", href: "/dashboard/customers" },
  { id: "reviews", label: "Reviews", href: "/dashboard/reviews" },
  { id: "income", label: "Income", href: "/dashboard/income" },
  { id: "marketing", label: "Marketing", href: "/dashboard/marketing" },
  { id: "analytics", label: "Analytics", href: "/dashboard/analytics" },
  { id: "settings", label: "Settings", href: "/dashboard/settings" },
] as const;

/** Tabs on the My Store page. Lives here, not in the client tabs file, so the server can read it. */
export const MY_STORE_TABS = ["products", "links", "analytics"] as const;
export type MyStoreTab = (typeof MY_STORE_TABS)[number];

/** The mobile bottom bar's sections (Store design sits under "More" there). */
export const BOTTOM_BAR_IDS = ["store", "products", "orders", "customers"] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]["id"];

/** Settings sub-nav (DESIGN.md 10.2). Store setup is the first Settings page (D-028). */
export const SETTINGS_SECTIONS = [
  { id: "store", label: "Store", href: "/dashboard/settings" },
  { id: "payments", label: "Payments", href: "/dashboard/settings/payments" },
  { id: "plan", label: "Plan", href: "/dashboard/settings/plan" },
  { id: "data", label: "Data", href: "/dashboard/settings/data" },
  { id: "account", label: "Account", href: "/dashboard/settings/account" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

/** Marketing sub-nav (D-129): the overview, then one page per tool. */
export const MARKETING_SECTIONS = [
  { id: "overview", label: "Overview", href: "/dashboard/marketing" },
  { id: "coupons", label: "Coupons", href: "/dashboard/marketing/coupons" },
  { id: "offers", label: "Offers", href: "/dashboard/marketing/offers" },
  { id: "emails", label: "Email design", href: "/dashboard/marketing/emails" },
  { id: "automations", label: "Automations", href: "/dashboard/marketing/automations" },
  { id: "subscribers", label: "Email list", href: "/dashboard/marketing/subscribers" },
  { id: "broadcasts", label: "Broadcasts", href: "/dashboard/marketing/broadcasts" },
  { id: "affiliates", label: "Affiliates", href: "/dashboard/marketing/affiliates" },
  { id: "funnels", label: "Funnels", href: "/dashboard/marketing/funnels" },
  { id: "pixels", label: "Pixels", href: "/dashboard/marketing/pixels" },
] as const;

export type MarketingSectionId = (typeof MARKETING_SECTIONS)[number]["id"];

/** The overview matches /dashboard/marketing only; each tool also matches its sub-pages. */
export function isMarketingSectionActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/marketing") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  if (section.id === "marketing") {
    const page = MARKETING_SECTIONS.find((item) => item.id !== "overview" && isMarketingSectionActive(pathname, item.href));
    if (page) crumbs.push({ label: page.label, href: page.href });
  }
  if (section.id === "settings") {
    const page = SETTINGS_SECTIONS.find((item) => isSettingsSectionActive(pathname, item.href));
    if (page) crumbs.push({ label: page.label, href: page.href });
  }
  // The setup wizard (D-045) lives under My Store.
  if (pathname === "/dashboard/setup" || pathname.startsWith("/dashboard/setup/")) crumbs.push({ label: "Setup", href: "/dashboard/setup" });
  return crumbs;
}

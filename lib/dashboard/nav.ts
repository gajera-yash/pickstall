// Dashboard sections (docs/DECISIONS.md D-011). Icons are mapped in the nav component.

export const DASHBOARD_SECTIONS = [
  { id: "store", label: "My Store", href: "/dashboard" },
  { id: "income", label: "Income", href: "/dashboard/income" },
  { id: "customers", label: "Customers", href: "/dashboard/customers" },
  { id: "settings", label: "Settings", href: "/dashboard/settings" },
] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]["id"];

/** My Store matches /dashboard, Store setup and products; the other sections also match their sub-pages. */
export function isSectionActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/store") || pathname.startsWith("/dashboard/products");
  return pathname === href || pathname.startsWith(`${href}/`);
}

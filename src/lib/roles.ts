/** Rol de negocio informativo, capturado en el signup. No otorga permisos distintos en el dashboard. */
export const DASHBOARD_ROLES = [
  { value: "dueno", label: "Dueño/a del negocio" },
  { value: "vendedor", label: "Vendedor/a" },
  { value: "closer", label: "Closer" },
  { value: "soporte", label: "Soporte / Atención al cliente" },
  { value: "otro", label: "Otro" },
] as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[number]["value"];

export function isDashboardRole(value: unknown): value is DashboardRole {
  return typeof value === "string" && DASHBOARD_ROLES.some((r) => r.value === value);
}

export function dashboardRoleLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return DASHBOARD_ROLES.find((r) => r.value === value)?.label ?? null;
}

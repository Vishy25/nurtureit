export type AppRole = "tenant_admin" | "sales_manager" | "sales_rep" | "ops_coordinator" | "analyst";

export const ROLE_LABELS: Record<AppRole, string> = {
  tenant_admin: "Tenant administrator",
  sales_manager: "Sales manager",
  sales_rep: "Sales representative",
  ops_coordinator: "Operations coordinator",
  analyst: "Read-only analyst",
};

export type Permission =
  | "records.view.own"
  | "records.view.team"
  | "records.view.tenant"
  | "records.edit.own"
  | "records.edit.team"
  | "records.assign"
  | "records.delete"
  | "pipeline.manage"
  | "operations.manage"
  | "reports.view"
  | "data.export"
  | "config.manage"
  | "members.manage"
  | "integrations.manage"
  | "audit.view";

/**
 * UI-side mirror of the server-side permission model.
 * The database enforces the real boundary through row-level security;
 * this matrix only decides what the interface offers.
 */
export const PERMISSION_MATRIX: Record<AppRole, Permission[]> = {
  tenant_admin: [
    "records.view.own",
    "records.view.team",
    "records.view.tenant",
    "records.edit.own",
    "records.edit.team",
    "records.assign",
    "records.delete",
    "pipeline.manage",
    "operations.manage",
    "reports.view",
    "data.export",
    "config.manage",
    "members.manage",
    "integrations.manage",
    "audit.view",
  ],
  sales_manager: [
    "records.view.own",
    "records.view.team",
    "records.edit.own",
    "records.edit.team",
    "records.assign",
    "pipeline.manage",
    "reports.view",
    "data.export",
    "audit.view",
  ],
  sales_rep: ["records.view.own", "records.edit.own", "reports.view"],
  ops_coordinator: ["records.view.team", "records.edit.own", "operations.manage", "reports.view"],
  analyst: ["records.view.tenant", "reports.view", "data.export"],
};

export function can(role: AppRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSION_MATRIX[role].includes(permission);
}

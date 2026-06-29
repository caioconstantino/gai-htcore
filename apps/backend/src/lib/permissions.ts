export const ALL_PERMISSIONS = [
  "dashboard.view",
  "leads.view",
  "leads.edit",
  "conversations.view",
  "conversations.manage",
  "agents.view",
  "agents.edit",
  "products.view",
  "products.edit",
  "quotes.view",
  "settings.view",
  "settings.edit",
  "users.view",
  "users.manage",
  "roles.manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*"],
  company_admin: [...ALL_PERMISSIONS],
  manager: [
    "dashboard.view", "leads.view", "leads.edit",
    "conversations.view", "conversations.manage",
    "agents.view", "agents.edit",
    "products.view", "products.edit",
    "quotes.view", "settings.view", "users.view",
  ],
  commercial: [
    "dashboard.view", "leads.view", "leads.edit",
    "conversations.view", "quotes.view", "products.view",
  ],
  operator: [
    "dashboard.view", "conversations.view", "conversations.manage",
  ],
};

export function resolvePermissions(role: string, customPermissions?: string[] | null): string[] {
  if (role === "super_admin") return ["*"];
  if (customPermissions && customPermissions.length > 0) return customPermissions;
  return DEFAULT_ROLE_PERMISSIONS[role] ?? DEFAULT_ROLE_PERMISSIONS["operator"] ?? [];
}

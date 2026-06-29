// Ordered list used to find the first route a user can access
export const PERMISSION_ROUTES = [
  { permission: "dashboard.view",     href: "/dashboard" },
  { permission: "conversations.view", href: "/conversations" },
  { permission: "leads.view",         href: "/leads" },
  { permission: "agents.view",        href: "/agents" },
  { permission: "products.view",      href: "/products" },
  { permission: "quotes.view",        href: "/quotes" },
  { permission: "settings.view",      href: "/settings" },
] as const;

export const ROUTE_PERMISSIONS: Record<string, string> = {
  "/dashboard":     "dashboard.view",
  "/leads":         "leads.view",
  "/conversations": "conversations.view",
  "/agents":        "agents.view",
  "/products":      "products.view",
  "/quotes":        "quotes.view",
  "/settings":      "settings.view",
  "/users":         "users.view",
  "/roles":         "roles.manage",
};

export function getFirstAccessibleRoute(permissions: string[]): string {
  if (permissions.includes("*")) return "/dashboard";
  for (const { permission, href } of PERMISSION_ROUTES) {
    if (permissions.includes(permission)) return href;
  }
  return "/settings"; // last-resort fallback
}

export const PERMISSION_GROUPS = [
  {
    group: "Dashboard",
    permissions: [
      { key: "dashboard.view", label: "Visualizar Dashboard" },
    ],
  },
  {
    group: "Leads",
    permissions: [
      { key: "leads.view", label: "Visualizar Leads" },
      { key: "leads.edit", label: "Criar e Editar Leads" },
    ],
  },
  {
    group: "Conversas",
    permissions: [
      { key: "conversations.view", label: "Visualizar Conversas" },
      { key: "conversations.manage", label: "Gerenciar Conversas (responder, pausar IA)" },
    ],
  },
  {
    group: "Agentes",
    permissions: [
      { key: "agents.view", label: "Visualizar Agentes" },
      { key: "agents.edit", label: "Criar e Editar Agentes" },
    ],
  },
  {
    group: "Produtos",
    permissions: [
      { key: "products.view", label: "Visualizar Produtos" },
      { key: "products.edit", label: "Criar e Editar Produtos" },
    ],
  },
  {
    group: "Orçamentos",
    permissions: [
      { key: "quotes.view", label: "Visualizar Orçamentos" },
    ],
  },
  {
    group: "Configurações",
    permissions: [
      { key: "settings.view", label: "Visualizar Configurações" },
      { key: "settings.edit", label: "Editar Configurações" },
    ],
  },
  {
    group: "Usuários",
    permissions: [
      { key: "users.view", label: "Visualizar Usuários" },
      { key: "users.manage", label: "Criar e Editar Usuários" },
    ],
  },
  {
    group: "Perfis de Acesso",
    permissions: [
      { key: "roles.manage", label: "Gerenciar Perfis de Acesso" },
    ],
  },
] as const;

export type PermissionKey =
  (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

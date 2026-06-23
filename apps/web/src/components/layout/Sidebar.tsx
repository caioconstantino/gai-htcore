"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { Box, Stack, Text, UnstyledButton, Group, Avatar } from "@mantine/core";
import {
  IconLayoutDashboard, IconBuilding, IconUsers, IconCreditCard, IconCurrencyDollar,
  IconBolt, IconRobot, IconBook2, IconHeadset, IconFileSearch,
  IconPlugConnected, IconSettings, IconChartBar, IconShield, IconCloudUpload,
  IconMessageCircle, IconPackage, IconFileText, IconLogout,
} from "@tabler/icons-react";

const companyNav = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/leads", label: "Leads", icon: IconUsers },
  { href: "/conversations", label: "Conversas", icon: IconMessageCircle },
  { href: "/agents", label: "Agentes", icon: IconRobot },
  { href: "/products", label: "Produtos", icon: IconPackage },
  { href: "/quotes", label: "Orçamentos", icon: IconFileText },
  { href: "/settings", label: "Configurações", icon: IconSettings },
];

const masterNav = [
  { href: "/dashboard", label: "Dashboard Executivo", icon: IconLayoutDashboard },
  { href: "/companies", label: "Empresas", icon: IconBuilding },
  { href: "/users", label: "Usuários", icon: IconUsers },
  { href: "/subscriptions", label: "Assinaturas", icon: IconCreditCard },
  { href: "/financial", label: "Financeiro", icon: IconCurrencyDollar },
  { href: "/ai-usage", label: "Consumo IA", icon: IconBolt },
  { href: "/global-agents", label: "Agentes Globais", icon: IconRobot },
  { href: "/global-products", label: "Produtos Globais", icon: IconPackage },
  { href: "/knowledge-base", label: "Biblioteca de Inteligência", icon: IconBook2 },
  { href: "/support", label: "Suporte", icon: IconHeadset },
  { href: "/audit-logs", label: "Logs e Auditoria", icon: IconFileSearch },
  { href: "/integrations", label: "Integrações", icon: IconPlugConnected },
  { href: "/settings", label: "Configurações Gerais", icon: IconSettings },
  { href: "/reports", label: "Relatórios Globais", icon: IconChartBar },
  { href: "/security", label: "Segurança", icon: IconShield },
  { href: "/backups", label: "Backups", icon: IconCloudUpload },
];

function NavItem({ href, label, icon: Icon, active, onClick }: {
  href: string; label: string; icon: React.ElementType; active: boolean; onClick?: () => void;
}) {
  return (
    <UnstyledButton
      component={Link}
      href={href}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 10px",
        borderRadius: 8,
        background: active ? "rgba(59,130,246,0.15)" : "transparent",
        color: active ? "#60a5fa" : "rgba(255,255,255,0.55)",
        fontWeight: active ? 600 : 400,
        fontSize: 13,
        transition: "all 0.15s",
        textDecoration: "none",
        borderLeft: active ? "2px solid #3b82f6" : "2px solid transparent",
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </UnstyledButton>
  );
}

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";
  const nav = isSuperAdmin ? masterNav : companyNav;

  function handleLogout() { logout(); router.push("/login"); }

  return (
    <Box style={{ width: 220, minHeight: "100%", background: "#0f172a", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Logo */}
      <Box p="md" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Stack gap={6} align="flex-start">
          <Image src="/logo-gai.png" alt="G.AI" width={765} height={326} style={{ height: 28, width: "auto" }} />
          {isSuperAdmin
            ? <Text size="xs" c="blue.4" fw={600}>Painel Master</Text>
            : <Text size="xs" c="dimmed">HT Core Solutions</Text>
          }
        </Stack>
      </Box>

      {/* Nav */}
      <Box p="xs" style={{ flex: 1, overflowY: "auto" }}>
        {isSuperAdmin && (
          <Text size="xs" c="dimmed" px="sm" pt="sm" pb="xs" fw={600} tt="uppercase" style={{ letterSpacing: 1, opacity: 0.5 }}>
            HT Core Solutions
          </Text>
        )}
        <Stack gap={2}>
          {nav.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))}
              onClick={onNavigate}
            />
          ))}
        </Stack>
      </Box>

      {/* User */}
      <Box p="sm" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <Box p="sm" mb="xs" style={{ borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>
          <Group gap="sm">
            <Avatar size={30} radius="xl" color="blue">
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" c="white" fw={500} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.name}
              </Text>
              <Text size="xs" c="dimmed">{isSuperAdmin ? "Super Admin" : user?.role?.replace("_", " ")}</Text>
            </Box>
          </Group>
        </Box>
        <UnstyledButton
          onClick={handleLogout}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, color: "rgba(255,255,255,0.35)", fontSize: 13, width: "100%", transition: "all 0.15s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
        >
          <IconLogout size={15} />
          <span>Sair</span>
        </UnstyledButton>
      </Box>
    </Box>
  );
}

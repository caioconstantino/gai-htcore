"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Box, Card, Title, Text, Stack, Group, SimpleGrid, ThemeIcon, Badge, Progress } from "@mantine/core";
import { IconChartBar, IconUsers, IconMessageCircle, IconBolt, IconBuilding } from "@tabler/icons-react";

interface DashboardData {
  totalLeads: number; hotLeads: number; totalConversations: number;
  pendingQuotes: number; totalCompanies?: number; activeCompanies?: number;
  totalUsers?: number;
}

export default function ReportsPage() {
  const { data } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard").then((r) => r.data),
  });

  const metrics = [
    { label: "Total de Empresas", value: data?.totalCompanies ?? 0, sub: `${data?.activeCompanies ?? 0} ativas`, icon: IconBuilding, color: "blue" },
    { label: "Total de Usuários", value: data?.totalUsers ?? 0, sub: "em todas as empresas", icon: IconUsers, color: "violet" },
    { label: "Total de Leads", value: data?.totalLeads ?? 0, sub: `${data?.hotLeads ?? 0} leads quentes`, icon: IconUsers, color: "orange" },
    { label: "Total de Conversas", value: data?.totalConversations ?? 0, sub: "todas as empresas", icon: IconMessageCircle, color: "teal" },
  ];

  return (
    <Stack gap="lg" maw={1200}>
      <Box>
        <Title order={2} fw={700}>Relatórios Globais</Title>
        <Text c="dimmed" size="sm" mt={4}>Métricas consolidadas de toda a plataforma</Text>
      </Box>

      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md">
        {metrics.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} padding="lg" radius="lg" withBorder shadow="sm">
            <ThemeIcon size={36} radius="md" color={color} variant="light" mb="sm"><Icon size={18} /></ThemeIcon>
            <Text fw={800} size="xl" lh={1}>{value}</Text>
            <Text size="sm" c="dimmed" mt={4}>{label}</Text>
            <Text size="xs" c="dimmed">{sub}</Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card padding="lg" radius="lg" withBorder shadow="sm">
        <Group mb="lg">
          <ThemeIcon size={32} radius="md" color="blue" variant="light"><IconChartBar size={16} /></ThemeIcon>
          <Box>
            <Text fw={600} size="sm">Relatórios Avançados</Text>
            <Text size="xs" c="dimmed">Em desenvolvimento — disponível na versão Pro</Text>
          </Box>
          <Badge ml="auto" color="violet" variant="light">Em breve</Badge>
        </Group>
        <Stack gap="sm">
          {["Relatório de Conversão por Empresa", "Relatório de Consumo de IA", "Relatório de Revenue por Plano", "Relatório de Churn"].map((r) => (
            <Box key={r} p="sm" style={{ borderRadius: 8, background: "var(--mantine-color-gray-0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text size="sm">{r}</Text>
              <Badge color="gray" variant="outline" size="xs">Em breve</Badge>
            </Box>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

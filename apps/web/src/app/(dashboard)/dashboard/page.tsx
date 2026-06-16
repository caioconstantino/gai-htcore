"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Box, Card, Grid, Group, Text, Title, Stack, Badge,
  Progress, RingProgress, SimpleGrid, Skeleton, ThemeIcon, Table,
} from "@mantine/core";
import {
  IconUsers, IconMessageCircle, IconFileText, IconFlame,
  IconBolt, IconTrendingUp, IconBuilding, IconArrowUpRight,
  IconAlertCircle,
} from "@tabler/icons-react";

interface DashboardData {
  totalLeads: number;
  hotLeads: number;
  totalConversations: number;
  wonDeals: number;
  pendingQuotes: number;
  tokenUsage: { tokensUsed: number; tokenLimit: number } | null;
  leadsByStage: Array<{ stage: string; _count: number }>;
  // super_admin extras
  totalCompanies?: number;
  activeCompanies?: number;
  totalUsers?: number;
  handedOffConversations?: number;
  recentCompanies?: Array<{ id: string; name: string; slug: string; plan: string; tokensUsed: number; tokenLimit: number; isActive: boolean; createdAt: string }>;
}

const stageLabels: Record<string, string> = {
  new: "Novos", qualified: "Qualificados", proposal: "Proposta",
  negotiation: "Negociação", won: "Ganhos", lost: "Perdidos",
};
const stageColors: Record<string, string> = {
  new: "blue", qualified: "violet", proposal: "yellow",
  negotiation: "orange", won: "green", lost: "red",
};
const planColors: Record<string, string> = {
  trial: "gray", basic: "blue", pro: "violet", enterprise: "orange",
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard").then((r) => r.data),
    refetchInterval: 60000,
  });

  const tokenPercent = data?.tokenUsage
    ? Math.round((data.tokenUsage.tokensUsed / data.tokenUsage.tokenLimit) * 100)
    : 0;

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton height={36} width={220} radius="md" />
        <SimpleGrid cols={{ base: 2, lg: isSuperAdmin ? 4 : 4 }} spacing="md">
          {Array.from({ length: isSuperAdmin ? 8 : 4 }).map((_, i) => (
            <Skeleton key={i} height={120} radius="lg" />
          ))}
        </SimpleGrid>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" maw={1280}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>
            {isSuperAdmin ? "Painel HT Core" : "Dashboard"}
          </Title>
          <Text c="dimmed" size="sm" mt={4}>
            {isSuperAdmin ? "Visão geral de toda a plataforma G.AI" : "Visão geral da operação comercial"}
          </Text>
        </Box>
        <Badge color="green" variant="light" size="lg">
          <Group gap={6}>
            <Box w={7} h={7} style={{ borderRadius: "50%", background: "var(--mantine-color-green-6)" }} />
            Ao vivo
          </Group>
        </Badge>
      </Group>

      {/* Super Admin KPIs */}
      {isSuperAdmin && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {[
            { label: "Total de Empresas", value: data?.totalCompanies ?? 0, sub: `${data?.activeCompanies ?? 0} ativas`, icon: IconBuilding, color: "blue", bg: "#eff6ff" },
            { label: "Total de Leads", value: data?.totalLeads ?? 0, sub: "todas as empresas", icon: IconUsers, color: "violet", bg: "#f5f3ff" },
            { label: "Conversas Ativas", value: data?.totalConversations ?? 0, sub: `${data?.handedOffConversations ?? 0} aguardando humano`, icon: IconMessageCircle, color: "teal", bg: "#f0fdfa" },
            { label: "Usuários Ativos", value: data?.totalUsers ?? 0, sub: "excl. super admins", icon: IconUsers, color: "orange", bg: "#fff7ed" },
          ].map(({ label, value, sub, icon: Icon, color, bg }) => (
            <Card key={label} padding="lg" radius="lg" withBorder shadow="sm">
              <Group justify="space-between" mb="sm">
                <Box style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={20} color={`var(--mantine-color-${color}-6)`} />
                </Box>
                <IconArrowUpRight size={14} color="var(--mantine-color-green-6)" />
              </Group>
              <Text size="xl" fw={800} lh={1}>{value}</Text>
              <Text size="sm" c="dimmed" mt={2}>{label}</Text>
              <Text size="xs" c="dimmed" mt={2}>{sub}</Text>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Lead KPIs */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {[
          { label: "Leads", value: data?.totalLeads ?? 0, icon: IconUsers, color: "blue", bg: "#eff6ff" },
          { label: "Leads Quentes", value: data?.hotLeads ?? 0, icon: IconFlame, color: "orange", bg: "#fff7ed" },
          { label: "Conversas", value: data?.totalConversations ?? 0, icon: IconMessageCircle, color: "violet", bg: "#f5f3ff" },
          { label: "Orçamentos Enviados", value: data?.pendingQuotes ?? 0, icon: IconFileText, color: "green", bg: "#f0fdf4" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} padding="lg" radius="lg" withBorder shadow="sm">
            <Group justify="space-between" mb="sm">
              <Box style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={20} color={`var(--mantine-color-${color}-6)`} />
              </Box>
            </Group>
            <Text size="xl" fw={800} lh={1}>{value}</Text>
            <Text size="sm" c="dimmed" mt={2}>{label}</Text>
          </Card>
        ))}
      </SimpleGrid>

      <Grid gutter="md">
        {/* Funil */}
        <Grid.Col span={{ base: 12, lg: isSuperAdmin ? 5 : 7 }}>
          <Card padding="lg" radius="lg" withBorder shadow="sm" h="100%">
            <Group mb="md">
              <ThemeIcon size={32} radius="md" color="blue" variant="light">
                <IconTrendingUp size={16} />
              </ThemeIcon>
              <Box>
                <Text fw={600} size="sm">Funil de Vendas</Text>
                <Text size="xs" c="dimmed">Distribuição por estágio</Text>
              </Box>
            </Group>
            {data?.leadsByStage && data.leadsByStage.length > 0 ? (
              <Stack gap="sm">
                {data.leadsByStage.map(({ stage, _count }) => {
                  const max = Math.max(...data.leadsByStage.map((s) => s._count));
                  const pct = max > 0 ? Math.round((_count / max) * 100) : 0;
                  return (
                    <Box key={stage}>
                      <Group justify="space-between" mb={4}>
                        <Text size="sm" c="dimmed">{stageLabels[stage] ?? stage}</Text>
                        <Text size="sm" fw={600}>{_count}</Text>
                      </Group>
                      <Progress value={pct} color={stageColors[stage] ?? "blue"} radius="xl" size="sm" />
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Box ta="center" py="xl"><Text c="dimmed" size="sm">Sem leads cadastrados</Text></Box>
            )}
          </Card>
        </Grid.Col>

        {/* Tokens */}
        <Grid.Col span={{ base: 12, lg: isSuperAdmin ? 3 : 5 }}>
          <Card padding="lg" radius="lg" withBorder shadow="sm" h="100%">
            <Group mb="md">
              <ThemeIcon size={32} radius="md" color="yellow" variant="light">
                <IconBolt size={16} />
              </ThemeIcon>
              <Box>
                <Text fw={600} size="sm">Tokens IA</Text>
                <Text size="xs" c="dimmed">Consumo do plano</Text>
              </Box>
            </Group>
            {data?.tokenUsage ? (
              <Stack align="center" gap="md">
                <RingProgress
                  size={140} thickness={14} roundCaps
                  sections={[{ value: tokenPercent, color: tokenPercent > 80 ? "red" : tokenPercent > 60 ? "yellow" : "green" }]}
                  label={<Text ta="center" fw={800} size="lg">{tokenPercent}%</Text>}
                />
                <Stack gap={4} w="100%">
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Usados</Text>
                    <Text size="xs" fw={500}>{data.tokenUsage.tokensUsed.toLocaleString("pt-BR")}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Limite</Text>
                    <Text size="xs" fw={500}>{data.tokenUsage.tokenLimit.toLocaleString("pt-BR")}</Text>
                  </Group>
                </Stack>
                {tokenPercent > 80 && (
                  <Badge color="red" variant="light" fullWidth leftSection={<IconAlertCircle size={12} />}>
                    Acima de 80% — upgrade necessário
                  </Badge>
                )}
              </Stack>
            ) : (
              <Box ta="center" py="xl"><Text c="dimmed" size="sm">Sem dados de consumo</Text></Box>
            )}
          </Card>
        </Grid.Col>

        {/* Empresas recentes (super_admin) */}
        {isSuperAdmin && (
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Card padding="lg" radius="lg" withBorder shadow="sm" h="100%">
              <Group mb="md">
                <ThemeIcon size={32} radius="md" color="indigo" variant="light">
                  <IconBuilding size={16} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm">Empresas Recentes</Text>
                  <Text size="xs" c="dimmed">Últimas cadastradas</Text>
                </Box>
              </Group>
              {data?.recentCompanies && data.recentCompanies.length > 0 ? (
                <Stack gap="sm">
                  {data.recentCompanies.map((c) => {
                    const pct = Math.round((c.tokensUsed / c.tokenLimit) * 100);
                    return (
                      <Box key={c.id} p="sm" style={{ borderRadius: 8, background: "var(--mantine-color-gray-0)" }}>
                        <Group justify="space-between" mb={4}>
                          <Text size="sm" fw={500} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
                            {c.name}
                          </Text>
                          <Group gap={4}>
                            <Badge size="xs" color={planColors[c.plan] ?? "gray"} variant="light">{c.plan}</Badge>
                            {!c.isActive && <Badge size="xs" color="red" variant="light">inativo</Badge>}
                          </Group>
                        </Group>
                        <Progress value={pct} size="xs" color={pct > 80 ? "red" : "blue"} radius="xl" />
                        <Text size="xs" c="dimmed" mt={2}>{pct}% tokens</Text>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Box ta="center" py="xl"><Text c="dimmed" size="sm">Nenhuma empresa</Text></Box>
              )}
            </Card>
          </Grid.Col>
        )}
      </Grid>
    </Stack>
  );
}

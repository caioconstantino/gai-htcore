"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Box, Card, Title, Text, Stack, Group, Progress, SimpleGrid, Skeleton, ThemeIcon, Badge } from "@mantine/core";
import { IconBolt, IconBuilding } from "@tabler/icons-react";

interface Company {
  id: string; name: string; plan: string;
  tokensUsed: number; tokenLimit: number; isActive: boolean;
  _count: { users: number };
}

export default function AIUsagePage() {
  const { data, isLoading } = useQuery<{ data: Company[] }>({
    queryKey: ["companies"],
    queryFn: () => api.get("/companies").then((r) => r.data),
  });

  const companies = data?.data ?? [];
  const totalUsed = companies.reduce((acc, c) => acc + c.tokensUsed, 0);
  const totalLimit = companies.reduce((acc, c) => acc + c.tokenLimit, 0);
  const globalPct = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

  return (
    <Stack gap="lg" maw={1000}>
      <Box>
        <Title order={2} fw={700}>Consumo IA</Title>
        <Text c="dimmed" size="sm" mt={4}>Uso de tokens de todas as empresas</Text>
      </Box>

      <Card padding="lg" radius="lg" withBorder shadow="sm">
        <Group mb="sm">
          <ThemeIcon size={32} radius="md" color="yellow" variant="light"><IconBolt size={16} /></ThemeIcon>
          <Box>
            <Text fw={600} size="sm">Consumo Global da Plataforma</Text>
            <Text size="xs" c="dimmed">{totalUsed.toLocaleString("pt-BR")} / {totalLimit.toLocaleString("pt-BR")} tokens totais</Text>
          </Box>
          <Badge ml="auto" color={globalPct > 80 ? "red" : "blue"} variant="light">{globalPct}%</Badge>
        </Group>
        <Progress value={globalPct} color={globalPct > 80 ? "red" : "blue"} size="lg" radius="xl" />
      </Card>

      {isLoading ? (
        <Stack gap="sm">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={80} radius="lg" />)}</Stack>
      ) : (
        <Card padding={0} radius="lg" withBorder shadow="sm">
          <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <Text fw={600} size="sm">Por Empresa</Text>
          </Box>
          {companies.length === 0 ? (
            <Box ta="center" py="xl"><Text c="dimmed">Nenhuma empresa cadastrada</Text></Box>
          ) : (
            companies
              .sort((a, b) => b.tokensUsed - a.tokensUsed)
              .map((c, i) => {
                const pct = Math.round((c.tokensUsed / c.tokenLimit) * 100);
                return (
                  <Box key={c.id} px="lg" py="md" style={{ borderBottom: i < companies.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none" }}>
                    <Group justify="space-between" mb={6}>
                      <Group gap="sm">
                        <ThemeIcon size={28} radius="md" color={c.isActive ? "blue" : "gray"} variant="light">
                          <IconBuilding size={14} />
                        </ThemeIcon>
                        <Box>
                          <Text size="sm" fw={500}>{c.name}</Text>
                          <Text size="xs" c="dimmed">{c.tokensUsed.toLocaleString("pt-BR")} / {c.tokenLimit.toLocaleString("pt-BR")} tokens</Text>
                        </Box>
                      </Group>
                      <Group gap="sm">
                        <Badge color="gray" variant="outline" size="xs">{c.plan}</Badge>
                        <Text size="sm" fw={700} c={pct > 80 ? "red" : "dimmed"}>{pct}%</Text>
                      </Group>
                    </Group>
                    <Progress value={pct} color={pct > 80 ? "red" : pct > 60 ? "yellow" : "blue"} size="sm" radius="xl" />
                  </Box>
                );
              })
          )}
        </Card>
      )}
    </Stack>
  );
}

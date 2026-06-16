"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, SimpleGrid, Skeleton, ThemeIcon,
} from "@mantine/core";
import { IconRobot, IconPlus, IconBolt, IconWorld, IconLock } from "@tabler/icons-react";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  type: string;
  scope: string;
  isActive: boolean;
  triggerKeywords: string[];
}

const typeColors: Record<string, string> = {
  commercial: "blue", attendance: "violet", support: "green",
  qualification: "yellow", financial: "orange", followup: "pink", manager: "gray",
};
const typeLabels: Record<string, string> = {
  commercial: "Comercial", attendance: "Atendimento", support: "Suporte",
  qualification: "Qualificação", financial: "Financeiro", followup: "Follow-up", manager: "Gerente",
};

export default function AgentsPage() {
  const { data, isLoading } = useQuery<{ data: Agent[] }>({
    queryKey: ["agents"],
    queryFn: () => api.get("/agents").then((r) => r.data),
  });

  const agents = data?.data ?? [];

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Agentes de IA</Title>
          <Text c="dimmed" size="sm" mt={4}>{agents.length} agentes configurados</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} radius="md">Novo Agente</Button>
      </Group>

      {isLoading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={200} radius="lg" />)}
        </SimpleGrid>
      ) : agents.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconRobot size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhum agente criado</Text>
            <Text size="sm" c="dimmed">Crie agentes para automatizar o atendimento via WhatsApp</Text>
            <Button variant="light" leftSection={<IconPlus size={16} />} mt="xs">
              Criar primeiro agente
            </Button>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {agents.map((agent) => (
            <Card key={agent.id} padding="lg" radius="lg" withBorder shadow="sm">
              <Group justify="space-between" mb="md">
                <ThemeIcon
                  size={40}
                  radius="md"
                  color={typeColors[agent.type] ?? "gray"}
                  variant="light"
                >
                  <IconRobot size={20} />
                </ThemeIcon>
                <Badge color={agent.isActive ? "green" : "gray"} variant="light" size="sm">
                  {agent.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </Group>

              <Text fw={600} size="sm" mb={4}>{agent.name}</Text>
              {agent.description && (
                <Text size="xs" c="dimmed" mb="md" lineClamp={2}>{agent.description}</Text>
              )}

              <Group gap="xs" mb="sm">
                <Badge color={typeColors[agent.type] ?? "gray"} variant="light" size="xs">
                  {typeLabels[agent.type] ?? agent.type}
                </Badge>
                <Badge
                  color="gray"
                  variant="outline"
                  size="xs"
                  leftSection={agent.scope === "external" ? <IconWorld size={10} /> : <IconLock size={10} />}
                >
                  {agent.scope === "external" ? "Externo" : "Interno"}
                </Badge>
              </Group>

              {agent.triggerKeywords.length > 0 && (
                <Group gap={4}>
                  {agent.triggerKeywords.slice(0, 3).map((kw) => (
                    <Badge key={kw} size="xs" variant="outline" color="gray" leftSection={<IconBolt size={8} />}>
                      {kw}
                    </Badge>
                  ))}
                  {agent.triggerKeywords.length > 3 && (
                    <Text size="xs" c="dimmed">+{agent.triggerKeywords.length - 3}</Text>
                  )}
                </Group>
              )}
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

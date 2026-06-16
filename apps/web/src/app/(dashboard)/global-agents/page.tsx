"use client";
import { Box, Card, Title, Text, Stack, Group, Badge, SimpleGrid, ThemeIcon, Button } from "@mantine/core";
import { IconRobot, IconPlus, IconBolt, IconWorld } from "@tabler/icons-react";

const templateAgents = [
  { name: "Agente Comercial Padrão", type: "commercial", desc: "Qualifica leads, apresenta produtos e gera orçamentos automaticamente via WhatsApp.", keywords: ["orçamento", "preço", "alugar", "valor"] },
  { name: "Atendimento Inicial", type: "attendance", desc: "Recepciona o cliente, coleta nome e necessidade, direciona para o agente correto.", keywords: ["oi", "olá", "bom dia", "boa tarde"] },
  { name: "Follow-up Automático", type: "followup", desc: "Reativa leads que não responderam em 24h, 48h e 72h com mensagens personalizadas.", keywords: [] },
  { name: "Suporte Técnico", type: "support", desc: "Responde dúvidas sobre equipamentos, documentação e processo de locação.", keywords: ["dúvida", "problema", "ajuda", "como"] },
];

const typeColors: Record<string, string> = {
  commercial: "blue", attendance: "violet", followup: "pink", support: "green",
};

export default function GlobalAgentsPage() {
  return (
    <Stack gap="lg" maw={1100}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Agentes Globais</Title>
          <Text c="dimmed" size="sm" mt={4}>Templates de agentes disponíveis para todas as empresas</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />}>Novo Template</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {templateAgents.map((agent) => (
          <Card key={agent.name} padding="lg" radius="lg" withBorder shadow="sm">
            <Group justify="space-between" mb="md">
              <Group gap="sm">
                <ThemeIcon size={36} radius="md" color={typeColors[agent.type] ?? "gray"} variant="light">
                  <IconRobot size={18} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm">{agent.name}</Text>
                  <Badge size="xs" color={typeColors[agent.type]} variant="light">{agent.type}</Badge>
                </Box>
              </Group>
              <Group gap={4}>
                <IconWorld size={14} color="var(--mantine-color-gray-5)" />
                <Text size="xs" c="dimmed">Global</Text>
              </Group>
            </Group>
            <Text size="sm" c="dimmed" mb="md">{agent.desc}</Text>
            {agent.keywords.length > 0 && (
              <Group gap={4}>
                {agent.keywords.map((kw) => (
                  <Badge key={kw} size="xs" variant="outline" color="gray" leftSection={<IconBolt size={8} />}>{kw}</Badge>
                ))}
              </Group>
            )}
            <Button variant="light" size="xs" mt="md" fullWidth>Aplicar para empresa</Button>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

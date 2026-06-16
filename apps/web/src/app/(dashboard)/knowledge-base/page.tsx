"use client";
import { Box, Card, Title, Text, Stack, Group, Badge, Button, ThemeIcon, SimpleGrid } from "@mantine/core";
import { IconBook2, IconPlus, IconFileText, IconRobot } from "@tabler/icons-react";

const categories = [
  { name: "Scripts de Vendas", count: 0, icon: IconFileText, color: "blue", desc: "Roteiros e abordagens para o agente comercial" },
  { name: "FAQs de Produtos", count: 0, icon: IconBook2, color: "green", desc: "Perguntas frequentes sobre equipamentos" },
  { name: "Regras de Negócio", count: 0, icon: IconRobot, color: "violet", desc: "Políticas de desconto, frete e condições especiais" },
  { name: "Modelos de Orçamento", count: 0, icon: IconFileText, color: "orange", desc: "Templates de orçamentos e propostas" },
];

export default function KnowledgeBasePage() {
  return (
    <Stack gap="lg" maw={1100}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Biblioteca de Inteligência Central</Title>
          <Text c="dimmed" size="sm" mt={4}>Base de conhecimento compartilhada com todos os agentes da plataforma</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />}>Novo Documento</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {categories.map((cat) => (
          <Card key={cat.name} padding="lg" radius="lg" withBorder shadow="sm">
            <Group mb="md">
              <ThemeIcon size={40} radius="md" color={cat.color} variant="light">
                <cat.icon size={20} />
              </ThemeIcon>
              <Box>
                <Text fw={600} size="sm">{cat.name}</Text>
                <Text size="xs" c="dimmed">{cat.count} documentos</Text>
              </Box>
            </Group>
            <Text size="sm" c="dimmed" mb="md">{cat.desc}</Text>
            <Button variant="light" size="xs" fullWidth leftSection={<IconPlus size={12} />}>
              Adicionar documento
            </Button>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

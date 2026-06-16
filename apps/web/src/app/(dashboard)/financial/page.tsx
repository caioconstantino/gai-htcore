"use client";
import { Box, Card, Title, Text, Stack, Group, Badge, SimpleGrid, ThemeIcon } from "@mantine/core";
import { IconCurrencyDollar, IconTrendingUp, IconTrendingDown, IconReceipt } from "@tabler/icons-react";

export default function FinancialPage() {
  const kpis = [
    { label: "MRR", value: "R$ 0,00", icon: IconCurrencyDollar, color: "green", trend: "+0%" },
    { label: "ARR", value: "R$ 0,00", icon: IconTrendingUp, color: "blue", trend: "+0%" },
    { label: "Churn", value: "0%", icon: IconTrendingDown, color: "red", trend: "0%" },
    { label: "LTV médio", value: "R$ 0,00", icon: IconReceipt, color: "violet", trend: "+0%" },
  ];

  return (
    <Stack gap="lg" maw={1200}>
      <Box>
        <Title order={2} fw={700}>Financeiro</Title>
        <Text c="dimmed" size="sm" mt={4}>Receita, faturamento e métricas financeiras da plataforma</Text>
      </Box>
      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md">
        {kpis.map(({ label, value, icon: Icon, color, trend }) => (
          <Card key={label} padding="lg" radius="lg" withBorder shadow="sm">
            <Group justify="space-between" mb="sm">
              <ThemeIcon size={36} radius="md" color={color} variant="light"><Icon size={18} /></ThemeIcon>
              <Badge color="gray" variant="outline" size="xs">{trend}</Badge>
            </Group>
            <Text fw={800} size="xl">{value}</Text>
            <Text size="sm" c="dimmed" mt={4}>{label}</Text>
          </Card>
        ))}
      </SimpleGrid>
      <Card padding="lg" radius="lg" withBorder shadow="sm">
        <Text fw={600} size="sm" mb="md">Histórico de Faturamento</Text>
        <Box ta="center" py="xl">
          <IconReceipt size={48} color="var(--mantine-color-gray-3)" />
          <Text c="dimmed" mt="sm">Nenhuma transação registrada ainda</Text>
          <Text size="xs" c="dimmed">As cobranças aparecerão aqui quando houver empresas com planos pagos</Text>
        </Box>
      </Card>
    </Stack>
  );
}

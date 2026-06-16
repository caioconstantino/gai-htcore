"use client";
import { Box, Card, Title, Text, Stack, Group, Badge, Button, ThemeIcon, SimpleGrid } from "@mantine/core";
import { IconHeadset, IconPlus, IconClock, IconCheck, IconAlertCircle } from "@tabler/icons-react";

const tickets = [
  { id: "#001", company: "Locadora Exemplo", subject: "Agente não responde", status: "open", priority: "high", created: "2026-06-15" },
];

const statusColors: Record<string, string> = { open: "red", in_progress: "yellow", resolved: "green" };
const statusLabels: Record<string, string> = { open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido" };

export default function SupportPage() {
  return (
    <Stack gap="lg" maw={1000}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Suporte</Title>
          <Text c="dimmed" size="sm" mt={4}>Tickets de suporte das empresas clientes</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />}>Novo Ticket</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {[
          { label: "Abertos", value: tickets.filter(t => t.status === "open").length, icon: IconAlertCircle, color: "red" },
          { label: "Em andamento", value: tickets.filter(t => t.status === "in_progress").length, icon: IconClock, color: "yellow" },
          { label: "Resolvidos", value: tickets.filter(t => t.status === "resolved").length, icon: IconCheck, color: "green" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} padding="md" radius="lg" withBorder shadow="sm" ta="center">
            <ThemeIcon size={36} radius="md" color={color} variant="light" mx="auto" mb="xs"><Icon size={18} /></ThemeIcon>
            <Text fw={800} size="xl">{value}</Text>
            <Text size="sm" c="dimmed">{label}</Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card padding={0} radius="lg" withBorder shadow="sm">
        <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
          <Text fw={600} size="sm">Tickets Recentes</Text>
        </Box>
        {tickets.length === 0 ? (
          <Box ta="center" py="xl">
            <IconHeadset size={40} color="var(--mantine-color-gray-3)" />
            <Text c="dimmed" mt="sm">Nenhum ticket aberto</Text>
          </Box>
        ) : tickets.map((t, i) => (
          <Box key={t.id} px="lg" py="md" style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: i < tickets.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none" }}>
            <Box style={{ flex: 1 }}>
              <Group gap="sm">
                <Text size="xs" c="dimmed" fw={600}>{t.id}</Text>
                <Text size="sm" fw={500}>{t.subject}</Text>
              </Group>
              <Text size="xs" c="dimmed">{t.company} · {new Date(t.created).toLocaleDateString("pt-BR")}</Text>
            </Box>
            <Group gap="sm">
              <Badge color={t.priority === "high" ? "red" : "gray"} variant="outline" size="xs">{t.priority}</Badge>
              <Badge color={statusColors[t.status]} variant="light" size="sm">{statusLabels[t.status]}</Badge>
            </Group>
          </Box>
        ))}
      </Card>
    </Stack>
  );
}

"use client";
import { Box, Card, Title, Text, Stack, Group, Badge, ThemeIcon, Button, SimpleGrid } from "@mantine/core";
import { IconCloudUpload, IconDatabase, IconCheck, IconDownload } from "@tabler/icons-react";

const backups = [
  { name: "Backup Automático Diário", schedule: "Todo dia às 02:00", status: "active", lastRun: "2026-06-16 02:00", size: "—" },
  { name: "Backup Semanal", schedule: "Domingo às 03:00", status: "active", lastRun: "2026-06-15 03:00", size: "—" },
];

export default function BackupsPage() {
  return (
    <Stack gap="lg" maw={900}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Backups</Title>
          <Text c="dimmed" size="sm" mt={4}>Gerenciamento de backups automáticos da plataforma</Text>
        </Box>
        <Button leftSection={<IconCloudUpload size={16} />} variant="light">Backup Manual</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {[
          { label: "Banco de Dados", desc: "PostgreSQL via Supabase", status: "Protegido", icon: IconDatabase, color: "green" },
          { label: "Arquivos", desc: "Supabase Storage", status: "Protegido", icon: IconCloudUpload, color: "blue" },
        ].map(({ label, desc, status, icon: Icon, color }) => (
          <Card key={label} padding="lg" radius="lg" withBorder shadow="sm">
            <Group gap="sm" mb="xs">
              <ThemeIcon size={36} radius="md" color={color} variant="light"><Icon size={18} /></ThemeIcon>
              <Box>
                <Text fw={600} size="sm">{label}</Text>
                <Text size="xs" c="dimmed">{desc}</Text>
              </Box>
            </Group>
            <Badge color="green" variant="light" leftSection={<IconCheck size={10} />}>{status}</Badge>
          </Card>
        ))}
      </SimpleGrid>

      <Card padding={0} radius="lg" withBorder shadow="sm">
        <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
          <Text fw={600} size="sm">Rotinas de Backup</Text>
        </Box>
        {backups.map((b, i) => (
          <Box key={b.name} px="lg" py="md" style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: i < backups.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none" }}>
            <Box style={{ flex: 1 }}>
              <Text size="sm" fw={500}>{b.name}</Text>
              <Text size="xs" c="dimmed">{b.schedule} · Último: {b.lastRun}</Text>
            </Box>
            <Group gap="sm">
              <Badge color="green" variant="dot" size="sm">Ativo</Badge>
              <Button size="xs" variant="subtle" leftSection={<IconDownload size={12} />}>Baixar</Button>
            </Group>
          </Box>
        ))}
      </Card>

      <Card padding="md" radius="lg" withBorder style={{ borderColor: "var(--mantine-color-blue-3)", background: "var(--mantine-color-blue-0)" }}>
        <Group gap="sm">
          <IconDatabase size={16} color="var(--mantine-color-blue-6)" />
          <Text size="sm" c="blue.7">
            Os backups automáticos são gerenciados pelo Supabase. Configure políticas de retenção no painel do Supabase.
          </Text>
        </Group>
      </Card>
    </Stack>
  );
}

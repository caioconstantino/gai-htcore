"use client";
import { Box, Card, Title, Text, Stack, Group, Badge, Select } from "@mantine/core";
import { IconFileSearch, IconLogin, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

const mockLogs = [
  { id: 1, action: "login", user: "admin@htcore.com.br", entity: "auth", detail: "Login realizado", createdAt: new Date().toISOString(), level: "info" },
];

const actionIcons: Record<string, React.ElementType> = {
  login: IconLogin, create: IconPlus, update: IconPencil, delete: IconTrash,
};
const levelColors: Record<string, string> = { info: "blue", warning: "yellow", error: "red" };

export default function AuditLogsPage() {
  const [filter, setFilter] = useState<string | null>(null);
  const logs = filter ? mockLogs.filter(l => l.level === filter) : mockLogs;

  return (
    <Stack gap="lg" maw={1000}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Logs e Auditoria</Title>
          <Text c="dimmed" size="sm" mt={4}>Registro de todas as ações realizadas na plataforma</Text>
        </Box>
        <Select
          placeholder="Filtrar por nível"
          clearable
          value={filter}
          onChange={setFilter}
          data={[{ value: "info", label: "Info" }, { value: "warning", label: "Aviso" }, { value: "error", label: "Erro" }]}
          style={{ width: 180 }}
        />
      </Group>

      <Card padding={0} radius="lg" withBorder shadow="sm">
        <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
          <Text fw={600} size="sm">{logs.length} eventos registrados</Text>
        </Box>
        {logs.length === 0 ? (
          <Box ta="center" py="xl">
            <IconFileSearch size={40} color="var(--mantine-color-gray-3)" />
            <Text c="dimmed" mt="sm">Nenhum log encontrado</Text>
          </Box>
        ) : logs.map((log, i) => {
          const Icon = actionIcons[log.action] ?? IconFileSearch;
          return (
            <Box key={log.id} px="lg" py="sm" style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: i < logs.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none", fontFamily: "monospace" }}>
              <Icon size={16} color="var(--mantine-color-gray-5)" style={{ flexShrink: 0 }} />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap="sm">
                  <Text size="xs" fw={600}>{log.action.toUpperCase()}</Text>
                  <Text size="xs" c="dimmed">{log.entity}</Text>
                  <Text size="xs" c="dimmed">·</Text>
                  <Text size="xs">{log.detail}</Text>
                </Group>
                <Text size="xs" c="dimmed">{log.user} · {new Date(log.createdAt).toLocaleString("pt-BR")}</Text>
              </Box>
              <Badge color={levelColors[log.level] ?? "gray"} variant="light" size="xs">{log.level}</Badge>
            </Box>
          );
        })}
      </Card>
    </Stack>
  );
}

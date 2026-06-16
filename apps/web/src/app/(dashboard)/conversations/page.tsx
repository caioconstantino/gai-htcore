"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Box, Card, Text, Title, Stack, Group, Badge, Avatar, Skeleton } from "@mantine/core";
import { IconMessageCircle, IconRobot, IconUser } from "@tabler/icons-react";

interface Conversation {
  id: string;
  stage: string;
  isActive: boolean;
  handedOffToHuman: boolean;
  totalTokensUsed: number;
  updatedAt: string;
  lead: { name: string | null; phone: string };
  currentAgent: { name: string } | null;
  _count: { messages: number };
}

export default function ConversationsPage() {
  const { data, isLoading } = useQuery<{ data: Conversation[] }>({
    queryKey: ["conversations"],
    queryFn: () => api.get("/conversations").then((r) => r.data),
  });

  const conversations = data?.data ?? [];

  return (
    <Stack gap="lg" maw={1200}>
      <Box>
        <Title order={2} fw={700}>Conversas</Title>
        <Text c="dimmed" size="sm" mt={4}>{conversations.length} conversas registradas</Text>
      </Box>

      {isLoading ? (
        <Stack gap="sm">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={80} radius="lg" />)}
        </Stack>
      ) : conversations.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconMessageCircle size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhuma conversa ainda</Text>
            <Text size="sm" c="dimmed">Conversas do WhatsApp aparecerão aqui automaticamente</Text>
          </Stack>
        </Card>
      ) : (
        <Card padding={0} radius="lg" withBorder shadow="sm">
          <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <Text fw={600} size="sm">Histórico de Conversas</Text>
          </Box>
          {conversations.map((conv, i) => (
            <Box
              key={conv.id}
              px="lg"
              py="md"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                borderBottom: i < conversations.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
                cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mantine-color-gray-0)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Avatar
                radius="xl"
                size={40}
                color={conv.handedOffToHuman ? "orange" : "violet"}
              >
                {conv.handedOffToHuman ? <IconUser size={18} /> : <IconRobot size={18} />}
              </Avatar>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500}>{conv.lead.name ?? conv.lead.phone}</Text>
                <Group gap="xs" mt={2}>
                  {conv.currentAgent && (
                    <Text size="xs" c="dimmed">{conv.currentAgent.name}</Text>
                  )}
                  <Text size="xs" c="dimmed">· {conv._count.messages} msgs</Text>
                  <Text size="xs" c="dimmed">· {conv.totalTokensUsed} tokens</Text>
                </Group>
              </Box>
              <Group gap="sm">
                {conv.handedOffToHuman && (
                  <Badge color="orange" variant="light" size="sm">Humano</Badge>
                )}
                <Badge color={conv.isActive ? "green" : "gray"} variant="light" size="sm">
                  {conv.isActive ? "Ativa" : "Encerrada"}
                </Badge>
                <Text size="xs" c="dimmed">
                  {new Date(conv.updatedAt).toLocaleDateString("pt-BR")}
                </Text>
              </Group>
            </Box>
          ))}
        </Card>
      )}
    </Stack>
  );
}

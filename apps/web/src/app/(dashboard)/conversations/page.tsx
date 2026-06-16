"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Card, Text, Title, Stack, Group, Badge, Avatar, Skeleton,
  Select, Drawer, Divider, ScrollArea, Paper,
} from "@mantine/core";
import { IconMessageCircle, IconRobot, IconUser, IconFilter } from "@tabler/icons-react";

interface Message {
  id: string; role: string; content: string; createdAt: string;
}
interface Conversation {
  id: string; stage: string; isActive: boolean; handedOffToHuman: boolean;
  totalTokensUsed: number; updatedAt: string; companyId: string;
  lead: { name: string | null; phone: string };
  currentAgent: { name: string } | null;
  _count: { messages: number };
}
interface ConvDetail extends Conversation {
  messages: Message[];
}

const statusOptions = [
  { value: "", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "closed", label: "Encerradas" },
  { value: "handoff", label: "Aguardando humano" },
];

export default function ConversationsPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ data: Conversation[] }>({
    queryKey: ["conversations"],
    queryFn: () => api.get("/conversations").then((r) => r.data),
  });

  const { data: detail } = useQuery<ConvDetail>({
    queryKey: ["conversation", selected],
    queryFn: () => api.get(`/conversations/${selected}`).then((r) => r.data),
    enabled: !!selected,
  });

  const conversations = (data?.data ?? []).filter((c) => {
    if (statusFilter === "active") return c.isActive;
    if (statusFilter === "closed") return !c.isActive;
    if (statusFilter === "handoff") return c.handedOffToHuman;
    return true;
  });

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Conversas</Title>
          <Text c="dimmed" size="sm" mt={4}>{conversations.length} conversas</Text>
        </Box>
        <Select
          data={statusOptions} value={statusFilter} onChange={setStatusFilter}
          leftSection={<IconFilter size={14} />} style={{ width: 200 }} size="sm"
        />
      </Group>

      {/* Message viewer drawer */}
      <Drawer opened={!!selected} onClose={() => setSelected(null)} position="right" size="lg"
        title={detail ? (detail.lead.name ?? detail.lead.phone) : "Conversa"} padding="lg">
        {detail && (
          <Stack gap="md" h="100%">
            <Group gap="xs">
              {detail.handedOffToHuman && <Badge color="orange" variant="light">Aguardando humano</Badge>}
              <Badge color={detail.isActive ? "green" : "gray"} variant="light">
                {detail.isActive ? "Ativa" : "Encerrada"}
              </Badge>
              {detail.currentAgent && <Badge color="violet" variant="outline" size="sm">{detail.currentAgent.name}</Badge>}
              <Text size="xs" c="dimmed">{detail.totalTokensUsed} tokens</Text>
            </Group>
            <Divider />
            <ScrollArea style={{ flex: 1 }} offsetScrollbars>
              <Stack gap="sm">
                {detail.messages?.map((msg) => (
                  <Box key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-start" : "flex-end" }}>
                    <Paper
                      p="sm" radius="lg"
                      style={{
                        maxWidth: "75%",
                        background: msg.role === "user" ? "var(--mantine-color-gray-1)" : "var(--mantine-color-blue-6)",
                        color: msg.role === "user" ? "inherit" : "white",
                      }}
                    >
                      <Text size="sm">{msg.content}</Text>
                      <Text size="xs" mt={4} style={{ opacity: 0.7 }}>
                        {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </Paper>
                  </Box>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        )}
      </Drawer>

      {isLoading ? (
        <Stack gap="sm">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={80} radius="lg" />)}</Stack>
      ) : conversations.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconMessageCircle size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhuma conversa encontrada</Text>
            <Text size="sm" c="dimmed">Conversas do WhatsApp aparecerão aqui automaticamente</Text>
          </Stack>
        </Card>
      ) : (
        <Card padding={0} radius="lg" withBorder shadow="sm">
          <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <Text fw={600} size="sm">{conversations.length} conversa{conversations.length !== 1 ? "s" : ""}</Text>
          </Box>
          {conversations.map((conv, i) => (
            <Box key={conv.id} px="lg" py="md" onClick={() => setSelected(conv.id)}
              style={{
                display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "background 0.1s",
                borderBottom: i < conversations.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mantine-color-gray-0)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Avatar radius="xl" size={40} color={conv.handedOffToHuman ? "orange" : "violet"}>
                {conv.handedOffToHuman ? <IconUser size={18} /> : <IconRobot size={18} />}
              </Avatar>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500}>{conv.lead.name ?? conv.lead.phone}</Text>
                <Group gap="xs" mt={2}>
                  {conv.currentAgent && <Text size="xs" c="dimmed">{conv.currentAgent.name}</Text>}
                  <Text size="xs" c="dimmed">· {conv._count.messages} msgs · {conv.totalTokensUsed} tokens</Text>
                </Group>
              </Box>
              <Group gap="sm">
                {conv.handedOffToHuman && <Badge color="orange" variant="light" size="sm">Humano</Badge>}
                <Badge color={conv.isActive ? "green" : "gray"} variant="light" size="sm">
                  {conv.isActive ? "Ativa" : "Encerrada"}
                </Badge>
                <Text size="xs" c="dimmed">{new Date(conv.updatedAt).toLocaleDateString("pt-BR")}</Text>
              </Group>
            </Box>
          ))}
        </Card>
      )}
    </Stack>
  );
}

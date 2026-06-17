"use client";
import { useRef, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Card, Text, Title, Stack, Group, Badge, Avatar, Skeleton,
  Select, Drawer, Divider, ScrollArea, Paper, TextInput, ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconMessageCircle, IconRobot, IconUser, IconFilter,
  IconSend, IconRefresh,
} from "@tabler/icons-react";

interface Message {
  id: string;
  direction: string;   // "inbound" | "outbound"
  role: string;
  content: string;
  createdAt: string;
  agentId?: string | null;
  status?: string;
}
interface Conversation {
  id: string;
  isActive: boolean;
  handedOffToHuman: boolean;
  totalTokensUsed: number;
  updatedAt: string;
  companyId: string;
  lead: { id: string; name: string | null; phone: string };
  currentAgent: { id: string; name: string } | null;
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

function ChatBubble({ msg }: { msg: Message }) {
  const isOutbound = msg.direction === "outbound";
  return (
    <Box style={{ display: "flex", justifyContent: isOutbound ? "flex-end" : "flex-start" }}>
      {!isOutbound && (
        <Avatar size={28} radius="xl" color="gray" mr={8} mt={2}>
          <IconUser size={14} />
        </Avatar>
      )}
      <Paper
        p="sm" radius="lg"
        style={{
          maxWidth: "72%",
          background: isOutbound
            ? "var(--mantine-color-blue-6)"
            : "var(--mantine-color-gray-1)",
          color: isOutbound ? "white" : "inherit",
        }}
      >
        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{msg.content}</Text>
        <Text size="xs" mt={4} style={{ opacity: 0.6 }}>
          {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          {isOutbound && msg.status === "pending" && "  ·  aguardando"}
        </Text>
      </Paper>
      {isOutbound && (
        <Avatar size={28} radius="xl" color="blue" ml={8} mt={2}>
          <IconRobot size={14} />
        </Avatar>
      )}
    </Box>
  );
}

export default function ConversationsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<{ data: Conversation[] }>({
    queryKey: ["conversations"],
    queryFn: () => api.get("/conversations").then((r) => r.data),
  });

  const { data: detail, isFetching: detailFetching } = useQuery<ConvDetail>({
    queryKey: ["conversation", selected],
    queryFn: () => api.get(`/conversations/${selected}`).then((r) => r.data),
    enabled: !!selected,
    refetchInterval: 10_000,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [detail?.messages?.length]);

  const sendManual = useMutation({
    mutationFn: (text: string) =>
      api.post(`/conversations/${selected}/send`, { message: text }),
    onSuccess: () => {
      setManualText("");
      qc.invalidateQueries({ queryKey: ["conversation", selected] });
    },
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

      {/* Chat drawer */}
      <Drawer
        opened={!!selected}
        onClose={() => setSelected(null)}
        position="right"
        size="lg"
        title={
          <Group gap="xs" wrap="nowrap">
            <Text fw={600} truncate>
              {detail ? (detail.lead.name ?? detail.lead.phone) : "Conversa"}
            </Text>
            {detailFetching && <IconRefresh size={14} style={{ animation: "spin 1s linear infinite" }} />}
          </Group>
        }
        padding="lg"
        styles={{ body: { display: "flex", flexDirection: "column", height: "calc(100vh - 70px)" } }}
      >
        {detail && (
          <>
            <Group gap="xs" mb="xs">
              {detail.handedOffToHuman && <Badge color="orange" variant="light">Aguardando humano</Badge>}
              <Badge color={detail.isActive ? "green" : "gray"} variant="light">
                {detail.isActive ? "Ativa" : "Encerrada"}
              </Badge>
              {detail.currentAgent && (
                <Badge color="violet" variant="outline" size="sm">{detail.currentAgent.name}</Badge>
              )}
              <Text size="xs" c="dimmed">{detail.totalTokensUsed} tokens</Text>
            </Group>
            <Divider mb="sm" />

            {/* Message list */}
            <ScrollArea style={{ flex: 1 }} offsetScrollbars viewportRef={scrollRef}>
              <Stack gap="xs" pb="sm">
                {detail.messages?.length === 0 ? (
                  <Text size="sm" c="dimmed" ta="center" py="xl">Nenhuma mensagem ainda</Text>
                ) : (
                  detail.messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)
                )}
              </Stack>
            </ScrollArea>

            {/* Manual send (only when handed off to human) */}
            {detail.handedOffToHuman && detail.isActive && (
              <>
                <Divider my="xs" />
                <Group gap="xs" wrap="nowrap">
                  <TextInput
                    style={{ flex: 1 }}
                    placeholder="Responder como atendente humano..."
                    value={manualText}
                    onChange={(e) => setManualText(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && manualText.trim()) {
                        e.preventDefault();
                        sendManual.mutate(manualText.trim());
                      }
                    }}
                    disabled={sendManual.isPending}
                  />
                  <Tooltip label="Enviar">
                    <ActionIcon
                      size="lg"
                      color="blue"
                      variant="filled"
                      loading={sendManual.isPending}
                      disabled={!manualText.trim()}
                      onClick={() => sendManual.mutate(manualText.trim())}
                    >
                      <IconSend size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Conversation list */}
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
            <Box
              key={conv.id}
              px="lg" py="md"
              onClick={() => setSelected(conv.id)}
              style={{
                display: "flex", alignItems: "center", gap: 16, cursor: "pointer",
                transition: "background 0.1s",
                borderBottom: i < conversations.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
                background: selected === conv.id ? "var(--mantine-color-blue-0)" : "transparent",
              }}
              onMouseEnter={(e) => { if (selected !== conv.id) e.currentTarget.style.background = "var(--mantine-color-gray-0)"; }}
              onMouseLeave={(e) => { if (selected !== conv.id) e.currentTarget.style.background = "transparent"; }}
            >
              <Avatar radius="xl" size={40} color={conv.handedOffToHuman ? "orange" : "violet"}>
                {conv.handedOffToHuman ? <IconUser size={18} /> : <IconRobot size={18} />}
              </Avatar>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>{conv.lead.name ?? conv.lead.phone}</Text>
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

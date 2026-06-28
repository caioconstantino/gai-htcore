"use client";
import { useRef, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Card, Text, Title, Stack, Group, Badge, Avatar, Skeleton,
  Select, Drawer, Divider, ScrollArea, Paper, TextInput, ActionIcon,
  Tooltip, Tabs, Timeline, ThemeIcon, Button,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconMessageCircle, IconRobot, IconUser, IconFilter,
  IconSend, IconRefresh, IconMessages, IconBinaryTree2,
  IconRoute, IconBrain, IconCheck, IconAlertTriangle,
  IconPlayerPause, IconPlayerPlay,
} from "@tabler/icons-react";

interface Message {
  id: string;
  direction: string;
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
  aiPaused: boolean;
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
interface OrchLog {
  id: string;
  step: string;
  actor: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const statusOptions = [
  { value: "", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "closed", label: "Encerradas" },
  { value: "handoff", label: "Aguardando humano" },
  { value: "paused", label: "IA pausada" },
];

const stepConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  client_message: { color: "blue",   icon: <IconUser size={12} /> },
  router:         { color: "violet", icon: <IconRoute size={12} /> },
  specialist:     { color: "green",  icon: <IconBrain size={12} /> },
  orchestrator:   { color: "orange", icon: <IconBinaryTree2 size={12} /> },
  synthesizer:    { color: "orange", icon: <IconBinaryTree2 size={12} /> },
  send:           { color: "teal",   icon: <IconCheck size={12} /> },
  error:          { color: "red",    icon: <IconAlertTriangle size={12} /> },
  info:           { color: "gray",   icon: <IconMessages size={12} /> },
};

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
          background: isOutbound ? "var(--mantine-color-blue-6)" : "var(--mantine-color-gray-1)",
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

function OrchLogItem({ log }: { log: OrchLog }) {
  const cfg = stepConfig[log.step] ?? stepConfig.info;
  const [expanded, setExpanded] = useState(false);
  const hasMeta = log.metadata && Object.keys(log.metadata).length > 0;
  return (
    <Timeline.Item
      bullet={
        <ThemeIcon size={20} radius="xl" color={cfg.color} variant="filled">
          {cfg.icon}
        </ThemeIcon>
      }
    >
      <Box>
        <Group gap={6} mb={2}>
          <Badge size="xs" color={cfg.color} variant="light">{log.step.replace("_", " ")}</Badge>
          <Text size="xs" c="dimmed">
            {new Date(log.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </Text>
        </Group>
        <Text size="xs" fw={600} c="dimmed" mb={2}>{log.actor}</Text>
        <Text size="sm" style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{log.message}</Text>
        {hasMeta && (
          <Text
            size="xs" c="blue" style={{ cursor: "pointer" }} mt={2}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "▲ ocultar detalhes" : "▼ ver detalhes"}
          </Text>
        )}
        {expanded && hasMeta && (
          <Paper p="xs" mt={4} radius="sm" style={{ background: "var(--mantine-color-gray-0)", fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {JSON.stringify(log.metadata, null, 2)}
          </Paper>
        )}
      </Box>
    </Timeline.Item>
  );
}

export default function ConversationsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 768px)") ?? false;

  const { data, isLoading } = useQuery<{ data: Conversation[] }>({
    queryKey: ["conversations"],
    queryFn: () => api.get("/conversations").then((r) => r.data),
    refetchInterval: 15_000,
  });

  const { data: detail, isFetching: detailFetching } = useQuery<ConvDetail>({
    queryKey: ["conversation", selected],
    queryFn: () => api.get(`/conversations/${selected}`).then((r) => r.data),
    enabled: !!selected,
    refetchInterval: 10_000,
  });

  const { data: orchLogs } = useQuery<OrchLog[]>({
    queryKey: ["orch-logs", selected],
    queryFn: () => api.get(`/conversations/${selected}/orch-logs`).then((r) => r.data),
    enabled: !!selected,
    refetchInterval: 8_000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [detail?.messages?.length]);

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTo({ top: logScrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [orchLogs?.length]);

  const sendManual = useMutation({
    mutationFn: (text: string) => api.post(`/conversations/${selected}/send`, { message: text }),
    onSuccess: () => {
      setManualText("");
      qc.invalidateQueries({ queryKey: ["conversation", selected] });
    },
  });

  const pauseAI = useMutation({
    mutationFn: () => api.post(`/conversations/${selected}/pause`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation", selected] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const resumeAI = useMutation({
    mutationFn: () => api.post(`/conversations/${selected}/resume`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation", selected] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const conversations = (data?.data ?? []).filter((c) => {
    if (statusFilter === "active")  return c.isActive;
    if (statusFilter === "closed")  return !c.isActive;
    if (statusFilter === "handoff") return c.handedOffToHuman;
    if (statusFilter === "paused")  return c.aiPaused;
    return true;
  });

  const canSendManual = detail?.isActive && (detail.aiPaused || detail.handedOffToHuman);

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <Box>
          <Title order={isMobile ? 3 : 2} fw={700}>Conversas</Title>
          <Text c="dimmed" size="sm" mt={4}>{conversations.length} conversas</Text>
        </Box>
        <Select
          data={statusOptions} value={statusFilter} onChange={setStatusFilter}
          leftSection={<IconFilter size={14} />} style={{ width: isMobile ? 150 : 200 }} size="sm"
        />
      </Group>

      {/* Chat drawer */}
      <Drawer
        opened={!!selected}
        onClose={() => setSelected(null)}
        position="right"
        size={isMobile ? "100%" : "lg"}
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
            <Group gap="xs" mb="xs" justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                {detail.aiPaused && <Badge color="yellow" variant="filled">IA pausada</Badge>}
                {detail.handedOffToHuman && <Badge color="orange" variant="light">Aguardando humano</Badge>}
                <Badge color={detail.isActive ? "green" : "gray"} variant="light">
                  {detail.isActive ? "Ativa" : "Encerrada"}
                </Badge>
                {detail.currentAgent && (
                  <Badge color="violet" variant="outline" size="sm">{detail.currentAgent.name}</Badge>
                )}
                <Text size="xs" c="dimmed">{detail.totalTokensUsed} tokens</Text>
              </Group>

              {detail.isActive && (
                detail.aiPaused ? (
                  <Button
                    size="xs"
                    variant="filled"
                    color="green"
                    leftSection={<IconPlayerPlay size={14} />}
                    loading={resumeAI.isPending}
                    onClick={() => resumeAI.mutate()}
                  >
                    Retomar IA
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    variant="light"
                    color="orange"
                    leftSection={<IconPlayerPause size={14} />}
                    loading={pauseAI.isPending}
                    onClick={() => pauseAI.mutate()}
                  >
                    Pausar IA
                  </Button>
                )
              )}
            </Group>
            <Divider mb="sm" />

            <Tabs defaultValue="chat" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <Tabs.List mb="sm">
                <Tabs.Tab value="chat" leftSection={<IconMessages size={14} />}>
                  Chat ({detail.messages?.length ?? 0})
                </Tabs.Tab>
                <Tabs.Tab value="logs" leftSection={<IconBinaryTree2 size={14} />}>
                  Log Interno {orchLogs && orchLogs.length > 0 && (
                    <Badge size="xs" color="violet" variant="filled" ml={4}>{orchLogs.length}</Badge>
                  )}
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="chat" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <ScrollArea style={{ flex: 1 }} offsetScrollbars viewportRef={scrollRef}>
                  <Stack gap="xs" pb="sm">
                    {detail.messages?.length === 0 ? (
                      <Text size="sm" c="dimmed" ta="center" py="xl">Nenhuma mensagem ainda</Text>
                    ) : (
                      detail.messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)
                    )}
                  </Stack>
                </ScrollArea>

                {canSendManual && (
                  <>
                    <Divider my="xs" label={
                      <Text size="xs" c="dimmed">
                        {detail.aiPaused ? "IA pausada — você está no controle" : "Atendimento humano"}
                      </Text>
                    } />
                    <Group gap="xs" wrap="nowrap">
                      <TextInput
                        style={{ flex: 1 }}
                        placeholder={detail.aiPaused ? "Digite sua mensagem..." : "Responder como atendente humano..."}
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
                          size="lg" color="blue" variant="filled"
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
              </Tabs.Panel>

              <Tabs.Panel value="logs" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                {!orchLogs || orchLogs.length === 0 ? (
                  <Stack align="center" py="xl" gap="sm">
                    <IconBinaryTree2 size={36} color="var(--mantine-color-gray-4)" />
                    <Text size="sm" c="dimmed" ta="center">
                      Nenhum log de orquestração ainda.<br />
                      Envie uma mensagem pelo WhatsApp para ver o fluxo interno.
                    </Text>
                  </Stack>
                ) : (
                  <ScrollArea style={{ flex: 1 }} offsetScrollbars viewportRef={logScrollRef}>
                    <Box p="xs">
                      <Timeline active={orchLogs.length - 1} bulletSize={20} lineWidth={2}>
                        {orchLogs.map((log) => (
                          <OrchLogItem key={log.id} log={log} />
                        ))}
                      </Timeline>
                    </Box>
                  </ScrollArea>
                )}
              </Tabs.Panel>
            </Tabs>
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
              px={isMobile ? "md" : "lg"} py="md"
              onClick={() => setSelected(conv.id)}
              style={{
                display: "flex", alignItems: "center", gap: isMobile ? 12 : 16, cursor: "pointer",
                transition: "background 0.1s",
                borderBottom: i < conversations.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
                background: selected === conv.id ? "var(--mantine-color-blue-0)" : "transparent",
              }}
              onMouseEnter={(e) => { if (selected !== conv.id) e.currentTarget.style.background = "var(--mantine-color-gray-0)"; }}
              onMouseLeave={(e) => { if (selected !== conv.id) e.currentTarget.style.background = "transparent"; }}
            >
              <Avatar
                radius="xl" size={isMobile ? 34 : 40}
                color={conv.aiPaused ? "yellow" : conv.handedOffToHuman ? "orange" : "violet"}
              >
                {conv.aiPaused ? <IconPlayerPause size={16} /> : conv.handedOffToHuman ? <IconUser size={16} /> : <IconRobot size={16} />}
              </Avatar>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>{conv.lead.name ?? conv.lead.phone}</Text>
                <Group gap="xs" mt={2}>
                  {!isMobile && conv.currentAgent && <Text size="xs" c="dimmed">{conv.currentAgent.name}</Text>}
                  <Text size="xs" c="dimmed">{conv._count.messages} msgs</Text>
                  {!isMobile && <Text size="xs" c="dimmed">· {conv.totalTokensUsed} tokens</Text>}
                </Group>
              </Box>
              <Group gap="xs">
                {conv.aiPaused && (
                  <Badge color="yellow" variant="light" size="xs">{isMobile ? "⏸" : "IA pausada"}</Badge>
                )}
                {conv.handedOffToHuman && !conv.aiPaused && (
                  <Badge color="orange" variant="light" size="xs">{isMobile ? "👤" : "Humano"}</Badge>
                )}
                <Badge color={conv.isActive ? "green" : "gray"} variant="light" size="xs">
                  {conv.isActive ? "Ativa" : "Enc."}
                </Badge>
                {!isMobile && <Text size="xs" c="dimmed">{new Date(conv.updatedAt).toLocaleDateString("pt-BR")}</Text>}
              </Group>
            </Box>
          ))}
        </Card>
      )}
    </Stack>
  );
}

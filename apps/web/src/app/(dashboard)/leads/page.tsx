"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Card, Text, Title, Stack, Group, Badge, TextInput, Avatar, Skeleton,
  Select, Drawer, Divider, Timeline, Button, ActionIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconUsers, IconSearch, IconFlame, IconSnowflake, IconTemperature,
  IconPhone, IconBuilding, IconCalendar, IconMessageCircle, IconFilter, IconX,
} from "@tabler/icons-react";

interface Lead {
  id: string; name: string | null; phone: string; companyName: string | null;
  stage: string; temperature: string; source: string; lastInteractionAt: string;
  notes: string | null; _count?: { conversations: number; quotes: number };
}

const stageOptions = [
  { value: "", label: "Todos os estágios" },
  { value: "new", label: "Novo" }, { value: "qualifying", label: "Qualificando" },
  { value: "proposal", label: "Proposta" }, { value: "negotiation", label: "Negociação" },
  { value: "won", label: "Ganho" }, { value: "lost", label: "Perdido" },
];
const tempOptions = [
  { value: "", label: "Todas as temperaturas" },
  { value: "cold", label: "Frio" }, { value: "warm", label: "Morno" }, { value: "hot", label: "Quente" },
];
const stageColors: Record<string, string> = {
  new: "blue", qualifying: "violet", proposal: "yellow", negotiation: "orange", won: "green", lost: "red",
};

function TempIcon({ temp }: { temp: string }) {
  if (temp === "hot") return <IconFlame size={16} color="var(--mantine-color-orange-5)" />;
  if (temp === "cold") return <IconSnowflake size={16} color="var(--mantine-color-blue-4)" />;
  return <IconTemperature size={16} color="var(--mantine-color-yellow-5)" />;
}

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>("");
  const [tempFilter, setTempFilter] = useState<string | null>("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const qc = useQueryClient();

  const params = new URLSearchParams({ limit: "100" });
  if (stageFilter) params.set("stage", stageFilter);
  if (tempFilter) params.set("temperature", tempFilter);

  const { data, isLoading } = useQuery<{ leads: Lead[]; total: number }>({
    queryKey: ["leads", stageFilter, tempFilter],
    queryFn: () => api.get(`/leads?${params}`).then((r) => r.data),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api.patch(`/leads/${id}`, { stage }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); notifications.show({ message: "Estágio atualizado", color: "green" }); },
  });

  const leads = (data?.leads ?? []).filter((l) =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search) || l.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Leads</Title>
          <Text c="dimmed" size="sm" mt={4}>{data?.total ?? 0} leads cadastrados</Text>
        </Box>
      </Group>

      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Buscar por nome, telefone ou empresa..."
          leftSection={<IconSearch size={16} />}
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 240 }} size="sm"
        />
        <Select
          placeholder="Estágio" data={stageOptions} value={stageFilter}
          onChange={setStageFilter} leftSection={<IconFilter size={14} />}
          clearable style={{ width: 180 }} size="sm"
        />
        <Select
          placeholder="Temperatura" data={tempOptions} value={tempFilter}
          onChange={setTempFilter} clearable style={{ width: 180 }} size="sm"
        />
      </Group>

      {/* Lead detail drawer */}
      <Drawer
        opened={!!selected} onClose={() => setSelected(null)}
        position="right" size="md" title={selected?.name ?? selected?.phone ?? "Lead"}
        padding="lg"
      >
        {selected && (
          <Stack gap="md">
            <Group gap="xs">
              <TempIcon temp={selected.temperature} />
              <Badge color={stageColors[selected.stage] ?? "gray"} variant="light">
                {stageOptions.find((s) => s.value === selected.stage)?.label ?? selected.stage}
              </Badge>
              <Badge variant="outline" color="gray" size="sm">{selected.source}</Badge>
            </Group>
            <Divider />
            <Group gap="sm"><IconPhone size={16} /><Text size="sm">{selected.phone}</Text></Group>
            {selected.companyName && <Group gap="sm"><IconBuilding size={16} /><Text size="sm">{selected.companyName}</Text></Group>}
            <Group gap="sm">
              <IconCalendar size={16} />
              <Text size="sm">Último contato: {new Date(selected.lastInteractionAt).toLocaleDateString("pt-BR")}</Text>
            </Group>
            {selected._count && (
              <Group gap="lg">
                <Group gap="xs"><IconMessageCircle size={16} /><Text size="sm">{selected._count.conversations} conversas</Text></Group>
              </Group>
            )}
            {selected.notes && (
              <>
                <Divider label="Notas" />
                <Text size="sm" c="dimmed">{selected.notes}</Text>
              </>
            )}
            <Divider label="Mover para estágio" />
            <Group gap="xs" wrap="wrap">
              {stageOptions.filter((s) => s.value && s.value !== selected.stage).map((s) => (
                <Button key={s.value} size="xs" variant="light"
                  color={stageColors[s.value] ?? "gray"}
                  onClick={() => { stageMutation.mutate({ id: selected.id, stage: s.value }); setSelected({ ...selected, stage: s.value }); }}>
                  → {s.label}
                </Button>
              ))}
            </Group>
          </Stack>
        )}
      </Drawer>

      {isLoading ? (
        <Stack gap="sm">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={72} radius="lg" />)}</Stack>
      ) : leads.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconUsers size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhum lead encontrado</Text>
            <Text size="sm" c="dimmed">{search || stageFilter || tempFilter ? "Tente outros filtros" : "Leads do WhatsApp aparecerão aqui automaticamente"}</Text>
          </Stack>
        </Card>
      ) : (
        <Card padding={0} radius="lg" withBorder shadow="sm">
          <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <Text fw={600} size="sm">{leads.length} lead{leads.length !== 1 ? "s" : ""}</Text>
          </Box>
          {leads.map((lead, i) => (
            <Box key={lead.id} px="lg" py="md" onClick={() => setSelected(lead)}
              style={{
                display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "background 0.1s",
                borderBottom: i < leads.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mantine-color-gray-0)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Avatar color="blue" radius="xl" size={40}>
                {lead.name?.charAt(0)?.toUpperCase() ?? lead.phone.slice(-2)}
              </Avatar>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs">
                  <Text size="sm" fw={500}>{lead.name ?? "Sem nome"}</Text>
                  <TempIcon temp={lead.temperature} />
                </Group>
                <Text size="xs" c="dimmed">{lead.phone}{lead.companyName ? ` · ${lead.companyName}` : ""}</Text>
              </Box>
              <Group gap="sm">
                <Badge color={stageColors[lead.stage] ?? "gray"} variant="light" size="sm">
                  {stageOptions.find((s) => s.value === lead.stage)?.label ?? lead.stage}
                </Badge>
                <Text size="xs" c="dimmed">{new Date(lead.lastInteractionAt).toLocaleDateString("pt-BR")}</Text>
              </Group>
            </Box>
          ))}
        </Card>
      )}
    </Stack>
  );
}

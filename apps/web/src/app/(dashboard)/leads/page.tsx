"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Card, Text, Title, Stack, Group, Badge, TextInput, Avatar, Skeleton,
  Select, Drawer, Divider, Button, Modal, Grid, Textarea, ScrollArea, Anchor,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconUsers, IconSearch, IconFlame, IconSnowflake, IconTemperature,
  IconPhone, IconBuilding, IconCalendar, IconMessageCircle, IconFilter,
  IconPlus, IconEdit, IconTrash, IconMapPin, IconId, IconTag,
  IconExternalLink,
} from "@tabler/icons-react";

interface Lead {
  id: string;
  name: string | null;
  phone: string;
  companyName: string | null;
  document: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  stage: string;
  temperature: string;
  source: string;
  leadOrigin: string | null;
  notes: string | null;
  lastInteractionAt: string;
  createdAt: string;
  _count?: { conversations: number; quotes: number };
}

interface LeadConversation {
  id: string;
  isActive: boolean;
  handedOffToHuman: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

interface LeadDetail extends Lead {
  conversations: LeadConversation[];
}

const STAGES = [
  { value: "new", label: "Novo", color: "blue" },
  { value: "qualifying", label: "Qualificando", color: "violet" },
  { value: "proposal", label: "Proposta", color: "yellow" },
  { value: "negotiation", label: "Negociação", color: "orange" },
  { value: "won", label: "Ganho", color: "green" },
  { value: "lost", label: "Perdido", color: "red" },
];

const TEMPS = [
  { value: "cold", label: "Frio" },
  { value: "warm", label: "Morno" },
  { value: "hot", label: "Quente" },
];

const SOURCES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "manual", label: "Cadastro manual" },
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "email", label: "E-mail" },
  { value: "outro", label: "Outro" },
];

const STATES_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]
  .map((s) => ({ value: s, label: s }));

function stageName(s: string) { return STAGES.find((x) => x.value === s)?.label ?? s; }
function stageColor(s: string) { return STAGES.find((x) => x.value === s)?.color ?? "gray"; }

function TempIcon({ temp }: { temp: string }) {
  if (temp === "hot") return <IconFlame size={15} color="var(--mantine-color-orange-5)" />;
  if (temp === "cold") return <IconSnowflake size={15} color="var(--mantine-color-blue-4)" />;
  return <IconTemperature size={15} color="var(--mantine-color-yellow-6)" />;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap">
      <Box mt={2} c="dimmed" style={{ flexShrink: 0 }}>{icon}</Box>
      <Box>
        <Text size="xs" c="dimmed" lh={1.2}>{label}</Text>
        <Text size="sm">{value}</Text>
      </Box>
    </Group>
  );
}

// ── Form default values ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "", phone: "", companyName: "", document: "",
  address: "", neighborhood: "", city: "", state: "",
  source: "manual", leadOrigin: "", stage: "new", temperature: "warm", notes: "",
};

// ── LeadFormModal ─────────────────────────────────────────────────────────────

function LeadFormModal({ opened, onClose, initial, onSave, saving }: {
  opened: boolean;
  onClose: () => void;
  initial: Lead | null;
  onSave: (values: typeof EMPTY_FORM) => void;
  saving: boolean;
}) {
  const form = useForm({ initialValues: EMPTY_FORM });

  useEffect(() => {
    if (!opened) return;
    if (initial) {
      form.setValues({
        name: initial.name ?? "",
        phone: initial.phone,
        companyName: initial.companyName ?? "",
        document: initial.document ?? "",
        address: initial.address ?? "",
        neighborhood: initial.neighborhood ?? "",
        city: initial.city ?? "",
        state: initial.state ?? "",
        source: initial.source,
        leadOrigin: initial.leadOrigin ?? "",
        stage: initial.stage,
        temperature: initial.temperature,
        notes: initial.notes ?? "",
      });
    } else {
      form.setValues(EMPTY_FORM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, initial?.id]);

  return (
    <Modal
      opened={opened} onClose={onClose}
      title={<Text fw={700}>{initial ? "Editar Lead" : "Novo Lead"}</Text>}
      size="lg" padding="lg"
    >
      <form onSubmit={form.onSubmit(onSave)}>
        <Stack gap="md">
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Nome" placeholder="João da Silva" {...form.getInputProps("name")} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Telefone" placeholder="5511999999999" required
                description="Com código do país, ex: 5511999999999"
                {...form.getInputProps("phone")} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Empresa" placeholder="Nome da empresa" {...form.getInputProps("companyName")} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="CPF / CNPJ" placeholder="000.000.000-00" {...form.getInputProps("document")} />
            </Grid.Col>
          </Grid>

          <Divider label="Endereço" labelPosition="left" />
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 8 }}>
              <TextInput label="Logradouro" placeholder="Rua, número, complemento" {...form.getInputProps("address")} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput label="Bairro" placeholder="Bairro" {...form.getInputProps("neighborhood")} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 8 }}>
              <TextInput label="Cidade" placeholder="Cidade" {...form.getInputProps("city")} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Select label="Estado" placeholder="UF" data={STATES_BR} searchable
                {...form.getInputProps("state")} />
            </Grid.Col>
          </Grid>

          <Divider label="CRM" labelPosition="left" />
          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select label="Estágio" data={STAGES.map((s) => ({ value: s.value, label: s.label }))}
                {...form.getInputProps("stage")} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select label="Temperatura" data={TEMPS} {...form.getInputProps("temperature")} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select label="Origem" data={SOURCES} {...form.getInputProps("source")} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput label="Canal de origem" placeholder="ex: Google Ads, Feira, Instagram..."
                {...form.getInputProps("leadOrigin")} />
            </Grid.Col>
          </Grid>

          <Textarea label="Notas" placeholder="Observações sobre o lead..." rows={3}
            {...form.getInputProps("notes")} />

          <Group justify="flex-end" gap="sm" mt="xs">
            <Button variant="default" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving}>{initial ? "Salvar alterações" : "Criar lead"}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── LeadDrawer ────────────────────────────────────────────────────────────────

function LeadDrawer({ lead, detail, opened, onClose, onEdit, onDelete, onStageChange }: {
  lead: Lead | null;
  detail: LeadDetail | undefined;
  opened: boolean;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onStageChange: (stage: string) => void;
}) {
  if (!lead) return null;
  const full = detail ?? lead as Partial<LeadDetail>;

  const addressParts = [full.address, full.neighborhood, full.city, full.state].filter(Boolean).join(", ");

  return (
    <Drawer
      opened={opened} onClose={onClose}
      position="right" size="lg"
      title={
        <Group gap="sm" wrap="nowrap">
          <Avatar color="blue" radius="xl" size={36}>
            {lead.name?.charAt(0)?.toUpperCase() ?? lead.phone.slice(-2)}
          </Avatar>
          <Box>
            <Text fw={600} size="md">{lead.name ?? "Sem nome"}</Text>
            <Text size="xs" c="dimmed">{lead.phone}</Text>
          </Box>
        </Group>
      }
      padding="lg"
    >
      <ScrollArea h="calc(100vh - 80px)" offsetScrollbars>
        <Stack gap="md">

          {/* Status badges */}
          <Group gap="xs" wrap="wrap">
            <TempIcon temp={lead.temperature} />
            <Badge color={stageColor(lead.stage)} variant="light" size="md">
              {stageName(lead.stage)}
            </Badge>
            <Badge variant="outline" color="gray" size="sm">
              {SOURCES.find((s) => s.value === lead.source)?.label ?? lead.source}
            </Badge>
            {lead._count && (
              <Badge variant="dot" color="blue" size="sm">
                {lead._count.conversations} conversa{lead._count.conversations !== 1 ? "s" : ""}
              </Badge>
            )}
          </Group>

          {/* Actions */}
          <Group gap="xs">
            <Button size="xs" variant="light" leftSection={<IconEdit size={14} />}
              onClick={() => onEdit(lead)}>
              Editar
            </Button>
            <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />}
              onClick={() => onDelete(lead)}>
              Excluir
            </Button>
          </Group>

          <Divider />

          {/* Contact info */}
          <Stack gap="sm">
            <InfoRow icon={<IconPhone size={15} />} label="Telefone" value={lead.phone} />
            {full.companyName && (
              <InfoRow icon={<IconBuilding size={15} />} label="Empresa" value={full.companyName} />
            )}
            {full.document && (
              <InfoRow icon={<IconId size={15} />} label="CPF / CNPJ" value={full.document} />
            )}
            {addressParts && (
              <InfoRow icon={<IconMapPin size={15} />} label="Endereço" value={addressParts} />
            )}
            {full.leadOrigin && (
              <InfoRow icon={<IconTag size={15} />} label="Canal de origem" value={full.leadOrigin} />
            )}
            <InfoRow
              icon={<IconCalendar size={15} />}
              label="Último contato"
              value={new Date(lead.lastInteractionAt).toLocaleDateString("pt-BR")}
            />
            {full.createdAt && (
              <InfoRow
                icon={<IconCalendar size={15} />}
                label="Cadastrado em"
                value={new Date(full.createdAt).toLocaleDateString("pt-BR")}
              />
            )}
          </Stack>

          {/* Notes */}
          {full.notes && (
            <>
              <Divider label="Notas" labelPosition="left" />
              <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>{full.notes}</Text>
            </>
          )}

          {/* Conversations */}
          <Divider label={`Conversas${detail ? ` (${detail.conversations.length})` : ""}`} labelPosition="left" />
          {!detail ? (
            <Stack gap="xs">
              <Skeleton height={52} radius="md" />
              <Skeleton height={52} radius="md" />
            </Stack>
          ) : detail.conversations.length === 0 ? (
            <Text size="sm" c="dimmed">Nenhuma conversa ainda.</Text>
          ) : (
            <Stack gap="xs">
              {detail.conversations.slice(0, 8).map((conv) => (
                <Card key={conv.id} padding="sm" radius="md" withBorder>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <IconMessageCircle size={15} color="var(--mantine-color-blue-5)" />
                      <Box>
                        <Text size="xs" fw={500}>
                          {new Date(conv.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </Text>
                        <Text size="xs" c="dimmed">{conv._count.messages} mensagens</Text>
                      </Box>
                    </Group>
                    <Group gap="xs" wrap="nowrap">
                      {conv.handedOffToHuman && <Badge size="xs" color="orange" variant="light">Humano</Badge>}
                      <Badge size="xs" color={conv.isActive ? "green" : "gray"} variant="dot">
                        {conv.isActive ? "Ativa" : "Encerrada"}
                      </Badge>
                      <Anchor href="/conversations" size="xs" c="dimmed" style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        ver <IconExternalLink size={10} />
                      </Anchor>
                    </Group>
                  </Group>
                </Card>
              ))}
              {detail.conversations.length > 8 && (
                <Text size="xs" c="dimmed" ta="center">
                  +{detail.conversations.length - 8} conversas mais antigas
                </Text>
              )}
            </Stack>
          )}

          {/* Stage change */}
          <Divider label="Mover para estágio" labelPosition="left" />
          <Group gap="xs" wrap="wrap">
            {STAGES.filter((s) => s.value !== lead.stage).map((s) => (
              <Button key={s.value} size="xs" variant="light" color={s.color}
                onClick={() => onStageChange(s.value)}>
                → {s.label}
              </Button>
            ))}
          </Group>
        </Stack>
      </ScrollArea>
    </Drawer>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>("");
  const [tempFilter, setTempFilter] = useState<string | null>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const qc = useQueryClient();

  const params = new URLSearchParams({ limit: "100" });
  if (stageFilter) params.set("stage", stageFilter);
  if (tempFilter) params.set("temperature", tempFilter);
  if (search) params.set("q", search);

  const { data, isLoading } = useQuery<{ leads: Lead[]; total: number }>({
    queryKey: ["leads", stageFilter, tempFilter, search],
    queryFn: () => api.get(`/leads?${params}`).then((r) => r.data),
  });

  const { data: detail } = useQuery<LeadDetail>({
    queryKey: ["lead-detail", selectedId],
    queryFn: () => api.get(`/leads/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const invalidateLeads = useCallback(() => qc.invalidateQueries({ queryKey: ["leads"] }), [qc]);

  const patchMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<typeof EMPTY_FORM> & { id: string; stage?: string }) =>
      api.patch(`/leads/${id}`, data),
    onSuccess: (res) => {
      invalidateLeads();
      qc.invalidateQueries({ queryKey: ["lead-detail", res.data.id] });
      notifications.show({ message: "Lead atualizado", color: "green" });
    },
    onError: () => notifications.show({ message: "Erro ao atualizar lead", color: "red" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => api.post("/leads", data),
    onSuccess: () => {
      invalidateLeads();
      setFormOpen(false);
      notifications.show({ message: "Lead criado com sucesso", color: "green" });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao criar lead";
      notifications.show({ message: msg, color: "red" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      invalidateLeads();
      setSelectedId(null);
      notifications.show({ message: "Lead excluído", color: "green" });
    },
    onError: () => notifications.show({ message: "Erro ao excluir lead", color: "red" }),
  });

  const openCreate = () => { setEditingLead(null); setFormOpen(true); };
  const openEdit = (lead: Lead) => { setEditingLead(lead); setFormOpen(true); };
  const confirmDelete = (lead: Lead) => setDeleteTarget(lead);

  const leads = data?.leads ?? [];
  const selectedLead = leads.find((l) => l.id === selectedId) ?? null;

  return (
    <Stack gap="lg" maw={1300}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Leads</Title>
          <Text c="dimmed" size="sm" mt={4}>{data?.total ?? 0} leads cadastrados</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Novo Lead
        </Button>
      </Group>

      {/* Filters */}
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Buscar por nome, telefone, empresa ou documento..."
          leftSection={<IconSearch size={16} />}
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 260 }} size="sm"
        />
        <Select
          placeholder="Estágio" size="sm" clearable
          data={[{ value: "", label: "Todos os estágios" }, ...STAGES.map((s) => ({ value: s.value, label: s.label }))]}
          value={stageFilter} onChange={setStageFilter}
          leftSection={<IconFilter size={14} />} style={{ width: 180 }}
        />
        <Select
          placeholder="Temperatura" size="sm" clearable
          data={[{ value: "", label: "Todas" }, ...TEMPS]}
          value={tempFilter} onChange={setTempFilter}
          style={{ width: 155 }}
        />
      </Group>

      {/* Lead detail drawer */}
      <LeadDrawer
        lead={selectedLead}
        detail={detail}
        opened={!!selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={openEdit}
        onDelete={confirmDelete}
        onStageChange={(stage) => {
          if (!selectedId) return;
          patchMutation.mutate({ id: selectedId, stage });
          // Optimistic update in list
          qc.setQueryData(
            ["leads", stageFilter, tempFilter, search],
            (old: { leads: Lead[]; total: number } | undefined) =>
              old ? { ...old, leads: old.leads.map((l) => (l.id === selectedId ? { ...l, stage } : l)) } : old,
          );
        }}
      />

      {/* Delete confirmation modal */}
      <Modal
        opened={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        title={<Text fw={700}>Excluir lead</Text>} size="sm" padding="lg"
      >
        <Text size="sm">
          Tem certeza que deseja excluir <strong>{deleteTarget?.name ?? deleteTarget?.phone}</strong>?
          {" "}Esta ação não pode ser desfeita.
        </Text>
        <Group justify="flex-end" gap="sm" mt="lg">
          <Button variant="default" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button color="red" loading={deleteMutation.isPending}
            onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}>
            Excluir
          </Button>
        </Group>
      </Modal>

      {/* Create / Edit modal */}
      <LeadFormModal
        opened={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editingLead}
        onSave={(values) => {
          if (editingLead) {
            patchMutation.mutate({ id: editingLead.id, ...values }, { onSuccess: () => setFormOpen(false) });
          } else {
            createMutation.mutate(values);
          }
        }}
        saving={createMutation.isPending || patchMutation.isPending}
      />

      {/* Lead list */}
      {isLoading ? (
        <Stack gap="sm">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={64} radius="lg" />)}
        </Stack>
      ) : leads.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconUsers size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhum lead encontrado</Text>
            <Text size="sm" c="dimmed">
              {search || stageFilter || tempFilter
                ? "Tente outros filtros ou limpe a busca."
                : "Leads do WhatsApp aparecem aqui automaticamente."}
            </Text>
            {!search && !stageFilter && !tempFilter && (
              <Button size="sm" variant="light" leftSection={<IconPlus size={14} />} onClick={openCreate}>
                Cadastrar primeiro lead
              </Button>
            )}
          </Stack>
        </Card>
      ) : (
        <Card padding={0} radius="lg" withBorder shadow="sm">
          {/* Table header */}
          <Box
            px="lg" py="sm"
            style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", background: "var(--mantine-color-gray-0)" }}
          >
            <Group gap={0} wrap="nowrap">
              <Text fw={600} size="xs" c="dimmed" style={{ flex: "0 0 220px" }}>LEAD</Text>
              <Text fw={600} size="xs" c="dimmed" style={{ flex: "0 0 160px" }}>EMPRESA</Text>
              <Text fw={600} size="xs" c="dimmed" style={{ flex: "0 0 155px" }}>TELEFONE</Text>
              <Text fw={600} size="xs" c="dimmed" style={{ flex: "0 0 150px" }}>ESTÁGIO</Text>
              <Text fw={600} size="xs" c="dimmed" style={{ flex: "0 0 90px" }}>TEMP.</Text>
              <Text fw={600} size="xs" c="dimmed" style={{ flex: 1 }}>ÚLTIMO CONTATO</Text>
            </Group>
          </Box>

          {leads.map((lead, i) => (
            <Box
              key={lead.id}
              px="lg" py="sm"
              onClick={() => setSelectedId(lead.id)}
              style={{
                display: "flex", alignItems: "center", cursor: "pointer",
                transition: "background 0.1s",
                borderBottom: i < leads.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
                background: selectedId === lead.id ? "var(--mantine-color-blue-0)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (selectedId !== lead.id)
                  (e.currentTarget as HTMLElement).style.background = "var(--mantine-color-gray-0)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  selectedId === lead.id ? "var(--mantine-color-blue-0)" : "transparent";
              }}
            >
              {/* Lead name + avatar */}
              <Group gap="sm" style={{ flex: "0 0 220px", minWidth: 0 }} wrap="nowrap">
                <Avatar color="blue" radius="xl" size={34} style={{ flexShrink: 0 }}>
                  {lead.name?.charAt(0)?.toUpperCase() ?? lead.phone.slice(-2)}
                </Avatar>
                <Box style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>{lead.name ?? "Sem nome"}</Text>
                  <Text size="xs" c="dimmed">
                    {lead._count?.conversations ?? 0} conv.{lead._count?.quotes ? ` · ${lead._count.quotes} orc.` : ""}
                  </Text>
                </Box>
              </Group>
              <Text size="sm" c="dimmed" style={{ flex: "0 0 160px" }} truncate>
                {lead.companyName ?? "—"}
              </Text>
              <Text size="sm" style={{ flex: "0 0 155px" }}>{lead.phone}</Text>
              <Box style={{ flex: "0 0 150px" }}>
                <Badge color={stageColor(lead.stage)} variant="light" size="sm">
                  {stageName(lead.stage)}
                </Badge>
              </Box>
              <Box style={{ flex: "0 0 90px" }}>
                <TempIcon temp={lead.temperature} />
              </Box>
              <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                {new Date(lead.lastInteractionAt).toLocaleDateString("pt-BR")}
              </Text>
            </Box>
          ))}
        </Card>
      )}
    </Stack>
  );
}

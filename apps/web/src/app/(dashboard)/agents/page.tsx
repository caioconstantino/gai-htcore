"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, SimpleGrid, Skeleton,
  ThemeIcon, Modal, TextInput, Textarea, ActionIcon, Menu, Select,
  Tabs, Divider, Drawer, ScrollArea, Paper, Tooltip, Alert,
  Loader, Center, Collapse, Switch,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconRobot, IconPlus, IconBolt, IconWorld, IconLock, IconDots,
  IconTrash, IconBoltOff, IconCheck, IconVariable, IconEdit,
  IconHistory, IconRestore, IconDeviceFloppy, IconTag,
  IconChevronRight, IconEye, IconEyeOff, IconInfoCircle,
  IconShieldLock, IconCrown,
} from "@tabler/icons-react";

interface DynamicField { key: string; label: string; type: string; placeholder?: string; description?: string; required: boolean; }
interface AgentTemplate { id: string; name: string; description: string | null; type: string; scope: string; triggerKeywords: string[]; dynamicFields: DynamicField[]; }
interface PhonePermission { id: string; phone: string; label: string | null; }
interface Agent {
  id: string; name: string; description: string | null; type: string; scope: string;
  isActive: boolean; isPrivate: boolean; triggerKeywords: string[]; prompt: string; promptVersion: number;
  templateId: string | null; dynamicFields: DynamicField[];
  aiProvider?: string | null; aiModel?: string | null;
  company?: { id: string; name: string; slug: string } | null;
  phonePermissions?: PhonePermission[];
}
interface PromptVersion { id: string; version: number; prompt: string; label: string | null; createdAt: string; }
interface DynamicValuesData { fields: DynamicField[]; values: Record<string, string>; autoFill: Record<string, string>; templateId: string | null; }

const typeColors: Record<string, string> = { commercial: "blue", attendance: "violet", support: "green", qualification: "yellow", followup: "pink", manager: "gray", orchestrator: "orange" };
const typeLabels: Record<string, string> = { commercial: "Comercial", attendance: "Atendimento", support: "Suporte", qualification: "Qualificação", followup: "Follow-up", manager: "Gerente", orchestrator: "Orquestrador" };

// ── Activate from template ─────────────────────────────────────────────────────
function ActivateModal({ template, onClose }: { template: AgentTemplate; onClose: () => void }) {
  const qc = useQueryClient();
  const fields = template.dynamicFields as DynamicField[];
  const form = useForm({ initialValues: Object.fromEntries(fields.map((f) => [f.key, ""])) });

  const mutation = useMutation({
    mutationFn: (dynamicValues: Record<string, string>) =>
      api.post("/agent-templates/activate", { templateId: template.id, dynamicValues }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      notifications.show({ message: `Agente "${template.name}" ativado!`, color: "green" });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao ativar agente";
      notifications.show({ message: msg, color: "red" });
    },
  });

  return (
    <Modal opened onClose={onClose} title={`Ativar: ${template.name}`} size="md" radius="lg">
      <Stack gap="md">
        {template.description && <Text size="sm" c="dimmed">{template.description}</Text>}
        {fields.length > 0 ? (
          <>
            <Divider label="Preencha os dados da sua empresa" />
            <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
              <Stack gap="md">
                {fields.map((f) => (
                  f.type === "textarea"
                    ? <Textarea key={f.key} label={f.label} description={f.description} placeholder={f.placeholder} required={f.required} minRows={3} {...form.getInputProps(f.key)} />
                    : <TextInput key={f.key} label={f.label} description={f.description} placeholder={f.placeholder} required={f.required} {...form.getInputProps(f.key)} />
                ))}
                <Group justify="flex-end">
                  <Button variant="subtle" onClick={onClose}>Cancelar</Button>
                  <Button type="submit" leftSection={<IconCheck size={16} />} loading={mutation.isPending}>Ativar agente</Button>
                </Group>
              </Stack>
            </form>
          </>
        ) : (
          <>
            <Text size="sm" c="dimmed">Este template não requer configurações adicionais.</Text>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={onClose}>Cancelar</Button>
              <Button leftSection={<IconCheck size={16} />} loading={mutation.isPending} onClick={() => mutation.mutate({})}>Ativar agente</Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}

// ── Phone permissions manager ─────────────────────────────────────────────────
type PhoneEntry = { phone: string; label: string };

function PhonePermissionsManager({ phones, setPhones }: {
  phones: PhoneEntry[];
  setPhones: (p: PhoneEntry[]) => void;
}) {
  const [phoneInput, setPhoneInput] = useState("");
  const [labelInput, setLabelInput] = useState("");

  function addPhone() {
    const phone = phoneInput.trim().replace(/\s/g, "");
    if (!phone || phones.some((p) => p.phone === phone)) return;
    setPhones([...phones, { phone, label: labelInput.trim() }]);
    setPhoneInput("");
    setLabelInput("");
  }

  return (
    <Stack gap="sm">
      <Group gap={4} wrap="wrap">
        {phones.map((p, i) => (
          <Badge key={p.phone} size="sm" variant="outline" color="indigo"
            rightSection={
              <ActionIcon size={12} variant="transparent" color="red"
                onClick={() => setPhones(phones.filter((_, j) => j !== i))}>
                ×
              </ActionIcon>
            }>
            {p.label ? `${p.label} (${p.phone})` : p.phone}
          </Badge>
        ))}
        {phones.length === 0 && <Text size="xs" c="dimmed">Nenhum número cadastrado</Text>}
      </Group>
      <Group gap="xs" wrap="nowrap">
        <TextInput
          size="xs" placeholder="+5511999999999"
          value={phoneInput} onChange={(e) => setPhoneInput(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhone(); } }}
          style={{ flex: 1 }}
        />
        <TextInput
          size="xs" placeholder="Rótulo (ex: João)" value={labelInput}
          onChange={(e) => setLabelInput(e.currentTarget.value)} style={{ flex: 1 }}
        />
        <Button size="xs" variant="light" color="indigo" onClick={addPhone} disabled={!phoneInput.trim()}>
          <IconPlus size={13} />
        </Button>
      </Group>
    </Stack>
  );
}

// ── Dynamic values editor (company admin view) ─────────────────────────────────
function DynamicValuesEditor({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [showPreview, { toggle: togglePreview }] = useDisclosure(false);
  const [isPrivate, setIsPrivate] = useState(agent.isPrivate);
  const [phones, setPhones] = useState<PhoneEntry[]>(
    agent.phonePermissions?.map((p) => ({ phone: p.phone, label: p.label ?? "" })) ?? []
  );

  const { data, isLoading } = useQuery<DynamicValuesData>({
    queryKey: ["dynamic-values", agent.id],
    queryFn: () => api.get(`/agents/${agent.id}/dynamic-values`).then((r) => r.data),
  });

  useEffect(() => {
    if (data?.values) setValues(data.values);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isPrivate && phones.length === 0) throw new Error("Adicione pelo menos 1 número para salvar como privado.");
      const fields = (data?.fields ?? []) as DynamicField[];
      if (fields.length > 0) await api.patch(`/agents/${agent.id}/dynamic-values`, { values });
      await api.patch(`/agents/${agent.id}`, { isPrivate });
      await api.put(`/agents/${agent.id}/phone-permissions`, { phones });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["prompt-versions", agent.id] });
      notifications.show({ message: "Configurações salvas com sucesso!", color: "green", icon: <IconCheck size={16} /> });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      notifications.show({ message: msg, color: "red" });
    },
  });

  // Build prompt preview by substituting values into the current agent prompt
  const previewPrompt = Object.entries(values).reduce(
    (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val || `{{${key}}}`),
    agent.prompt
  );

  const fields = (data?.fields ?? []) as DynamicField[];
  const autoFill = data?.autoFill ?? {};

  if (isLoading) return <Center py="xl"><Loader size="sm" /></Center>;

  return (
    <Stack gap="md" p="md">
      {fields.length === 0 ? (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" radius="md">
          Este agente não possui campos configuráveis. O prompt é gerenciado pelo administrador da plataforma.
        </Alert>
      ) : (
        <>
          <Alert icon={<IconShieldLock size={16} />} color="blue" variant="light" radius="md">
            <Text size="sm">Você pode personalizar os dados da sua empresa usados pelo agente. O texto base do prompt é gerenciado pelo administrador da plataforma.</Text>
          </Alert>

          {fields.map((field) => {
            const isAutoFilled = autoFill[field.key] && autoFill[field.key] === values[field.key];
            const InputComp = field.type === "textarea" ? Textarea : TextInput;
            return (
              <Box key={field.key}>
                <InputComp
                  label={
                    <Group gap={6}>
                      {field.label}
                      {field.required && <Text span c="red" size="xs">*</Text>}
                      {isAutoFilled && (
                        <Badge size="xs" color="teal" variant="light" leftSection={<IconCheck size={9} />}>
                          preenchido automaticamente
                        </Badge>
                      )}
                    </Group>
                  }
                  description={field.description}
                  placeholder={field.placeholder ?? `Valor para {{${field.key}}}`}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.currentTarget.value }))}
                  minRows={field.type === "textarea" ? 3 : undefined}
                />
              </Box>
            );
          })}

          {/* Prompt preview */}
          <Box>
            <Button
              variant="subtle" size="xs" color="gray"
              leftSection={showPreview ? <IconEyeOff size={13} /> : <IconEye size={13} />}
              onClick={togglePreview}
            >
              {showPreview ? "Ocultar preview" : "Ver como o agente vai usar esses dados"}
            </Button>
            <Collapse in={showPreview}>
              <Paper mt="xs" p="md" radius="md" style={{ background: "#0f172a", border: "1px solid #1e293b", maxHeight: 300, overflow: "auto" }}>
                <Text size="xs" style={{ fontFamily: "monospace", color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {previewPrompt}
                </Text>
              </Paper>
            </Collapse>
          </Box>
        </>
      )}

      <Divider label="Privacidade" labelPosition="left" />
      <Box>
        <Switch
          label="Agente Privado"
          description="Apenas números autorizados poderão usar este agente"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.currentTarget.checked)}
          color="indigo"
        />
        {isPrivate && (
          <Box mt="md">
            <Text size="sm" fw={600} mb={4}>Números autorizados</Text>
            <Text size="xs" c="dimmed" mb="sm">
              Somente estes números terão acesso ao agente. Pelo menos 1 obrigatório.
            </Text>
            <PhonePermissionsManager phones={phones} setPhones={setPhones} />
            {phones.length === 0 && (
              <Text size="xs" c="red" mt={4}>Adicione pelo menos 1 número para salvar como privado.</Text>
            )}
          </Box>
        )}
      </Box>

      <Group justify="flex-end" pt="xs">
        <Button variant="subtle" onClick={onClose}>Cancelar</Button>
        <Button leftSection={<IconDeviceFloppy size={15} />} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          Salvar configurações
        </Button>
      </Group>
    </Stack>
  );
}

// ── AI Model selector + cost estimator ───────────────────────────────────────
const USD_TO_BRL = 5.5;
// Base estimate for dropdown label: 1100 input + 300 output tokens per message
const BASE_INPUT_TOKENS = 1100;
const BASE_OUTPUT_TOKENS = 300;

const AI_MODELS = [
  { provider: "openai", value: "gpt-4o-mini",   label: "GPT-4o Mini",   badge: "Econômico",   badgeColor: "green",  inputPer1M: 0.15,  outputPer1M: 0.60  },
  { provider: "openai", value: "gpt-4o",         label: "GPT-4o",        badge: "Recomendado", badgeColor: "blue",   inputPer1M: 2.50,  outputPer1M: 10.00 },
  { provider: "openai", value: "gpt-4-turbo",    label: "GPT-4 Turbo",   badge: "Avançado",    badgeColor: "violet", inputPer1M: 10.00, outputPer1M: 30.00 },
  { provider: "openai", value: "gpt-3.5-turbo",  label: "GPT-3.5 Turbo", badge: "Legado",      badgeColor: "gray",   inputPer1M: 0.50,  outputPer1M: 1.50  },
] as const;

function costPerMsgBRL(inputPer1M: number, outputPer1M: number, inputTokens = BASE_INPUT_TOKENS, outputTokens = BASE_OUTPUT_TOKENS) {
  return ((inputTokens * inputPer1M + outputTokens * outputPer1M) / 1_000_000) * USD_TO_BRL;
}

function fmtBRL(value: number) {
  if (value < 0.01) return `R$ ${value.toFixed(4)}`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3 });
}

function ModelSelector({
  value, onChange, promptLength, defaultLabel = "Padrão da empresa",
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  promptLength: number;
  defaultLabel?: string;
}) {
  const selected = AI_MODELS.find((m) => m.value === value);
  const estimatedInput = selected ? Math.ceil(promptLength / 4) + 600 : BASE_INPUT_TOKENS;
  const cost = selected ? costPerMsgBRL(selected.inputPer1M, selected.outputPer1M, estimatedInput) : null;

  return (
    <Box>
      <Select
        label="Modelo de IA"
        description="Deixe em branco para usar o modelo padrão da empresa"
        placeholder={defaultLabel}
        clearable
        value={value ?? null}
        onChange={onChange}
        data={AI_MODELS.map((m) => ({ value: m.value, label: m.label }))}
        renderOption={({ option }) => {
          const m = AI_MODELS.find((x) => x.value === option.value);
          if (!m) return <Text size="sm">{option.label}</Text>;
          const brl = costPerMsgBRL(m.inputPer1M, m.outputPer1M);
          return (
            <Group justify="space-between" w="100%" wrap="nowrap">
              <Text size="sm" fw={500}>{m.label}</Text>
              <Group gap={4}>
                <Badge size="xs" color={m.badgeColor} variant="light">{m.badge}</Badge>
                <Text size="xs" c="dimmed">≈ {fmtBRL(brl)}/msg</Text>
              </Group>
            </Group>
          );
        }}
      />
      {cost !== null && (
        <Paper mt="xs" p="xs" radius="md" style={{ background: "var(--mantine-color-blue-0)", border: "1px solid var(--mantine-color-blue-2)" }}>
          <Group gap="xs" wrap="wrap">
            <Text size="xs" fw={600} c="blue">Custo estimado por mensagem:</Text>
            <Badge size="sm" color="blue" variant="filled">{fmtBRL(cost)}</Badge>
            <Text size="xs" c="dimmed">({estimatedInput} tokens entrada + {BASE_OUTPUT_TOKENS} saída)</Text>
          </Group>
        </Paper>
      )}
      {!value && (
        <Text size="xs" c="dimmed" mt={4}>Usando modelo configurado na empresa.</Text>
      )}
    </Box>
  );
}

// ── Full prompt editor (super_admin only) ─────────────────────────────────────
function PromptEditor({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const qc = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 768px)") ?? false;

  const [promptText, setPromptText] = useState(agent.prompt);
  const [keywords, setKeywords] = useState<string[]>(agent.triggerKeywords);
  const [aiModel, setAiModel] = useState<string | null>(agent.aiModel ?? null);
  const [isPrivate, setIsPrivate] = useState(agent.isPrivate);
  const [phones, setPhones] = useState<PhoneEntry[]>(
    agent.phonePermissions?.map((p) => ({ phone: p.phone, label: p.label ?? "" })) ?? []
  );
  const [kwInput, setKwInput] = useState("");
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveLabel, setShowSaveLabel] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const isDirty = promptText !== agent.prompt
    || JSON.stringify(keywords) !== JSON.stringify(agent.triggerKeywords)
    || aiModel !== (agent.aiModel ?? null)
    || isPrivate !== agent.isPrivate
    || JSON.stringify(phones.map((p) => p.phone).sort()) !== JSON.stringify((agent.phonePermissions ?? []).map((p) => p.phone).sort());

  const { data: versions, isLoading: versionsLoading } = useQuery<PromptVersion[]>({
    queryKey: ["prompt-versions", agent.id],
    queryFn: () => api.get(`/agents/${agent.id}/prompt-versions`).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isPrivate && phones.length === 0) throw new Error("Adicione pelo menos 1 número para salvar como privado.");
      await api.post(`/agents/${agent.id}/prompt-versions`, { prompt: promptText, label: saveLabel.trim() || undefined, keywords });
      await api.patch(`/agents/${agent.id}`, { aiModel: aiModel ?? null, aiProvider: aiModel ? "openai" : null, isPrivate });
      await api.put(`/agents/${agent.id}/phone-permissions`, { phones });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["prompt-versions", agent.id] });
      notifications.show({ message: "Prompt salvo como nova versão!", color: "green", icon: <IconCheck size={16} /> });
      setSaveLabel("");
      setShowSaveLabel(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao salvar prompt";
      notifications.show({ message: msg, color: "red" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => api.post(`/agents/${agent.id}/prompt-versions/${versionId}/restore`),
    onSuccess: (_, versionId) => {
      const v = versions?.find((x) => x.id === versionId);
      setPromptText(v?.prompt ?? promptText);
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["prompt-versions", agent.id] });
      notifications.show({ message: `v${v?.version} restaurada!`, color: "blue" });
      setRestoring(null);
    },
    onError: () => { notifications.show({ message: "Erro ao restaurar versão", color: "red" }); setRestoring(null); },
  });

  function addKeyword() {
    const kw = kwInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) setKeywords((prev) => [...prev, kw]);
    setKwInput("");
  }

  const vars = Array.from(new Set([...promptText.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])));

  function HistorySidebar() {
    return (
      <Stack gap={0} style={{ height: "100%" }}>
        <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
          <Group gap="xs">
            <ThemeIcon size={28} radius="md" color="violet" variant="light"><IconHistory size={14} /></ThemeIcon>
            <Box>
              <Text size="sm" fw={600}>Histórico</Text>
              <Text size="xs" c="dimmed">{versions?.length ?? 0} versões</Text>
            </Box>
          </Group>
        </Box>
        <ScrollArea style={{ flex: 1 }}>
          <Stack gap={0} p="xs">
            {versionsLoading && <Center py="xl"><Loader size="sm" /></Center>}
            {!versionsLoading && (!versions || versions.length === 0) && (
              <Text size="xs" c="dimmed" ta="center" py="xl">Nenhuma versão ainda.<br />Salve para iniciar o histórico.</Text>
            )}
            {versions?.map((v, i) => {
              const isCurrent = i === 0;
              return (
                <Box key={v.id} p="sm" mb={4} style={{ borderRadius: 8, background: isCurrent ? "var(--mantine-color-blue-0)" : "transparent", border: isCurrent ? "1px solid var(--mantine-color-blue-2)" : "1px solid transparent" }}>
                  <Group justify="space-between" mb={4} wrap="nowrap">
                    <Group gap={6}>
                      <Badge size="xs" color={isCurrent ? "blue" : "gray"} variant={isCurrent ? "filled" : "light"}>v{v.version}</Badge>
                      {isCurrent && <Badge size="xs" color="green" variant="light">atual</Badge>}
                    </Group>
                    {!isCurrent && (
                      <Tooltip label="Restaurar"><ActionIcon size="xs" variant="light" color="blue" loading={restoring === v.id} onClick={() => { setRestoring(v.id); restoreMutation.mutate(v.id); }}><IconRestore size={11} /></ActionIcon></Tooltip>
                    )}
                  </Group>
                  {v.label && <Group gap={4} mb={2}><IconTag size={10} color="var(--mantine-color-dimmed)" /><Text size="xs" fw={500} c="dimmed">{v.label}</Text></Group>}
                  <Text size="xs" c="dimmed">{new Date(v.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</Text>
                  <Text size="xs" c="dimmed" lineClamp={2} mt={4} style={{ fontFamily: "monospace", opacity: 0.6 }}>{v.prompt.slice(0, 80)}…</Text>
                  {!isCurrent && <Button size="xs" variant="subtle" color="blue" mt={4} fullWidth leftSection={<IconRestore size={12} />} loading={restoring === v.id} onClick={() => { setRestoring(v.id); restoreMutation.mutate(v.id); }}>Restaurar</Button>}
                </Box>
              );
            })}
          </Stack>
        </ScrollArea>
      </Stack>
    );
  }

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", flexShrink: 0 }}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm">
            <ThemeIcon size={36} radius="md" color={typeColors[agent.type] ?? "gray"} variant="light"><IconRobot size={18} /></ThemeIcon>
            <Box>
              <Text fw={700} size="sm">{agent.name}</Text>
              <Group gap={4}>
                <Badge size="xs" color={typeColors[agent.type] ?? "gray"} variant="light">{typeLabels[agent.type] ?? agent.type}</Badge>
                <Badge size="xs" color="gray" variant="outline">v{agent.promptVersion}</Badge>
              </Group>
            </Box>
          </Group>
          {isDirty && !showSaveLabel && (
            <Button size="sm" leftSection={<IconDeviceFloppy size={15} />} onClick={() => setShowSaveLabel(true)}>Salvar versão</Button>
          )}
        </Group>

        {showSaveLabel && (
          <Box mt="sm" p="sm" style={{ background: "var(--mantine-color-blue-0)", borderRadius: 8, border: "1px solid var(--mantine-color-blue-2)" }}>
            <Text size="xs" fw={600} mb={6} c="blue">Descreva esta versão (opcional)</Text>
            <Group gap="xs" wrap="nowrap">
              <TextInput
                size="xs" placeholder="Ex: Ajuste de tom, promoção de junho..."
                value={saveLabel} onChange={(e) => setSaveLabel(e.currentTarget.value)}
                leftSection={<IconTag size={13} />} style={{ flex: 1 }}
                onKeyDown={(e) => { if (e.key === "Enter") saveMutation.mutate(); }}
                autoFocus
              />
              <Button size="xs" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Salvar</Button>
              <Button size="xs" variant="subtle" color="gray" onClick={() => setShowSaveLabel(false)}>Cancelar</Button>
            </Group>
          </Box>
        )}
      </Box>

      {/* Body */}
      {isMobile ? (
        <Tabs defaultValue="editor" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Tabs.List px="md" style={{ flexShrink: 0 }}>
            <Tabs.Tab value="editor" leftSection={<IconEdit size={13} />}>Editor</Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={13} />}>
              Histórico {versions && versions.length > 0 && <Badge size="xs" ml={4} color="violet" variant="filled">{versions.length}</Badge>}
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="editor" style={{ flex: 1, overflow: "auto" }}>
            <EditorPanel promptText={promptText} setPromptText={setPromptText} keywords={keywords} setKeywords={setKeywords} kwInput={kwInput} setKwInput={setKwInput} addKeyword={addKeyword} vars={vars} aiModel={aiModel} setAiModel={setAiModel} isPrivate={isPrivate} setIsPrivate={setIsPrivate} phones={phones} setPhones={setPhones} />
          </Tabs.Panel>
          <Tabs.Panel value="history" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <HistorySidebar />
          </Tabs.Panel>
        </Tabs>
      ) : (
        <Box style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
          <Box style={{ flex: 1, overflow: "auto" }}>
            <EditorPanel promptText={promptText} setPromptText={setPromptText} keywords={keywords} setKeywords={setKeywords} kwInput={kwInput} setKwInput={setKwInput} addKeyword={addKeyword} vars={vars} aiModel={aiModel} setAiModel={setAiModel} isPrivate={isPrivate} setIsPrivate={setIsPrivate} phones={phones} setPhones={setPhones} />
          </Box>
          <Box style={{ width: 260, flexShrink: 0, borderLeft: "1px solid var(--mantine-color-gray-2)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <HistorySidebar />
          </Box>
        </Box>
      )}
    </Box>
  );
}

function EditorPanel({ promptText, setPromptText, keywords, setKeywords, kwInput, setKwInput, addKeyword, vars, aiModel, setAiModel, isPrivate, setIsPrivate, phones, setPhones }: {
  promptText: string; setPromptText: (v: string) => void;
  keywords: string[]; setKeywords: (fn: (prev: string[]) => string[]) => void;
  kwInput: string; setKwInput: (v: string) => void;
  addKeyword: () => void; vars: string[];
  aiModel: string | null; setAiModel: (v: string | null) => void;
  isPrivate: boolean; setIsPrivate: (v: boolean) => void;
  phones: PhoneEntry[]; setPhones: (p: PhoneEntry[]) => void;
}) {
  return (
    <Stack gap="md" p="md">
      {vars.length > 0 && (
        <Paper p="xs" radius="md" style={{ background: "var(--mantine-color-violet-0)", border: "1px solid var(--mantine-color-violet-2)" }}>
          <Group gap={6}>
            <IconVariable size={13} color="var(--mantine-color-violet-6)" />
            <Text size="xs" fw={600} c="violet.7">Variáveis no prompt:</Text>
            {vars.map((v) => <Badge key={v} size="xs" color="violet" variant="filled" style={{ fontFamily: "monospace" }}>{`{{${v}}}`}</Badge>)}
          </Group>
        </Paper>
      )}
      <Box>
        <Group justify="space-between" mb={6}>
          <Text size="sm" fw={600}>Prompt do Agente</Text>
          <Text size="xs" c="dimmed">{promptText.length} caracteres</Text>
        </Group>
        <Textarea
          value={promptText}
          onChange={(e) => setPromptText(e.currentTarget.value)}
          minRows={16} autosize maxRows={40}
          styles={{ input: { fontFamily: "monospace", fontSize: 13, lineHeight: 1.6, background: "#0f172a", color: "#e2e8f0", border: "1px solid #1e293b", borderRadius: 8 } }}
          placeholder={`Você é um assistente da {{empresa}}, especializado em...\n\nSeu objetivo é:\n- Atender o cliente de forma cordial\n- Apresentar os produtos disponíveis\n\nQuando houver intenção de compra, incluir [TRANSBORDO].`}
        />
        <Text size="xs" c="dimmed" mt={4}>
          Use <code style={{ background: "var(--mantine-color-gray-1)", padding: "1px 4px", borderRadius: 3 }}>{"{{variavel}}"}</code> para valores preenchidos pela empresa.
        </Text>
      </Box>
      <Box>
        <Text size="sm" fw={600} mb={6}>Palavras-chave de ativação</Text>
        <Text size="xs" c="dimmed" mb={8}>Mensagens com essas palavras direcionam ao agente.</Text>
        <Group gap="xs" mb={8} wrap="wrap">
          {keywords.map((kw) => (
            <Badge key={kw} size="sm" variant="outline" color="blue" rightSection={<ActionIcon size={12} variant="transparent" color="red" onClick={() => setKeywords((prev) => prev.filter((k) => k !== kw))}>×</ActionIcon>}>{kw}</Badge>
          ))}
          {keywords.length === 0 && <Text size="xs" c="dimmed">Nenhuma</Text>}
        </Group>
        <Group gap="xs" wrap="nowrap">
          <TextInput size="xs" placeholder="locação, andaime..." value={kwInput} onChange={(e) => setKwInput(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }} style={{ flex: 1 }} />
          <Button size="xs" variant="light" onClick={addKeyword} disabled={!kwInput.trim()}><IconPlus size={13} /></Button>
        </Group>
      </Box>

      <Divider label="Modelo de IA" labelPosition="left" />
      <ModelSelector value={aiModel} onChange={setAiModel} promptLength={promptText.length} />

      <Divider label="Privacidade" labelPosition="left" />
      <Box>
        <Switch
          label="Agente Privado"
          description="Apenas números autorizados poderão usar este agente via WhatsApp"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.currentTarget.checked)}
          color="indigo"
        />
        {isPrivate && (
          <Box mt="md" p="sm" style={{ background: "var(--mantine-color-indigo-0)", borderRadius: 8, border: "1px solid var(--mantine-color-indigo-2)" }}>
            <Text size="sm" fw={600} mb={4}>Números autorizados</Text>
            <Text size="xs" c="dimmed" mb="sm">
              Somente estes números terão acesso ao agente. Pelo menos 1 obrigatório.
            </Text>
            <PhonePermissionsManager phones={phones} setPhones={setPhones} />
            {phones.length === 0 && (
              <Text size="xs" c="red" mt={6}>Adicione pelo menos 1 número para salvar como privado.</Text>
            )}
          </Box>
        )}
      </Box>
    </Stack>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";
  const isMobile = useMediaQuery("(max-width: 768px)") ?? false;

  const [activating, setActivating] = useState<AgentTemplate | null>(null);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: agentsData, isLoading: loadingAgents } = useQuery<{ data: Agent[] }>({
    queryKey: ["agents"],
    queryFn: () => api.get("/agents").then((r) => r.data),
  });

  const { data: templatesData, isLoading: loadingTemplates } = useQuery<{ data: AgentTemplate[] }>({
    queryKey: ["agent-templates"],
    queryFn: () => api.get("/agent-templates").then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/agents/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); notifications.show({ message: "Agente removido", color: "orange" }); },
  });

  const allAgents = agentsData?.data ?? [];

  // Build unique company list for super_admin filter dropdown
  const companies = isSuperAdmin
    ? Array.from(new Map(allAgents.filter((a) => a.company).map((a) => [a.company!.id, a.company!])).values())
    : [];

  const agents = isSuperAdmin && companyFilter
    ? allAgents.filter((a) => a.company?.id === companyFilter)
    : allAgents;

  const templates = (templatesData?.data ?? []).filter((t) => !allAgents.some((a) => a.templateId === t.id && a.isActive));
  const hasOrchestrator = agents.some((a) => a.type === "orchestrator" && a.isActive);

  const drawerTitle = editing
    ? isSuperAdmin
      ? `Editor de Prompt — ${editing.name}`
      : `Configurar — ${editing.name}`
    : null;

  return (
    <Stack gap="lg" maw={1200}>
      <Box>
        <Title order={2} fw={700}>Agentes de IA</Title>
        <Text c="dimmed" size="sm" mt={4}>Seus agentes ativos e os modelos disponíveis para ativar</Text>
      </Box>

      {activating && <ActivateModal template={activating} onClose={() => setActivating(null)} />}

      {isSuperAdmin && companies.length > 0 && (
        <Select
          placeholder="Filtrar por empresa (todas)"
          data={companies.map((c) => ({ value: c.id, label: c.name }))}
          value={companyFilter}
          onChange={setCompanyFilter}
          clearable
          leftSection={<IconWorld size={15} />}
          maw={320}
        />
      )}

      {!isSuperAdmin && !loadingAgents && !hasOrchestrator && (
        <Alert icon={<IconCrown size={16} />} color="orange" radius="md" title="Orquestrador não configurado">
          Sua empresa precisa de um agente orquestrador para que o sistema de IA funcione. Ative o template de orquestrador na aba <strong>Ativar Agente</strong>.
        </Alert>
      )}

      {/* Editor drawer */}
      <Drawer
        opened={!!editing}
        onClose={() => setEditing(null)}
        position="right"
        size={isMobile ? "100%" : isSuperAdmin ? "70%" : "520px"}
        padding={0}
        withCloseButton
        title={<Text fw={600} size="sm">{drawerTitle}</Text>}
        styles={{
          header: { padding: "12px 16px", borderBottom: "1px solid var(--mantine-color-gray-2)" },
          body: { padding: 0, height: "calc(100% - 53px)", overflow: "auto" },
        }}
      >
        {editing && (
          isSuperAdmin
            ? <PromptEditor agent={editing} onClose={() => setEditing(null)} />
            : <DynamicValuesEditor agent={editing} onClose={() => setEditing(null)} />
        )}
      </Drawer>

      <Tabs defaultValue="active">
        <Tabs.List mb="md">
          <Tabs.Tab value="active" leftSection={<IconRobot size={16} />}>Meus Agentes ({agents.length})</Tabs.Tab>
          <Tabs.Tab value="templates" leftSection={<IconPlus size={16} />}>Ativar Agente ({templates.length} disponíveis)</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="active">
          {loadingAgents ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={220} radius="lg" />)}
            </SimpleGrid>
          ) : agents.length === 0 ? (
            <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
              <Stack align="center" py="xl" gap="sm">
                <IconRobot size={48} color="var(--mantine-color-gray-3)" />
                <Text fw={500} c="dimmed">Nenhum agente ativo</Text>
                <Text size="sm" c="dimmed">Vá na aba "Ativar Agente" para configurar um agente para sua empresa</Text>
              </Stack>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {agents.map((agent) => (
                <Card key={agent.id} padding="lg" radius="lg" withBorder shadow="sm" style={{ display: "flex", flexDirection: "column" }}>
                  <Group justify="space-between" mb="md">
                    <ThemeIcon size={40} radius="md" color={typeColors[agent.type] ?? "gray"} variant="light"><IconRobot size={20} /></ThemeIcon>
                    <Group gap={6}>
                      {agent.type === "orchestrator" && !isSuperAdmin && (
                        <Tooltip label="Este agente é obrigatório para o funcionamento do sistema" withArrow>
                          <Badge color="orange" variant="light" size="sm" leftSection={<IconCrown size={10} />}>Obrigatório</Badge>
                        </Tooltip>
                      )}
                      {agent.isPrivate && (
                        <Tooltip label={`Acesso restrito — ${agent.phonePermissions?.length ?? 0} número(s) autorizado(s)`} withArrow>
                          <Badge color="indigo" variant="light" size="sm" leftSection={<IconShieldLock size={10} />}>Privado</Badge>
                        </Tooltip>
                      )}
                      <Badge color={agent.isActive ? "green" : "gray"} variant="light" size="sm">{agent.isActive ? "Ativo" : "Inativo"}</Badge>
                      <Menu withinPortal position="bottom-end" shadow="sm">
                        <Menu.Target><ActionIcon variant="subtle" color="gray" size="sm"><IconDots size={14} /></ActionIcon></Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => setEditing(agent)}>
                            {isSuperAdmin ? "Editar Prompt" : "Configurar Agente"}
                          </Menu.Item>
                          {(isSuperAdmin || agent.type !== "orchestrator") && (
                            <Menu.Item leftSection={agent.isActive ? <IconBoltOff size={14} /> : <IconBolt size={14} />} onClick={() => toggleMutation.mutate({ id: agent.id, isActive: !agent.isActive })}>
                              {agent.isActive ? "Desativar" : "Ativar"}
                            </Menu.Item>
                          )}
                          {(isSuperAdmin || agent.type !== "orchestrator") && (
                            <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => deleteMutation.mutate(agent.id)}>Remover</Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>

                  <Text fw={600} size="sm" mb={4}>{agent.name}</Text>
                  {agent.description && <Text size="xs" c="dimmed" mb="sm" lineClamp={2}>{agent.description}</Text>}

                  <Group gap="xs" mb="sm">
                    {isSuperAdmin && agent.company && (
                      <Badge color="gray" variant="dot" size="xs">{agent.company.name}</Badge>
                    )}
                    <Badge color={typeColors[agent.type] ?? "gray"} variant="light" size="xs">{typeLabels[agent.type] ?? agent.type}</Badge>
                    <Badge color="gray" variant="outline" size="xs" leftSection={agent.scope === "external" ? <IconWorld size={10} /> : <IconLock size={10} />}>
                      {agent.scope === "external" ? "WhatsApp" : "Interno"}
                    </Badge>
                    <Badge color="gray" variant="light" size="xs" leftSection={<IconHistory size={9} />}>v{agent.promptVersion}</Badge>
                  </Group>

                  {agent.triggerKeywords.length > 0 && (
                    <Group gap={4} mb="md">
                      {agent.triggerKeywords.slice(0, 4).map((kw) => <Badge key={kw} size="xs" variant="outline" color="gray" leftSection={<IconBolt size={8} />}>{kw}</Badge>)}
                      {agent.triggerKeywords.length > 4 && <Text size="xs" c="dimmed">+{agent.triggerKeywords.length - 4}</Text>}
                    </Group>
                  )}

                  <Button variant="light" size="xs" mt="auto" leftSection={isSuperAdmin ? <IconEdit size={13} /> : <IconVariable size={13} />} rightSection={<IconChevronRight size={13} />} onClick={() => setEditing(agent)}>
                    {isSuperAdmin ? "Editar Prompt" : "Configurar Agente"}
                  </Button>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="templates">
          {loadingTemplates ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={200} radius="lg" />)}
            </SimpleGrid>
          ) : templates.length === 0 ? (
            <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
              <Stack align="center" py="xl" gap="sm">
                <IconCheck size={40} color="var(--mantine-color-green-4)" />
                <Text fw={500} c="dimmed">Todos os agentes disponíveis já estão ativos</Text>
              </Stack>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {templates.map((t) => (
                <Card key={t.id} padding="lg" radius="lg" withBorder shadow="sm">
                  <Group justify="space-between" mb="md">
                    <ThemeIcon size={40} radius="md" color={typeColors[t.type] ?? "gray"} variant="light"><IconRobot size={20} /></ThemeIcon>
                    <Badge color="blue" variant="light" size="sm">Disponível</Badge>
                  </Group>
                  <Text fw={600} size="sm" mb={4}>{t.name}</Text>
                  {t.description && <Text size="xs" c="dimmed" mb="sm" lineClamp={2}>{t.description}</Text>}
                  {t.dynamicFields.length > 0 && (
                    <Badge size="xs" color="violet" variant="light" leftSection={<IconVariable size={10} />} mb="sm">
                      {t.dynamicFields.length} campo{t.dynamicFields.length > 1 ? "s" : ""} para preencher
                    </Badge>
                  )}
                  <Button fullWidth size="xs" mt="auto" leftSection={<IconBolt size={14} />} onClick={() => setActivating(t)}>
                    Ativar este agente
                  </Button>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

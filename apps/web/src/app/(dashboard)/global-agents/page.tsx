"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, SimpleGrid, Skeleton,
  ThemeIcon, TextInput, Textarea, Select, Switch, TagsInput, ActionIcon,
  Menu, Divider, Paper, Tooltip, Drawer, ScrollArea, Loader, Center, Tabs, Modal, Alert,
  Slider, NumberInput,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconRobot, IconPlus, IconDots, IconPencil, IconTrash, IconBolt,
  IconVariable, IconX, IconCheck, IconHistory, IconDeviceFloppy,
  IconTag, IconRestore, IconEdit, IconChevronRight, IconShieldLock,
  IconAlertCircle, IconPower, IconSettings2, IconClock, IconAlertTriangle,
  IconMessageForward, IconArrowUp,
} from "@tabler/icons-react";

interface DynamicField {
  key: string; label: string; type: string;
  placeholder?: string; description?: string; required: boolean;
}
interface AgentTemplate {
  id: string; name: string; description: string | null; type: string;
  scope: string; isActive: boolean; isPrivate: boolean; autoActivate: boolean;
  triggerKeywords: string[];
  prompt: string; promptVersion: number; dynamicFields: DynamicField[];
  aiProvider?: string | null; aiModel?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  responseDelayMs?: number;
  activeHoursStart?: number | null;
  activeHoursEnd?: number | null;
  offHoursMessage?: string | null;
  initialMessage?: string | null;
  handoffTriggers?: string[];
  fallbackMessage?: string | null;
  priority?: number;
  _count?: { instances: number };
}
interface PromptVersion { id: string; version: number; prompt: string; label: string | null; createdAt: string; }

const typeOptions = [
  { value: "commercial", label: "Comercial" },
  { value: "attendance", label: "Atendimento" },
  { value: "support", label: "Suporte" },
  { value: "qualification", label: "Qualificação" },
  { value: "followup", label: "Follow-up" },
  { value: "orchestrator", label: "Orquestrador" },
  { value: "manager", label: "Gerente" },
];
const typeColors: Record<string, string> = {
  commercial: "blue", attendance: "violet", support: "green",
  qualification: "yellow", followup: "pink", manager: "gray", orchestrator: "orange",
};

// ── Dynamic fields editor ─────────────────────────────────────────────────────
function DynamicFieldsEditor({ fields, onChange }: { fields: DynamicField[]; onChange: (f: DynamicField[]) => void }) {
  const [adding, setAdding] = useState(false);
  const empty: DynamicField = { key: "", label: "", type: "text", placeholder: "", description: "", required: true };
  const [draft, setDraft] = useState(empty);

  function addField() {
    if (!draft.key || !draft.label) { notifications.show({ message: "Preencha key e label", color: "red" }); return; }
    if (fields.some((f) => f.key === draft.key)) { notifications.show({ message: "Key já existe", color: "red" }); return; }
    onChange([...fields, { ...draft, key: draft.key.toLowerCase().replace(/\s+/g, "_") }]);
    setDraft(empty); setAdding(false);
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Box>
          <Text size="sm" fw={600}>Campos Dinâmicos</Text>
          <Text size="xs" c="dimmed">Use {`{{key}}`} no prompt — a empresa preenche ao ativar.</Text>
        </Box>
        <Button size="xs" variant="light" leftSection={<IconPlus size={12} />} onClick={() => setAdding(true)}>
          Adicionar campo
        </Button>
      </Group>

      {fields.map((f, i) => (
        <Paper key={f.key} p="sm" radius="md" withBorder>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="wrap">
              <Badge size="xs" variant="filled" color="violet" style={{ fontFamily: "monospace" }}>{`{{${f.key}}}`}</Badge>
              <Text size="sm" fw={500}>{f.label}</Text>
              <Badge size="xs" color="gray">{f.type}</Badge>
              {f.required && <Badge size="xs" color="red" variant="light">Obrigatório</Badge>}
            </Group>
            <ActionIcon size="sm" color="red" variant="subtle" onClick={() => onChange(fields.filter((_, idx) => idx !== i))}>
              <IconX size={12} />
            </ActionIcon>
          </Group>
          {f.description && <Text size="xs" c="dimmed" mt={4}>{f.description}</Text>}
        </Paper>
      ))}

      {adding && (
        <Paper p="md" radius="md" withBorder style={{ borderColor: "var(--mantine-color-blue-3)" }}>
          <Stack gap="sm">
            <Group grow>
              <TextInput label="Key (snake_case)" placeholder="company_name" size="xs"
                value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })} />
              <TextInput label="Label visível" placeholder="Nome da Empresa" size="xs"
                value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
              <Select label="Tipo" size="xs"
                data={[{ value: "text", label: "Texto" }, { value: "textarea", label: "Texto longo" }]}
                value={draft.type} onChange={(v) => setDraft({ ...draft, type: v ?? "text" })} />
            </Group>
            <TextInput label="Placeholder de exemplo" size="xs"
              value={draft.placeholder} onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })} />
            <TextInput label="Instrução para a empresa" size="xs"
              value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <Group>
              <Switch label="Obrigatório" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.currentTarget.checked })} />
              <Button size="xs" leftSection={<IconCheck size={12} />} onClick={addField}>Adicionar</Button>
              <Button size="xs" variant="subtle" onClick={() => { setAdding(false); setDraft(empty); }}>Cancelar</Button>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

// ── AI model selector ─────────────────────────────────────────────────────────
const USD_TO_BRL = 5.5;
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
function fmtBRL(v: number) {
  if (v < 0.01) return `R$ ${v.toFixed(4)}`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3 });
}

function ModelSelector({ value, onChange, promptLength }: { value: string | null | undefined; onChange: (v: string | null) => void; promptLength: number }) {
  const selected = AI_MODELS.find((m) => m.value === value);
  const estimatedInput = selected ? Math.ceil(promptLength / 4) + 600 : BASE_INPUT_TOKENS;
  const cost = selected ? costPerMsgBRL(selected.inputPer1M, selected.outputPer1M, estimatedInput) : null;

  return (
    <Box>
      <Select
        label="Modelo de IA"
        description="Deixe em branco para usar o modelo padrão da empresa que ativar o template"
        placeholder="Padrão da empresa"
        clearable value={value ?? null} onChange={onChange}
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
    </Box>
  );
}

// ── Template drawer editor ─────────────────────────────────────────────────────
function TemplateEditor({
  template, onClose,
}: {
  template?: AgentTemplate;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 768px)") ?? false;
  const isEdit = !!template;

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [type, setType] = useState(template?.type ?? "commercial");
  const [scope, setScope] = useState(template?.scope ?? "external");
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [autoActivate, setAutoActivate] = useState(template?.autoActivate ?? false);
  const [isPrivate, setIsPrivate] = useState(template?.isPrivate ?? false);
  const [promptText, setPromptText] = useState(template?.prompt ?? "");
  const [keywords, setKeywords] = useState<string[]>(template?.triggerKeywords ?? []);
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>((template?.dynamicFields ?? []) as DynamicField[]);
  const [aiModel, setAiModel] = useState<string | null>(template?.aiModel ?? null);
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveLabel, setShowSaveLabel] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const [temperature, setTemperature] = useState(Number(template?.temperature ?? 0.7));
  const [maxTokens, setMaxTokens] = useState<number | null>(template?.maxTokens ?? null);
  const [responseDelayMs, setResponseDelayMs] = useState(template?.responseDelayMs ?? 0);
  const [activeHoursStart, setActiveHoursStart] = useState<number | null>(template?.activeHoursStart ?? null);
  const [activeHoursEnd, setActiveHoursEnd] = useState<number | null>(template?.activeHoursEnd ?? null);
  const [offHoursMessage, setOffHoursMessage] = useState(template?.offHoursMessage ?? "");
  const [initialMessage, setInitialMessage] = useState(template?.initialMessage ?? "");
  const [handoffTriggers, setHandoffTriggers] = useState<string[]>(template?.handoffTriggers ?? []);
  const [fallbackMessage, setFallbackMessage] = useState(template?.fallbackMessage ?? "");
  const [priority, setPriority] = useState(template?.priority ?? 0);
  const [triggerInput, setTriggerInput] = useState("");

  const isDirty = isEdit
    ? (promptText !== template.prompt || JSON.stringify(keywords) !== JSON.stringify(template.triggerKeywords) || name !== template.name)
    : true;

  const vars = Array.from(new Set([...promptText.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])));

  // Version history (only for existing templates)
  const { data: versions, isLoading: versionsLoading } = useQuery<PromptVersion[]>({
    queryKey: ["prompt-versions", template?.id],
    queryFn: () => api.get(`/agents/${template!.id}/prompt-versions`).then((r) => r.data),
    enabled: !!template?.id,
  });

  const advancedPayload = {
    temperature, maxTokens, responseDelayMs,
    activeHoursStart, activeHoursEnd,
    offHoursMessage: offHoursMessage || null,
    initialMessage: initialMessage || null,
    handoffTriggers, fallbackMessage: fallbackMessage || null, priority,
  };

  const createMutation = useMutation({
    mutationFn: () => api.post("/agent-templates", { name, description, type, scope, prompt: promptText, triggerKeywords: keywords, dynamicFields, isActive, autoActivate, isPrivate, aiModel: aiModel ?? null, aiProvider: aiModel ? "openai" : null, ...advancedPayload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-templates"] });
      notifications.show({ message: "Template criado!", color: "green" });
      onClose();
    },
    onError: () => notifications.show({ message: "Erro ao criar template", color: "red" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/agents/${template!.id}/prompt-versions`, { prompt: promptText, label: saveLabel.trim() || undefined, keywords });
      await api.patch(`/agent-templates/${template!.id}`, { name, description, type, scope, isActive, autoActivate, isPrivate, dynamicFields, triggerKeywords: keywords, aiModel: aiModel ?? null, aiProvider: aiModel ? "openai" : null, ...advancedPayload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-templates"] });
      qc.invalidateQueries({ queryKey: ["prompt-versions", template!.id] });
      notifications.show({ message: "Template salvo como nova versão!", color: "green" });
      setSaveLabel(""); setShowSaveLabel(false);
    },
    onError: () => notifications.show({ message: "Erro ao salvar", color: "red" }),
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => api.post(`/agents/${template!.id}/prompt-versions/${versionId}/restore`),
    onSuccess: (_, versionId) => {
      const v = versions?.find((x) => x.id === versionId);
      if (v) setPromptText(v.prompt);
      qc.invalidateQueries({ queryKey: ["agent-templates"] });
      qc.invalidateQueries({ queryKey: ["prompt-versions", template!.id] });
      notifications.show({ message: `v${v?.version} restaurada!`, color: "blue" });
      setRestoring(null);
    },
    onError: () => { notifications.show({ message: "Erro ao restaurar", color: "red" }); setRestoring(null); },
  });

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
                      <Tooltip label="Restaurar">
                        <ActionIcon size="xs" variant="light" color="blue" loading={restoring === v.id}
                          onClick={() => { setRestoring(v.id); restoreMutation.mutate(v.id); }}>
                          <IconRestore size={11} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                  {v.label && <Group gap={4} mb={2}><IconTag size={10} color="var(--mantine-color-dimmed)" /><Text size="xs" fw={500} c="dimmed">{v.label}</Text></Group>}
                  <Text size="xs" c="dimmed">{new Date(v.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</Text>
                  <Text size="xs" c="dimmed" lineClamp={2} mt={4} style={{ fontFamily: "monospace", opacity: 0.6 }}>{v.prompt.slice(0, 80)}…</Text>
                  {!isCurrent && (
                    <Button size="xs" variant="subtle" color="blue" mt={4} fullWidth leftSection={<IconRestore size={12} />}
                      loading={restoring === v.id} onClick={() => { setRestoring(v.id); restoreMutation.mutate(v.id); }}>
                      Restaurar
                    </Button>
                  )}
                </Box>
              );
            })}
          </Stack>
        </ScrollArea>
      </Stack>
    );
  }

  function EditorContent() {
    return (
      <Stack gap="md" p="md">
        {/* Metadata */}
        <Group grow>
          <TextInput label="Nome do template" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <Select label="Tipo" required data={typeOptions} value={type} onChange={(v) => setType(v ?? "commercial")} />
        </Group>
        <Group grow>
          <TextInput label="Descrição" placeholder="Para que serve este agente..." value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
          <Select label="Escopo" data={[{ value: "external", label: "Externo (WhatsApp)" }, { value: "internal", label: "Interno" }]} value={scope} onChange={(v) => setScope(v ?? "external")} />
        </Group>
        <Switch label="Ativo (visível para as empresas ativarem)" checked={isActive} onChange={(e) => setIsActive(e.currentTarget.checked)} />
        <Switch
          label="Auto-ativar para todas as empresas"
          description="Quando marcado, este agente é criado automaticamente para cada empresa — inclusive as novas."
          checked={autoActivate}
          onChange={(e) => setAutoActivate(e.currentTarget.checked)}
          color="orange"
        />
        <Switch
          label="Agente Privado"
          description="Quando marcado, cada empresa deve definir quais números de telefone têm acesso a este agente."
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.currentTarget.checked)}
          color="indigo"
        />
        {isPrivate && (
          <Box p="sm" style={{ background: "var(--mantine-color-indigo-0)", borderRadius: 8, border: "1px solid var(--mantine-color-indigo-2)" }}>
            <Group gap="xs">
              <IconShieldLock size={14} color="var(--mantine-color-indigo-6)" />
              <Text size="xs" c="indigo.7">
                Cada empresa define os números autorizados no painel de agentes delas.
              </Text>
            </Group>
          </Box>
        )}

        <Divider label="Prompt base" labelPosition="left" />

        {/* Variable badges */}
        {vars.length > 0 && (
          <Paper p="xs" radius="md" style={{ background: "var(--mantine-color-violet-0)", border: "1px solid var(--mantine-color-violet-2)" }}>
            <Group gap={6}>
              <IconVariable size={13} color="var(--mantine-color-violet-6)" />
              <Text size="xs" fw={600} c="violet.7">Variáveis detectadas:</Text>
              {vars.map((v) => <Badge key={v} size="xs" color="violet" variant="filled" style={{ fontFamily: "monospace" }}>{`{{${v}}}`}</Badge>)}
            </Group>
          </Paper>
        )}

        <Box>
          <Group justify="space-between" mb={6}>
            <Text size="sm" fw={600}>Prompt</Text>
            <Text size="xs" c="dimmed">{promptText.length} caracteres</Text>
          </Group>
          <Textarea
            value={promptText}
            onChange={(e) => setPromptText(e.currentTarget.value)}
            minRows={14} autosize maxRows={35}
            styles={{ input: { fontFamily: "monospace", fontSize: 13, lineHeight: 1.6, background: "#0f172a", color: "#e2e8f0", border: "1px solid #1e293b", borderRadius: 8 } }}
            placeholder={`Você é um assistente da {{company_name}}, especializado em...\n\nSeu objetivo é:\n- Atender com cordialidade\n- Qualificar o interesse do lead\n\nQuando o cliente confirmar intenção de compra, inclua [TRANSBORDO].`}
          />
          <Text size="xs" c="dimmed" mt={4}>
            Use <code style={{ background: "var(--mantine-color-gray-1)", padding: "1px 4px", borderRadius: 3 }}>{"{{variavel}}"}</code> para campos preenchidos pela empresa ao ativar o template.
          </Text>
        </Box>

        <Divider label="Campos dinâmicos" labelPosition="left" />
        <DynamicFieldsEditor fields={dynamicFields} onChange={setDynamicFields} />

        <Divider label="Modelo de IA" labelPosition="left" />
        <ModelSelector value={aiModel} onChange={setAiModel} promptLength={promptText.length} />

        <Divider label="Ativação" labelPosition="left" />
        <TagsInput label="Palavras-chave de ativação" placeholder="Digite e pressione Enter"
          value={keywords} onChange={setKeywords} />

        {!isEdit && (
          <Group justify="flex-end" pt="xs">
            <Button variant="subtle" onClick={onClose}>Cancelar</Button>
            <Button leftSection={<IconCheck size={15} />} loading={createMutation.isPending} onClick={() => createMutation.mutate()} disabled={!name.trim() || !promptText.trim()}>
              Criar template
            </Button>
          </Group>
        )}
      </Stack>
    );
  }

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", flexShrink: 0 }}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm">
            <ThemeIcon size={36} radius="md" color={typeColors[type] ?? "gray"} variant="light"><IconRobot size={18} /></ThemeIcon>
            <Box>
              <Text fw={700} size="sm">{name || (isEdit ? template.name : "Novo Template")}</Text>
              <Group gap={4}>
                <Badge size="xs" color={typeColors[type] ?? "gray"} variant="light">
                  {typeOptions.find((o) => o.value === type)?.label ?? type}
                </Badge>
                {isEdit && <Badge size="xs" color="gray" variant="outline">v{template.promptVersion}</Badge>}
              </Group>
            </Box>
          </Group>
          {isEdit && isDirty && !showSaveLabel && (
            <Button size="sm" leftSection={<IconDeviceFloppy size={15} />} onClick={() => setShowSaveLabel(true)}>
              Salvar versão
            </Button>
          )}
        </Group>

        {isEdit && showSaveLabel && (
          <Box mt="sm" p="sm" style={{ background: "var(--mantine-color-blue-0)", borderRadius: 8, border: "1px solid var(--mantine-color-blue-2)" }}>
            <Text size="xs" fw={600} mb={6} c="blue">Descreva esta versão (opcional)</Text>
            <Group gap="xs" wrap="nowrap">
              <TextInput size="xs" placeholder="Ex: Novo fluxo de qualificação..." value={saveLabel}
                onChange={(e) => setSaveLabel(e.currentTarget.value)} leftSection={<IconTag size={13} />}
                style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") saveMutation.mutate(); }} autoFocus />
              <Button size="xs" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Salvar</Button>
              <Button size="xs" variant="subtle" color="gray" onClick={() => setShowSaveLabel(false)}>Cancelar</Button>
            </Group>
          </Box>
        )}
      </Box>

      {/* Body — always tabbed */}
      <Tabs defaultValue="editor" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Tabs.List px="md" style={{ flexShrink: 0 }}>
          <Tabs.Tab value="editor" leftSection={<IconEdit size={13} />}>Editor</Tabs.Tab>
          <Tabs.Tab value="advanced" leftSection={<IconSettings2 size={13} />}>
            Avançado
            {(handoffTriggers.length > 0 || activeHoursStart != null || initialMessage) && (
              <Badge size="xs" ml={4} color="orange" variant="filled" circle>!</Badge>
            )}
          </Tabs.Tab>
          {isEdit && (
            <Tabs.Tab value="history" leftSection={<IconHistory size={13} />}>
              Histórico {versions && versions.length > 0 && <Badge size="xs" ml={4} color="violet" variant="filled">{versions.length}</Badge>}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="editor" style={{ flex: 1, overflow: "auto" }}>
          {isMobile ? EditorContent() : (
            <Box style={{ display: "flex", height: "100%", overflow: "hidden" }}>
              <Box style={{ flex: 1, overflow: "auto" }}>{EditorContent()}</Box>
              {isEdit && (
                <Box style={{ width: 260, flexShrink: 0, borderLeft: "1px solid var(--mantine-color-gray-2)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {HistorySidebar()}
                </Box>
              )}
            </Box>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="advanced" style={{ flex: 1, overflow: "auto" }}>
          <Stack gap="lg" p="md">
            {/* Priority */}
            <Box>
              <Text size="sm" fw={600} mb={4}>Prioridade do Agente</Text>
              <Text size="xs" c="dimmed" mb={8}>Especialistas com maior prioridade são preferidos pelo router. 0 = padrão · 100 = máxima.</Text>
              <NumberInput value={priority} onChange={(v) => setPriority(Number(v) || 0)} min={0} max={100} step={1} leftSection={<IconArrowUp size={14} />} maw={200} />
            </Box>

            <Divider label="Geração de IA" labelPosition="left" />

            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={600}>Temperatura</Text>
                <Badge size="sm" color="blue" variant="light">{temperature.toFixed(1)}</Badge>
              </Group>
              <Text size="xs" c="dimmed" mb={8}>0 = mais preciso e repetitivo · 2 = mais criativo e variado.</Text>
              <Slider value={temperature} onChange={setTemperature} min={0} max={2} step={0.1}
                marks={[{ value: 0, label: "0" }, { value: 0.7, label: "0.7" }, { value: 1, label: "1" }, { value: 2, label: "2" }]}
                mb="md" />
            </Box>

            <Box>
              <Text size="sm" fw={600} mb={4}>Limite de tokens na resposta</Text>
              <Text size="xs" c="dimmed" mb={8}>Tamanho máximo da resposta gerada. Vazio = padrão (1024).</Text>
              <NumberInput value={maxTokens ?? ""} onChange={(v) => setMaxTokens(v === "" ? null : Number(v))}
                placeholder="1024 (padrão)" min={64} max={4096} step={64} maw={200} />
            </Box>

            <Box>
              <Text size="sm" fw={600} mb={4}>Atraso na resposta (ms)</Text>
              <Text size="xs" c="dimmed" mb={8}>Simula tempo de digitação. 0 = imediato · 3000 = 3 segundos.</Text>
              <NumberInput value={responseDelayMs} onChange={(v) => setResponseDelayMs(Number(v) || 0)}
                min={0} max={30000} step={500} leftSection={<IconClock size={14} />} maw={260} />
            </Box>

            <Divider label="Horário de atendimento" labelPosition="left" />

            <Box>
              <Text size="sm" fw={600} mb={4}>Horário ativo (UTC)</Text>
              <Text size="xs" c="dimmed" mb={8}>Fora deste horário retorna mensagem de encerramento. Vazio = 24h.</Text>
              <Group gap="sm" align="flex-start">
                <NumberInput label="Início (hora UTC)" value={activeHoursStart ?? ""} onChange={(v) => setActiveHoursStart(v === "" ? null : Number(v))} min={0} max={23} placeholder="ex: 9" maw={140} />
                <NumberInput label="Fim (hora UTC)" value={activeHoursEnd ?? ""} onChange={(v) => setActiveHoursEnd(v === "" ? null : Number(v))} min={0} max={23} placeholder="ex: 18" maw={140} />
              </Group>
            </Box>

            <Textarea label="Mensagem fora do horário" description="Enviada quando o cliente escreve fora do horário ativo."
              placeholder="Nosso atendimento funciona das 9h às 18h. Retornaremos em breve!"
              value={offHoursMessage} onChange={(e) => setOffHoursMessage(e.currentTarget.value)} minRows={2} />

            {type === "orchestrator" && (
              <>
                <Divider label="Mensagem de boas-vindas" labelPosition="left" />
                <Textarea label="Mensagem inicial" description="Enviada automaticamente no primeiro contato do cliente."
                  placeholder="Olá! Bem-vindo à {{company_name}}. Sou seu assistente virtual. Como posso ajudar?"
                  value={initialMessage} onChange={(e) => setInitialMessage(e.currentTarget.value)}
                  leftSection={<IconMessageForward size={14} />} minRows={2} />
              </>
            )}

            <Divider label="Transbordo para humano" labelPosition="left" />

            <Box>
              <Text size="sm" fw={600} mb={4}>Palavras-gatilho de transbordo</Text>
              <Text size="xs" c="dimmed" mb={8}>Se o cliente escrever qualquer uma dessas palavras, o atendimento é transferido para um humano.</Text>
              <Group gap="xs" mb={8} wrap="wrap">
                {handoffTriggers.map((t) => (
                  <Badge key={t} size="sm" variant="outline" color="red"
                    rightSection={<ActionIcon size={12} variant="transparent" color="red" onClick={() => setHandoffTriggers(handoffTriggers.filter((x) => x !== t))}>×</ActionIcon>}>
                    {t}
                  </Badge>
                ))}
                {handoffTriggers.length === 0 && <Text size="xs" c="dimmed">Nenhuma</Text>}
              </Group>
              <Group gap="xs" wrap="nowrap">
                <TextInput size="xs" placeholder="ex: falar com humano, atendente..."
                  value={triggerInput} onChange={(e) => setTriggerInput(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = triggerInput.trim().toLowerCase();
                      if (t && !handoffTriggers.includes(t)) setHandoffTriggers([...handoffTriggers, t]);
                      setTriggerInput("");
                    }
                  }}
                  style={{ flex: 1 }} />
                <Button size="xs" variant="light" color="red" onClick={() => {
                  const t = triggerInput.trim().toLowerCase();
                  if (t && !handoffTriggers.includes(t)) setHandoffTriggers([...handoffTriggers, t]);
                  setTriggerInput("");
                }} disabled={!triggerInput.trim()}>
                  <IconPlus size={13} />
                </Button>
              </Group>
            </Box>

            <Textarea label="Mensagem de transbordo" description="Enviada quando o atendimento é transferido para humano."
              placeholder="Vou te conectar com um de nossos atendentes. Aguarde um momento!"
              value={fallbackMessage} onChange={(e) => setFallbackMessage(e.currentTarget.value)}
              leftSection={<IconAlertTriangle size={14} />} minRows={2} />
          </Stack>
        </Tabs.Panel>

        {isEdit && (
          <Tabs.Panel value="history" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {HistorySidebar()}
          </Tabs.Panel>
        )}
      </Tabs>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GlobalAgentsPage() {
  const [editing, setEditing] = useState<AgentTemplate | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AgentTemplate | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)") ?? false;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: AgentTemplate[] }>({
    queryKey: ["agent-templates"],
    queryFn: () => api.get("/agent-templates").then((r) => r.data),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agent-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-templates"] }); notifications.show({ message: "Template desativado", color: "orange" }); },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agent-templates/${id}/hard`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-templates"] });
      notifications.show({ message: "Template excluído permanentemente", color: "red", icon: <IconTrash size={16} /> });
      setConfirmDelete(null);
    },
    onError: () => notifications.show({ message: "Erro ao excluir template", color: "red" }),
  });

  function openNew() { setEditing(undefined); setDrawerOpen(true); }
  function openEdit(t: AgentTemplate) { setEditing(t); setDrawerOpen(true); }

  const templates = data?.data ?? [];

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Agentes Globais</Title>
          <Text c="dimmed" size="sm" mt={4}>Templates disponíveis para todas as empresas ativarem</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} onClick={openNew}>Novo Template</Button>
      </Group>

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="right"
        size={isMobile ? "100%" : "75%"}
        padding={0}
        withCloseButton
        title={<Text fw={600} size="sm">{editing ? `Editar Template — ${editing.name}` : "Novo Template de Agente"}</Text>}
        styles={{
          header: { padding: "12px 16px", borderBottom: "1px solid var(--mantine-color-gray-2)" },
          body: { padding: 0, height: "calc(100% - 53px)", overflow: "auto" },
        }}
      >
        <TemplateEditor template={editing} onClose={() => setDrawerOpen(false)} />
      </Drawer>

      {isLoading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={220} radius="lg" />)}
        </SimpleGrid>
      ) : templates.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconRobot size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhum template criado</Text>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openNew}>Criar primeiro template</Button>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {templates.map((t) => (
            <Card key={t.id} padding="lg" radius="lg" withBorder shadow="sm" style={{ display: "flex", flexDirection: "column" }}>
              <Group justify="space-between" mb="md">
                <ThemeIcon size={40} radius="md" color={typeColors[t.type] ?? "gray"} variant="light"><IconRobot size={20} /></ThemeIcon>
                <Group gap={6}>
                  {t.autoActivate && <Badge color="orange" variant="light" size="sm">Auto-ativa</Badge>}
                  {t.isPrivate && <Badge color="indigo" variant="light" size="sm">Privado</Badge>}
                  <Badge color={t.isActive ? "green" : "gray"} variant="light" size="sm">{t.isActive ? "Ativo" : "Inativo"}</Badge>
                  <Menu withinPortal position="bottom-end" shadow="sm">
                    <Menu.Target><ActionIcon variant="subtle" color="gray" size="sm"><IconDots size={14} /></ActionIcon></Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEdit(t)}>Editar</Menu.Item>
                      <Menu.Item leftSection={<IconPower size={14} />} color="orange" onClick={() => deactivateMutation.mutate(t.id)}>
                        {t.isActive ? "Desativar" : "Ativar"}
                      </Menu.Item>
                      <Divider />
                      <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => setConfirmDelete(t)}>
                        Excluir permanentemente
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>

              <Text fw={600} size="sm" mb={4}>{t.name}</Text>
              {t.description && <Text size="xs" c="dimmed" mb="sm" lineClamp={2}>{t.description}</Text>}

              <Group gap="xs" mb="sm">
                <Badge color={typeColors[t.type] ?? "gray"} variant="light" size="xs">
                  {typeOptions.find((o) => o.value === t.type)?.label ?? t.type}
                </Badge>
                <Badge color="gray" variant="outline" size="xs">{t.scope === "external" ? "WhatsApp" : "Interno"}</Badge>
                {t.promptVersion > 1 && <Badge color="gray" variant="light" size="xs" leftSection={<IconHistory size={9} />}>v{t.promptVersion}</Badge>}
              </Group>

              {t.dynamicFields.length > 0 && (
                <Box mb="sm">
                  <Group gap={4} wrap="wrap">
                    {t.dynamicFields.map((f) => (
                      <Tooltip key={f.key} label={f.label} withArrow>
                        <Badge size="xs" variant="dot" color="violet" style={{ fontFamily: "monospace" }}>{`{{${f.key}}}`}</Badge>
                      </Tooltip>
                    ))}
                  </Group>
                </Box>
              )}

              {t.triggerKeywords.length > 0 && (
                <Group gap={4} mb="sm">
                  {t.triggerKeywords.slice(0, 3).map((kw) => (
                    <Badge key={kw} size="xs" variant="outline" color="gray" leftSection={<IconBolt size={8} />}>{kw}</Badge>
                  ))}
                  {t.triggerKeywords.length > 3 && <Text size="xs" c="dimmed">+{t.triggerKeywords.length - 3}</Text>}
                </Group>
              )}

              {t._count && <Text size="xs" c="dimmed" mb="sm">{t._count.instances} empresa{t._count.instances !== 1 ? "s" : ""} usando</Text>}

              <Button variant="light" size="xs" mt="auto" leftSection={<IconEdit size={13} />} rightSection={<IconChevronRight size={13} />} onClick={() => openEdit(t)}>
                Editar Template
              </Button>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* ── Modal: Confirmar exclusão permanente ──────────────────── */}
      <Modal
        opened={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={
          <Group gap="xs">
            <IconTrash size={18} color="var(--mantine-color-red-6)" />
            <Text fw={600} c="red">Excluir Template</Text>
          </Group>
        }
        size="sm"
        radius="lg"
      >
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" radius="md">
            Esta ação é <strong>irreversível</strong>. O template{" "}
            <strong>"{confirmDelete?.name}"</strong> e todas as suas instâncias nas empresas serão
            permanentemente excluídos.
          </Alert>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)} leftSection={<IconX size={14} />}>
              Cancelar
            </Button>
            <Button
              color="red"
              loading={hardDeleteMutation.isPending}
              leftSection={<IconTrash size={14} />}
              onClick={() => confirmDelete && hardDeleteMutation.mutate(confirmDelete.id)}
            >
              Excluir definitivamente
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

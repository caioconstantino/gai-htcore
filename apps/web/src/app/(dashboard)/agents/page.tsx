"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, SimpleGrid, Skeleton,
  ThemeIcon, Modal, TextInput, Textarea, ActionIcon, Menu, Select,
  Tabs, Divider, Drawer, ScrollArea, Paper, Tooltip, Alert,
  Loader, Center, Collapse, Checkbox, Slider, NumberInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconRobot, IconPlus, IconBolt, IconWorld, IconLock, IconDots,
  IconTrash, IconBoltOff, IconCheck, IconVariable, IconEdit,
  IconHistory, IconRestore, IconDeviceFloppy, IconTag,
  IconChevronRight, IconEye, IconEyeOff, IconInfoCircle,
  IconShieldLock, IconCrown, IconX, IconUserScan,
  IconSettings2, IconArrowUp, IconArrowDown, IconNetwork,
  IconClock, IconAlertTriangle, IconMessageForward,
} from "@tabler/icons-react";

interface DynamicField { key: string; label: string; type: string; placeholder?: string; description?: string; required: boolean; }
interface AgentTemplate { id: string; name: string; description: string | null; type: string; scope: string; triggerKeywords: string[]; dynamicFields: DynamicField[]; }
interface PhonePermission { id: string; phone: string; label: string | null; }
interface CustomCollectField { key: string; label: string; description: string; }
interface CollectFieldsConfig { standard: string[]; custom: CustomCollectField[]; }
interface Agent {
  id: string; name: string; description: string | null; type: string; scope: string;
  isActive: boolean; isPrivate: boolean; triggerKeywords: string[]; prompt: string; promptVersion: number;
  templateId: string | null; dynamicFields: DynamicField[];
  aiProvider?: string | null; aiModel?: string | null;
  collectFields?: CollectFieldsConfig | null;
  company?: { id: string; name: string; slug: string } | null;
  phonePermissions?: PhonePermission[];
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
}

const STANDARD_COLLECT_FIELDS = [
  { key: "name",         label: "Nome do cliente" },
  { key: "companyName",  label: "Empresa" },
  { key: "document",     label: "CNPJ / CPF" },
  { key: "city",         label: "Cidade" },
  { key: "state",        label: "Estado" },
  { key: "address",      label: "Endereço" },
  { key: "neighborhood", label: "Bairro" },
] as const;

function CollectFieldsEditor({ value, onChange }: {
  value: CollectFieldsConfig;
  onChange: (v: CollectFieldsConfig) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");

  function toggleStandard(key: string) {
    const next = value.standard.includes(key)
      ? value.standard.filter((k) => k !== key)
      : [...value.standard, key];
    onChange({ ...value, standard: next });
  }

  function addCustom() {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || !newLabel.trim()) return;
    if (value.custom.some((f) => f.key === key)) return;
    onChange({ ...value, custom: [...value.custom, { key, label: newLabel.trim(), description: newDesc.trim() }] });
    setNewKey(""); setNewLabel(""); setNewDesc("");
  }

  function removeCustom(key: string) {
    onChange({ ...value, custom: value.custom.filter((f) => f.key !== key) });
  }

  return (
    <Stack gap="md">
      <Box>
        <Text size="sm" fw={600} mb="xs">Campos padrão</Text>
        <SimpleGrid cols={2} spacing="xs">
          {STANDARD_COLLECT_FIELDS.map((f) => (
            <Checkbox
              key={f.key}
              label={f.label}
              checked={value.standard.includes(f.key)}
              onChange={() => toggleStandard(f.key)}
              size="sm"
            />
          ))}
        </SimpleGrid>
      </Box>

      <Divider label="Campos personalizados" labelPosition="left" />

      <Stack gap="xs">
        {value.custom.map((f) => (
          <Group key={f.key} gap="xs" wrap="nowrap" p="xs"
            style={{ background: "var(--mantine-color-gray-0)", borderRadius: 6, border: "1px solid var(--mantine-color-gray-2)" }}>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={500}>{f.label}</Text>
              <Text size="xs" c="dimmed">chave: {f.key}{f.description ? ` — ${f.description}` : ""}</Text>
            </Box>
            <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeCustom(f.key)}>
              <IconX size={12} />
            </ActionIcon>
          </Group>
        ))}
        {value.custom.length === 0 && (
          <Text size="xs" c="dimmed">Nenhum campo personalizado. Adicione abaixo.</Text>
        )}
      </Stack>

      <Paper p="sm" radius="md" withBorder>
        <Text size="xs" fw={600} mb="xs" c="dimmed">ADICIONAR CAMPO PERSONALIZADO</Text>
        <Stack gap="xs">
          <Group gap="xs" wrap="nowrap">
            <TextInput size="xs" placeholder="chave (ex: tipo_frota)" value={newKey} onChange={(e) => setNewKey(e.currentTarget.value)} style={{ flex: 1 }} />
            <TextInput size="xs" placeholder="Rótulo (ex: Tipo de frota)" value={newLabel} onChange={(e) => setNewLabel(e.currentTarget.value)} style={{ flex: 2 }} />
          </Group>
          <Group gap="xs" wrap="nowrap">
            <TextInput size="xs" placeholder="Descrição para o agente (ex: Carro, van, caminhão...)" value={newDesc} onChange={(e) => setNewDesc(e.currentTarget.value)} style={{ flex: 1 }} />
            <Button size="xs" variant="light" onClick={addCustom} disabled={!newKey.trim() || !newLabel.trim()} leftSection={<IconPlus size={12} />}>
              Adicionar
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}

interface PromptVersion { id: string; version: number; prompt: string; label: string | null; createdAt: string; }
interface DynamicValuesData { fields: DynamicField[]; values: Record<string, string>; autoFill: Record<string, string>; templateId: string | null; }

const typeColors: Record<string, string> = { commercial: "blue", attendance: "violet", support: "green", qualification: "yellow", followup: "pink", manager: "gray", orchestrator: "orange", quoter: "teal" };
const typeLabels: Record<string, string> = { commercial: "Comercial", attendance: "Atendimento", support: "Suporte", qualification: "Qualificação", followup: "Follow-up", manager: "Gerente", orchestrator: "Orquestrador", quoter: "Orçamentista" };

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
  const [phones, setPhones] = useState<PhoneEntry[]>(
    agent.phonePermissions?.map((p) => ({ phone: p.phone, label: p.label ?? "" })) ?? []
  );
  const [collectFields, setCollectFields] = useState<CollectFieldsConfig>(
    agent.collectFields ?? { standard: ["name", "city", "document"], custom: [] }
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
      if (agent.isPrivate && phones.length === 0) throw new Error("Adicione pelo menos 1 número autorizado para salvar.");
      const fields = (data?.fields ?? []) as DynamicField[];
      if (fields.length > 0) await api.patch(`/agents/${agent.id}/dynamic-values`, { values });
      if (agent.isPrivate) await api.put(`/agents/${agent.id}/phone-permissions`, { phones });
      if (agent.type === "attendance") await api.patch(`/agents/${agent.id}`, { collectFields });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["prompt-versions", agent.id] });
      qc.invalidateQueries({ queryKey: ["dynamic-values", agent.id] });
      notifications.show({ message: "Configurações salvas com sucesso!", color: "green", icon: <IconCheck size={16} /> });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      notifications.show({ message: msg, color: "red" });
    },
  });

  const previewPrompt = Object.entries(values).reduce(
    (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val || `{{${key}}}`),
    agent.prompt ?? ""
  );

  const fields = (data?.fields ?? []) as DynamicField[];
  const autoFill = data?.autoFill ?? {};

  if (isLoading) return <Center py="xl"><Loader size="sm" /></Center>;

  return (
    <Stack gap="md" p="md">
      {agent.type === "attendance" && (
        <>
          <Box p="sm" style={{ background: "var(--mantine-color-violet-0)", borderRadius: 8, border: "1px solid var(--mantine-color-violet-2)" }}>
            <Group gap="xs" mb="sm">
              <IconUserScan size={15} color="var(--mantine-color-violet-6)" />
              <Text size="sm" fw={600} c="violet.7">Dados a coletar do cliente</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="md">
              Selecione quais dados o agente deve coletar. Campos personalizados são armazenados no contexto do lead.
            </Text>
            <CollectFieldsEditor value={collectFields} onChange={setCollectFields} />
          </Box>
          <Divider />
        </>
      )}
      {fields.length === 0 && agent.type !== "attendance" ? (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" radius="md">
          Este agente não possui campos configuráveis. O prompt é gerenciado pelo administrador da plataforma.
        </Alert>
      ) : fields.length > 0 ? (
        <>
          <Alert icon={<IconShieldLock size={16} />} color="blue" variant="light" radius="md">
            <Text size="sm">Você pode personalizar os dados da sua empresa usados pelo agente. O texto base do prompt é gerenciado pelo administrador da plataforma.</Text>
          </Alert>

          {fields.map((field) => {
            const isAutoFilled = autoFill[field.key] && autoFill[field.key] === values[field.key];
            const label = (
              <Group gap={6}>
                {field.label}
                {field.required && <Text span c="red" size="xs">*</Text>}
                {isAutoFilled && (
                  <Badge size="xs" color="teal" variant="light" leftSection={<IconCheck size={9} />}>
                    preenchido automaticamente
                  </Badge>
                )}
              </Group>
            );
            return (
              <Box key={field.key}>
                {field.type === "textarea" ? (
                  <Textarea
                    label={label}
                    description={field.description}
                    placeholder={field.placeholder ?? `Valor para {{${field.key}}}`}
                    value={values[field.key] ?? ""}
                    onChange={(e) => { const v = e.currentTarget.value; setValues((prev) => ({ ...prev, [field.key]: v })); }}
                    minRows={3}
                  />
                ) : (
                  <TextInput
                    label={label}
                    description={field.description}
                    placeholder={field.placeholder ?? `Valor para {{${field.key}}}`}
                    value={values[field.key] ?? ""}
                    onChange={(e) => { const v = e.currentTarget.value; setValues((prev) => ({ ...prev, [field.key]: v })); }}
                  />
                )}
              </Box>
            );
          })}

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
      ) : null}

      {agent.isPrivate && (
        <>
          <Divider label="Acesso Restrito" labelPosition="left" />
          <Box p="sm" style={{ background: "var(--mantine-color-indigo-0)", borderRadius: 8, border: "1px solid var(--mantine-color-indigo-2)" }}>
            <Group gap="xs" mb="sm">
              <IconShieldLock size={14} color="var(--mantine-color-indigo-6)" />
              <Text size="sm" fw={600} c="indigo.7">Agente Privado</Text>
              <Text size="xs" c="dimmed">— defina quais números têm acesso</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Este agente só atende os números cadastrados abaixo. Adicione os WhatsApps da sua equipe.
            </Text>
            <PhonePermissionsManager phones={phones} setPhones={setPhones} />
            {phones.length === 0 && (
              <Text size="xs" c="red" mt={6}>Adicione pelo menos 1 número autorizado.</Text>
            )}
          </Box>
        </>
      )}

      <Group justify="flex-end" pt="xs">
        <Button variant="subtle" onClick={onClose}>Cancelar</Button>
        <Button leftSection={<IconDeviceFloppy size={15} />} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          Salvar configurações
        </Button>
      </Group>
    </Stack>
  );
}

// ── AI Model selector ─────────────────────────────────────────────────────────
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

// ── Advanced config panel (super_admin only) ──────────────────────────────────
interface AdvancedState {
  temperature: number;
  maxTokens: number | null;
  responseDelayMs: number;
  activeHoursStart: number | null;
  activeHoursEnd: number | null;
  offHoursMessage: string;
  initialMessage: string;
  handoffTriggers: string[];
  fallbackMessage: string;
  priority: number;
}

function AdvancedConfigPanel({ state, onChange, agentType }: {
  state: AdvancedState;
  onChange: (s: AdvancedState) => void;
  agentType: string;
}) {
  const [triggerInput, setTriggerInput] = useState("");

  function set<K extends keyof AdvancedState>(key: K, val: AdvancedState[K]) {
    onChange({ ...state, [key]: val });
  }

  function addTrigger() {
    const t = triggerInput.trim().toLowerCase();
    if (t && !state.handoffTriggers.includes(t)) {
      set("handoffTriggers", [...state.handoffTriggers, t]);
    }
    setTriggerInput("");
  }

  return (
    <Stack gap="lg" p="md">
      {/* Priority */}
      <Box>
        <Text size="sm" fw={600} mb={4}>Prioridade do Agente</Text>
        <Text size="xs" c="dimmed" mb={8}>
          Agentes com maior prioridade são preferidos pelo router quando múltiplos especialistas correspondem à mensagem.
        </Text>
        <NumberInput
          value={state.priority}
          onChange={(v) => set("priority", Number(v) || 0)}
          min={0} max={100} step={1}
          leftSection={<IconArrowUp size={14} />}
          description="0 = padrão · 100 = máxima prioridade"
          maw={200}
        />
      </Box>

      <Divider label="Geração de IA" labelPosition="left" />

      {/* Temperature */}
      <Box>
        <Group justify="space-between" mb={4}>
          <Text size="sm" fw={600}>Temperatura</Text>
          <Badge size="sm" color="blue" variant="light">{state.temperature.toFixed(1)}</Badge>
        </Group>
        <Text size="xs" c="dimmed" mb={8}>
          Controla a criatividade das respostas. 0 = mais preciso e repetitivo · 2 = mais criativo e variado.
        </Text>
        <Slider
          value={state.temperature}
          onChange={(v) => set("temperature", v)}
          min={0} max={2} step={0.1}
          marks={[
            { value: 0, label: "0" },
            { value: 0.7, label: "0.7" },
            { value: 1, label: "1" },
            { value: 2, label: "2" },
          ]}
          mb="md"
        />
      </Box>

      {/* Max tokens */}
      <Box>
        <Text size="sm" fw={600} mb={4}>Limite de tokens na resposta</Text>
        <Text size="xs" c="dimmed" mb={8}>
          Tamanho máximo da resposta gerada. Deixe vazio para usar o padrão (1024).
        </Text>
        <NumberInput
          value={state.maxTokens ?? ""}
          onChange={(v) => set("maxTokens", v === "" ? null : Number(v))}
          placeholder="1024 (padrão)"
          min={64} max={4096} step={64}
          maw={200}
        />
      </Box>

      {/* Response delay */}
      <Box>
        <Text size="sm" fw={600} mb={4}>Atraso na resposta (ms)</Text>
        <Text size="xs" c="dimmed" mb={8}>
          Simula tempo de digitação antes de enviar a resposta. Útil para dar sensação de atendimento humano.
        </Text>
        <NumberInput
          value={state.responseDelayMs}
          onChange={(v) => set("responseDelayMs", Number(v) || 0)}
          min={0} max={30000} step={500}
          leftSection={<IconClock size={14} />}
          description="0 ms = resposta imediata · 3000 ms = 3 segundos"
          maw={260}
        />
      </Box>

      <Divider label="Horário de atendimento" labelPosition="left" />

      <Box>
        <Text size="sm" fw={600} mb={4}>Horário ativo (UTC)</Text>
        <Text size="xs" c="dimmed" mb={8}>
          Fora deste horário o agente retorna a mensagem de horário encerrado. Deixe vazio para atender 24h.
        </Text>
        <Group gap="sm" align="flex-start">
          <NumberInput
            label="Início (hora UTC)"
            value={state.activeHoursStart ?? ""}
            onChange={(v) => set("activeHoursStart", v === "" ? null : Number(v))}
            min={0} max={23} placeholder="ex: 9"
            maw={140}
          />
          <NumberInput
            label="Fim (hora UTC)"
            value={state.activeHoursEnd ?? ""}
            onChange={(v) => set("activeHoursEnd", v === "" ? null : Number(v))}
            min={0} max={23} placeholder="ex: 18"
            maw={140}
          />
        </Group>
        {(state.activeHoursStart != null || state.activeHoursEnd != null) && (
          <Alert mt="sm" icon={<IconInfoCircle size={14} />} color="blue" variant="light" radius="md">
            Atende das {state.activeHoursStart ?? "?"}h às {state.activeHoursEnd ?? "?"}h UTC (ajuste para o fuso horário do servidor).
          </Alert>
        )}
      </Box>

      <Textarea
        label="Mensagem fora do horário"
        description="Enviada automaticamente quando o cliente escreve fora do horário ativo."
        placeholder="Olá! Nosso atendimento funciona das 9h às 18h (horário de Brasília). Retornaremos em breve!"
        value={state.offHoursMessage}
        onChange={(e) => set("offHoursMessage", e.currentTarget.value)}
        minRows={2}
      />

      {agentType === "orchestrator" && (
        <>
          <Divider label="Mensagem de boas-vindas" labelPosition="left" />
          <Textarea
            label="Mensagem inicial"
            description="Enviada automaticamente no primeiro contato do cliente (antes da resposta gerada pela IA)."
            placeholder="Olá! Bem-vindo à [Empresa]. Sou seu assistente virtual. Como posso ajudar?"
            value={state.initialMessage}
            onChange={(e) => set("initialMessage", e.currentTarget.value)}
            leftSection={<IconMessageForward size={14} />}
            minRows={2}
          />
        </>
      )}

      <Divider label="Transbordo para humano" labelPosition="left" />

      {/* Handoff triggers */}
      <Box>
        <Text size="sm" fw={600} mb={4}>Palavras-gatilho de transbordo</Text>
        <Text size="xs" c="dimmed" mb={8}>
          Se o cliente escrever qualquer uma dessas palavras, o atendimento é transferido automaticamente para um humano.
        </Text>
        <Group gap="xs" mb={8} wrap="wrap">
          {state.handoffTriggers.map((t) => (
            <Badge key={t} size="sm" variant="outline" color="red"
              rightSection={<ActionIcon size={12} variant="transparent" color="red" onClick={() => set("handoffTriggers", state.handoffTriggers.filter((x) => x !== t))}>×</ActionIcon>}>
              {t}
            </Badge>
          ))}
          {state.handoffTriggers.length === 0 && <Text size="xs" c="dimmed">Nenhuma</Text>}
        </Group>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            size="xs" placeholder="ex: falar com humano, atendente..."
            value={triggerInput} onChange={(e) => setTriggerInput(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTrigger(); } }}
            style={{ flex: 1 }}
          />
          <Button size="xs" variant="light" color="red" onClick={addTrigger} disabled={!triggerInput.trim()}>
            <IconPlus size={13} />
          </Button>
        </Group>
      </Box>

      <Textarea
        label="Mensagem de transbordo"
        description="Enviada quando o atendimento é transferido para um humano (substitui a resposta da IA)."
        placeholder="Vou te conectar com um de nossos atendentes. Aguarde um momento!"
        value={state.fallbackMessage}
        onChange={(e) => set("fallbackMessage", e.currentTarget.value)}
        leftSection={<IconAlertTriangle size={14} />}
        minRows={2}
      />
    </Stack>
  );
}

// ── Flow diagram ──────────────────────────────────────────────────────────────
function FlowDiagram({ agents }: { agents: Agent[] }) {
  const orch = agents.find((a) => a.type === "orchestrator" && a.isActive);
  const specialists = agents
    .filter((a) => a.type !== "orchestrator" && a.scope === "external" && a.isActive)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const BOX_W = 148, BOX_H = 58, GAP_X = 28, GAP_Y = 56;
  const NODE_R = 8;
  const specialistCount = Math.max(specialists.length, 1);
  const rowWidth = specialistCount * BOX_W + (specialistCount - 1) * GAP_X;
  const svgW = Math.max(rowWidth + 80, 560);
  const centerX = svgW / 2;

  const phases = [
    { label: "Cliente", sub: "WhatsApp", color: "#10b981", x: centerX - BOX_W / 2, y: 20 },
    { label: orch?.name ?? "Sem orquestrador", sub: "Orquestrador", color: "#f97316", x: centerX - BOX_W / 2, y: 20 + BOX_H + GAP_Y },
    { label: "Router IA", sub: "Seleção inteligente", color: "#3b82f6", x: centerX - BOX_W / 2, y: 20 + (BOX_H + GAP_Y) * 2 },
  ];

  const specialistY = 20 + (BOX_H + GAP_Y) * 3;
  const specialistBoxes = specialists.map((s, i) => {
    const totalW = specialists.length * BOX_W + (specialists.length - 1) * GAP_X;
    const startX = centerX - totalW / 2;
    return { ...s, x: startX + i * (BOX_W + GAP_X), y: specialistY };
  });

  const synthY = specialistY + BOX_H + GAP_Y;
  const responseY = synthY + (specialists.length > 1 ? BOX_H + GAP_Y : 0);
  const showSynth = specialists.length > 1;
  const svgH = responseY + BOX_H + 30;

  function NodeBox({ x, y, label, sub, color }: { x: number; y: number; label: string; sub: string; color: string }) {
    return (
      <g>
        <rect x={x} y={y} width={BOX_W} height={BOX_H} rx={NODE_R} fill={color + "18"} stroke={color} strokeWidth={1.5} />
        <text x={x + BOX_W / 2} y={y + 20} textAnchor="middle" fill={color} fontSize={12} fontWeight="600" fontFamily="inherit">
          {label.length > 18 ? label.slice(0, 17) + "…" : label}
        </text>
        <text x={x + BOX_W / 2} y={y + 37} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="inherit">{sub}</text>
      </g>
    );
  }

  function Arrow({ x1, y1, x2, y2, color = "#94a3b8" }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
    const midY = (y1 + y2) / 2;
    const d = x1 === x2
      ? `M ${x1} ${y1} L ${x2} ${y2}`
      : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    return (
      <>
        <defs>
          <marker id={`arrow-${x1}-${y1}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={color} />
          </marker>
        </defs>
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4,3"
          markerEnd={`url(#arrow-${x1}-${y1})`} />
      </>
    );
  }

  return (
    <Box style={{ overflowX: "auto", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16 }}>
      <svg width={svgW} height={svgH} style={{ display: "block", margin: "0 auto" }}>
        {/* Phase 0 → 1 → 2 */}
        {phases.map((p, i) => (
          <NodeBox key={i} x={p.x} y={p.y} label={p.label} sub={p.sub} color={p.color} />
        ))}
        {phases.slice(0, -1).map((p, i) => (
          <Arrow key={i} x1={p.x + BOX_W / 2} y1={p.y + BOX_H} x2={phases[i + 1].x + BOX_W / 2} y2={phases[i + 1].y} />
        ))}

        {/* Router → specialists */}
        {specialists.length === 0 ? (
          <NodeBox x={centerX - BOX_W / 2} y={specialistY} label="Nenhum especialista" sub="ativo" color="#94a3b8" />
        ) : specialistBoxes.map((s) => (
          <g key={s.id}>
            <Arrow
              x1={centerX}
              y1={phases[2].y + BOX_H}
              x2={s.x + BOX_W / 2}
              y2={s.y}
              color={typeColors[s.type] ? "#" + ({ blue: "3b82f6", green: "10b981", violet: "8b5cf6", yellow: "eab308", pink: "ec4899", teal: "14b8a6", orange: "f97316", gray: "64748b" }[typeColors[s.type]] ?? "3b82f6") : "#3b82f6"}
            />
            <NodeBox x={s.x} y={s.y} label={s.name} sub={typeLabels[s.type] ?? s.type} color={typeColors[s.type] ? "#3b82f6" : "#64748b"} />
            {s.priority != null && s.priority > 0 && (
              <text x={s.x + BOX_W - 6} y={s.y + 14} textAnchor="end" fill="#f97316" fontSize={9} fontWeight="700">P{s.priority}</text>
            )}
          </g>
        ))}

        {/* Synthesizer (only if >1 specialist) */}
        {showSynth && (
          <>
            {specialistBoxes.map((s) => (
              <Arrow key={s.id} x1={s.x + BOX_W / 2} y1={s.y + BOX_H} x2={centerX} y2={synthY} />
            ))}
            <NodeBox x={centerX - BOX_W / 2} y={synthY} label="Sintetizador" sub="Orquestrador" color="#8b5cf6" />
          </>
        )}

        {/* → Response */}
        <Arrow
          x1={centerX}
          y1={(showSynth ? synthY : specialistY) + BOX_H}
          x2={centerX}
          y2={responseY}
        />
        <NodeBox x={centerX - BOX_W / 2} y={responseY} label="Resposta" sub="WhatsApp" color="#10b981" />
      </svg>

      {specialists.length > 0 && (
        <Group gap="xs" mt="md" wrap="wrap" justify="center">
          {specialists.map((s) => (
            <Badge key={s.id} size="xs" color={typeColors[s.type] ?? "gray"} variant="light"
              leftSection={s.priority ? <span style={{ fontWeight: 700 }}>P{s.priority}</span> : undefined}>
              {s.name}
            </Badge>
          ))}
        </Group>
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
  const [kwInput, setKwInput] = useState("");
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveLabel, setShowSaveLabel] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const [advanced, setAdvanced] = useState<AdvancedState>({
    temperature: Number(agent.temperature ?? 0.7),
    maxTokens: agent.maxTokens ?? null,
    responseDelayMs: agent.responseDelayMs ?? 0,
    activeHoursStart: agent.activeHoursStart ?? null,
    activeHoursEnd: agent.activeHoursEnd ?? null,
    offHoursMessage: agent.offHoursMessage ?? "",
    initialMessage: agent.initialMessage ?? "",
    handoffTriggers: agent.handoffTriggers ?? [],
    fallbackMessage: agent.fallbackMessage ?? "",
    priority: agent.priority ?? 0,
  });

  const isDirty = promptText !== agent.prompt
    || JSON.stringify(keywords) !== JSON.stringify(agent.triggerKeywords)
    || aiModel !== (agent.aiModel ?? null)
    || advanced.temperature !== Number(agent.temperature ?? 0.7)
    || advanced.maxTokens !== (agent.maxTokens ?? null)
    || advanced.responseDelayMs !== (agent.responseDelayMs ?? 0)
    || advanced.activeHoursStart !== (agent.activeHoursStart ?? null)
    || advanced.activeHoursEnd !== (agent.activeHoursEnd ?? null)
    || advanced.offHoursMessage !== (agent.offHoursMessage ?? "")
    || advanced.initialMessage !== (agent.initialMessage ?? "")
    || JSON.stringify(advanced.handoffTriggers) !== JSON.stringify(agent.handoffTriggers ?? [])
    || advanced.fallbackMessage !== (agent.fallbackMessage ?? "")
    || advanced.priority !== (agent.priority ?? 0);

  const { data: versions, isLoading: versionsLoading } = useQuery<PromptVersion[]>({
    queryKey: ["prompt-versions", agent.id],
    queryFn: () => api.get(`/agents/${agent.id}/prompt-versions`).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/agents/${agent.id}/prompt-versions`, { prompt: promptText, label: saveLabel.trim() || undefined, keywords });
      await api.patch(`/agents/${agent.id}`, {
        aiModel: aiModel ?? null,
        aiProvider: aiModel ? "openai" : null,
        temperature: advanced.temperature,
        maxTokens: advanced.maxTokens,
        responseDelayMs: advanced.responseDelayMs,
        activeHoursStart: advanced.activeHoursStart,
        activeHoursEnd: advanced.activeHoursEnd,
        offHoursMessage: advanced.offHoursMessage || null,
        initialMessage: advanced.initialMessage || null,
        handoffTriggers: advanced.handoffTriggers,
        fallbackMessage: advanced.fallbackMessage || null,
        priority: advanced.priority,
      });
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
                {(agent.priority ?? 0) > 0 && <Badge size="xs" color="orange" variant="light">P{agent.priority}</Badge>}
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

      {/* Body — always tabbed */}
      <Tabs defaultValue="editor" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Tabs.List px="md" style={{ flexShrink: 0 }}>
          <Tabs.Tab value="editor" leftSection={<IconEdit size={13} />}>Editor</Tabs.Tab>
          <Tabs.Tab value="advanced" leftSection={<IconSettings2 size={13} />}>
            Avançado
            {(advanced.handoffTriggers.length > 0 || advanced.activeHoursStart != null || advanced.initialMessage) && (
              <Badge size="xs" ml={4} color="orange" variant="filled" circle>!</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={13} />}>
            Histórico {versions && versions.length > 0 && <Badge size="xs" ml={4} color="violet" variant="filled">{versions.length}</Badge>}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="editor" style={{ flex: 1, overflow: "auto" }}>
          {isMobile ? (
            <EditorPanel promptText={promptText} setPromptText={setPromptText} keywords={keywords} setKeywords={setKeywords} kwInput={kwInput} setKwInput={setKwInput} addKeyword={addKeyword} vars={vars} aiModel={aiModel} setAiModel={setAiModel} />
          ) : (
            <Box style={{ display: "flex", height: "100%", overflow: "hidden" }}>
              <Box style={{ flex: 1, overflow: "auto" }}>
                <EditorPanel promptText={promptText} setPromptText={setPromptText} keywords={keywords} setKeywords={setKeywords} kwInput={kwInput} setKwInput={setKwInput} addKeyword={addKeyword} vars={vars} aiModel={aiModel} setAiModel={setAiModel} />
              </Box>
              <Box style={{ width: 260, flexShrink: 0, borderLeft: "1px solid var(--mantine-color-gray-2)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <HistorySidebar />
              </Box>
            </Box>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="advanced" style={{ flex: 1, overflow: "auto" }}>
          <AdvancedConfigPanel state={advanced} onChange={setAdvanced} agentType={agent.type} />
        </Tabs.Panel>

        <Tabs.Panel value="history" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <HistorySidebar />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}

function EditorPanel({ promptText, setPromptText, keywords, setKeywords, kwInput, setKwInput, addKeyword, vars, aiModel, setAiModel }: {
  promptText: string; setPromptText: (v: string) => void;
  keywords: string[]; setKeywords: (fn: (prev: string[]) => string[]) => void;
  kwInput: string; setKwInput: (v: string) => void;
  addKeyword: () => void; vars: string[];
  aiModel: string | null; setAiModel: (v: string | null) => void;
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

  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: number }) => api.patch(`/agents/${id}`, { priority }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); },
  });

  const allAgents = agentsData?.data ?? [];

  const companies = isSuperAdmin
    ? Array.from(new Map(allAgents.filter((a) => a.company).map((a) => [a.company!.id, a.company!])).values())
    : [];

  const agents = isSuperAdmin && companyFilter
    ? allAgents.filter((a) => a.company?.id === companyFilter)
    : allAgents;

  const templates = (templatesData?.data ?? []).filter((t) => !allAgents.some((a) => a.templateId === t.id && a.isActive));
  const hasOrchestrator = agents.some((a) => a.type === "orchestrator" && a.isActive);

  // Sorted by priority for the flow diagram
  const sortedAgents = [...agents].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

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
          {isSuperAdmin && <Tabs.Tab value="flow" leftSection={<IconNetwork size={16} />}>Diagrama do Fluxo</Tabs.Tab>}
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
              {sortedAgents.map((agent, idx) => (
                <Card key={agent.id} padding="lg" radius="lg" withBorder shadow="sm" style={{ display: "flex", flexDirection: "column" }}>
                  <Group justify="space-between" mb="md">
                    <ThemeIcon size={40} radius="md" color={typeColors[agent.type] ?? "gray"} variant="light"><IconRobot size={20} /></ThemeIcon>
                    <Group gap={6}>
                      {/* Priority badge + up/down buttons for super_admin */}
                      {isSuperAdmin && (
                        <Group gap={2}>
                          <Tooltip label="Aumentar prioridade">
                            <ActionIcon size="xs" variant="subtle" color="orange"
                              disabled={idx === 0}
                              onClick={() => {
                                const prev = sortedAgents[idx - 1];
                                if (prev) {
                                  priorityMutation.mutate({ id: agent.id, priority: (prev.priority ?? 0) + 1 });
                                }
                              }}>
                              <IconArrowUp size={11} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Diminuir prioridade">
                            <ActionIcon size="xs" variant="subtle" color="gray"
                              disabled={idx === sortedAgents.length - 1}
                              onClick={() => {
                                const next = sortedAgents[idx + 1];
                                const newPriority = Math.max(0, (next?.priority ?? 0) - 1);
                                priorityMutation.mutate({ id: agent.id, priority: newPriority });
                              }}>
                              <IconArrowDown size={11} />
                            </ActionIcon>
                          </Tooltip>
                          {(agent.priority ?? 0) > 0 && (
                            <Badge size="xs" color="orange" variant="light">P{agent.priority}</Badge>
                          )}
                        </Group>
                      )}
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
                    {/* Advanced config indicators */}
                    {(agent.activeHoursStart != null) && (
                      <Tooltip label={`Ativo ${agent.activeHoursStart}h–${agent.activeHoursEnd}h UTC`}>
                        <Badge color="teal" variant="light" size="xs" leftSection={<IconClock size={9} />}>Horário</Badge>
                      </Tooltip>
                    )}
                    {(agent.handoffTriggers?.length ?? 0) > 0 && (
                      <Tooltip label={`${agent.handoffTriggers!.length} gatilho(s) de transbordo`}>
                        <Badge color="red" variant="light" size="xs" leftSection={<IconAlertTriangle size={9} />}>Gatilhos</Badge>
                      </Tooltip>
                    )}
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

        <Tabs.Panel value="flow">
          <Stack gap="md">
            <Box>
              <Text fw={600} mb={4}>Diagrama do Fluxo de Atendimento</Text>
              <Text size="sm" c="dimmed">Visualização da arquitetura multi-agente — agentes especialistas ordenados por prioridade.</Text>
            </Box>
            {loadingAgents ? (
              <Skeleton height={400} radius="lg" />
            ) : (
              <FlowDiagram agents={sortedAgents} />
            )}
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Paper p="sm" radius="md" withBorder>
                <Text size="xs" fw={600} c="orange" mb={4}>Orquestrador</Text>
                <Text size="xs" c="dimmed">Ponto de entrada. Recebe a mensagem do WhatsApp e coordena o fluxo.</Text>
              </Paper>
              <Paper p="sm" radius="md" withBorder>
                <Text size="xs" fw={600} c="blue" mb={4}>Router IA</Text>
                <Text size="xs" c="dimmed">Analisa a mensagem e seleciona qual(is) especialista(s) deve(m) responder.</Text>
              </Paper>
              <Paper p="sm" radius="md" withBorder>
                <Text size="xs" fw={600} c="violet" mb={4}>Sintetizador</Text>
                <Text size="xs" c="dimmed">Quando múltiplos especialistas respondem, o sintetizador gera uma resposta coesa.</Text>
              </Paper>
            </SimpleGrid>
          </Stack>
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

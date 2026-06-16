"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, SimpleGrid, Skeleton,
  ThemeIcon, Modal, TextInput, Textarea, Select, Switch, TagsInput, ActionIcon,
  Menu, Divider, Paper, Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconRobot, IconPlus, IconDots, IconPencil, IconTrash, IconBolt,
  IconVariable, IconX, IconCheck,
} from "@tabler/icons-react";

interface DynamicField {
  key: string; label: string; type: string;
  placeholder?: string; description?: string; required: boolean;
}
interface AgentTemplate {
  id: string; name: string; description: string | null; type: string;
  scope: string; isActive: boolean; triggerKeywords: string[];
  prompt: string; dynamicFields: DynamicField[];
  _count?: { instances: number };
}

const typeOptions = [
  { value: "commercial", label: "Comercial" },
  { value: "attendance", label: "Atendimento" },
  { value: "support", label: "Suporte" },
  { value: "qualification", label: "Qualificação" },
  { value: "followup", label: "Follow-up" },
  { value: "manager", label: "Gerente Orquestrador" },
];
const typeColors: Record<string, string> = {
  commercial: "blue", attendance: "violet", support: "green",
  qualification: "yellow", followup: "pink", manager: "gray",
};

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
        <Text size="sm" fw={600}>Campos Dinâmicos</Text>
        <Button size="xs" variant="light" leftSection={<IconPlus size={12} />} onClick={() => setAdding(true)}>Adicionar campo</Button>
      </Group>
      <Text size="xs" c="dimmed">Use {`{{key}}`} no prompt para inserir os valores preenchidos pela empresa ao ativar.</Text>

      {fields.map((f, i) => (
        <Paper key={f.key} p="sm" radius="md" withBorder>
          <Group justify="space-between">
            <Group gap="sm">
              <Badge size="xs" variant="outline" color="violet">{`{{${f.key}}}`}</Badge>
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
                data={[{ value: "text", label: "Texto" }, { value: "textarea", label: "Texto longo" }, { value: "number", label: "Número" }]}
                value={draft.type} onChange={(v) => setDraft({ ...draft, type: v ?? "text" })} />
            </Group>
            <TextInput label="Placeholder de exemplo" size="xs"
              value={draft.placeholder} onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })} />
            <TextInput label="Instrução para a empresa" size="xs"
              value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <Group>
              <Switch label="Obrigatório" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.currentTarget.checked })} />
              <Button size="xs" onClick={addField} leftSection={<IconCheck size={12} />}>Adicionar</Button>
              <Button size="xs" variant="subtle" onClick={() => { setAdding(false); setDraft(empty); }}>Cancelar</Button>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

function TemplateModal({ opened, onClose, template }: { opened: boolean; onClose: () => void; template?: AgentTemplate }) {
  const qc = useQueryClient();
  const isEdit = !!template;

  const form = useForm({
    initialValues: {
      name: template?.name ?? "",
      description: template?.description ?? "",
      type: template?.type ?? "commercial",
      scope: template?.scope ?? "external",
      prompt: template?.prompt ?? "",
      triggerKeywords: template?.triggerKeywords ?? [],
      dynamicFields: (template?.dynamicFields ?? []) as DynamicField[],
      isActive: template?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      isEdit
        ? api.patch(`/agent-templates/${template!.id}`, values).then((r) => r.data)
        : api.post("/agent-templates", values).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-templates"] });
      notifications.show({ message: isEdit ? "Template atualizado!" : "Template criado!", color: "green" });
      onClose(); form.reset();
    },
    onError: () => notifications.show({ message: "Erro ao salvar template", color: "red" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title={isEdit ? "Editar Template" : "Novo Template de Agente"}
      size="xl" radius="lg" scrollAreaComponent={Box as never}>
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack gap="md">
          <Group grow>
            <TextInput label="Nome do agente" required {...form.getInputProps("name")} />
            <Select label="Tipo" data={typeOptions} required {...form.getInputProps("type")} />
          </Group>
          <TextInput label="Descrição" placeholder="Para que serve este agente..." {...form.getInputProps("description")} />
          <Select label="Escopo" data={[{ value: "external", label: "Externo (WhatsApp)" }, { value: "internal", label: "Interno" }]} {...form.getInputProps("scope")} />
          <Textarea
            label="Prompt base"
            description={`Use {{key}} para campos dinâmicos. Ex: "Você é da empresa {{company_name}}"`}
            minRows={7} autosize
            {...form.getInputProps("prompt")}
          />
          <Divider />
          <DynamicFieldsEditor
            fields={form.values.dynamicFields}
            onChange={(fields) => form.setFieldValue("dynamicFields", fields)}
          />
          <Divider />
          <TagsInput label="Palavras-chave de ativação" placeholder="Digite e pressione Enter" {...form.getInputProps("triggerKeywords")} />
          <Switch label="Template ativo (visível para empresas)" {...form.getInputProps("isActive", { type: "checkbox" })} />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? "Salvar" : "Criar template"}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default function GlobalAgentsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgentTemplate | undefined>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: AgentTemplate[] }>({
    queryKey: ["agent-templates"],
    queryFn: () => api.get("/agent-templates").then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agent-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-templates"] }); notifications.show({ message: "Template desativado", color: "orange" }); },
  });

  const templates = data?.data ?? [];

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Agentes Globais</Title>
          <Text c="dimmed" size="sm" mt={4}>Templates de agentes disponíveis para todas as empresas ativarem</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(undefined); setModalOpen(true); }}>Novo Template</Button>
      </Group>

      <TemplateModal opened={modalOpen} onClose={() => setModalOpen(false)} template={editing} />

      {isLoading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={220} radius="lg" />)}
        </SimpleGrid>
      ) : templates.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconRobot size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhum template criado</Text>
            <Text size="sm" c="dimmed">Crie templates de agentes para que as empresas possam ativar</Text>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => { setEditing(undefined); setModalOpen(true); }}>Criar primeiro template</Button>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {templates.map((t) => (
            <Card key={t.id} padding="lg" radius="lg" withBorder shadow="sm">
              <Group justify="space-between" mb="md">
                <ThemeIcon size={40} radius="md" color={typeColors[t.type] ?? "gray"} variant="light"><IconRobot size={20} /></ThemeIcon>
                <Group gap={6}>
                  <Badge color={t.isActive ? "green" : "gray"} variant="light" size="sm">{t.isActive ? "Ativo" : "Inativo"}</Badge>
                  <Menu withinPortal position="bottom-end" shadow="sm">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" size="sm"><IconDots size={14} /></ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => { setEditing(t); setModalOpen(true); }}>Editar</Menu.Item>
                      <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => deleteMutation.mutate(t.id)}>Desativar</Menu.Item>
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
              </Group>
              {t.dynamicFields.length > 0 && (
                <Box mb="sm">
                  <Text size="xs" c="dimmed" fw={500} mb={4}>
                    <IconVariable size={11} style={{ verticalAlign: "middle", marginRight: 2 }} />
                    {t.dynamicFields.length} campo{t.dynamicFields.length > 1 ? "s" : ""} dinâmico{t.dynamicFields.length > 1 ? "s" : ""}
                  </Text>
                  <Group gap={4}>
                    {t.dynamicFields.map((f) => (
                      <Tooltip key={f.key} label={f.label} withArrow>
                        <Badge size="xs" variant="dot" color="violet">{`{{${f.key}}}`}</Badge>
                      </Tooltip>
                    ))}
                  </Group>
                </Box>
              )}
              {t.triggerKeywords.length > 0 && (
                <Group gap={4} mb="xs">
                  {t.triggerKeywords.slice(0, 3).map((kw) => (
                    <Badge key={kw} size="xs" variant="outline" color="gray" leftSection={<IconBolt size={8} />}>{kw}</Badge>
                  ))}
                  {t.triggerKeywords.length > 3 && <Text size="xs" c="dimmed">+{t.triggerKeywords.length - 3}</Text>}
                </Group>
              )}
              {t._count && (
                <Text size="xs" c="dimmed">{t._count.instances} empresa{t._count.instances !== 1 ? "s" : ""} usando</Text>
              )}
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

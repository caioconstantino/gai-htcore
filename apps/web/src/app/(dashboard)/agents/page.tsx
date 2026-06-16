"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, SimpleGrid, Skeleton,
  ThemeIcon, Modal, TextInput, Textarea, Select, Switch, TagsInput, ActionIcon, Menu,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconRobot, IconPlus, IconBolt, IconWorld, IconLock, IconDots, IconPencil, IconTrash } from "@tabler/icons-react";

interface Agent {
  id: string; name: string; description: string | null; type: string;
  scope: string; isActive: boolean; triggerKeywords: string[];
  prompt: string;
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

function AgentModal({ opened, onClose, agent }: { opened: boolean; onClose: () => void; agent?: Agent }) {
  const qc = useQueryClient();
  const isEdit = !!agent;

  const form = useForm({
    initialValues: {
      name: agent?.name ?? "",
      description: agent?.description ?? "",
      type: agent?.type ?? "commercial",
      scope: agent?.scope ?? "external",
      prompt: agent?.prompt ?? "",
      triggerKeywords: agent?.triggerKeywords ?? [],
      isActive: agent?.isActive ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      isEdit
        ? api.patch(`/agents/${agent!.id}`, values).then((r) => r.data)
        : api.post("/agents", values).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      notifications.show({ message: isEdit ? "Agente atualizado!" : "Agente criado!", color: "green" });
      onClose();
      form.reset();
    },
    onError: () => notifications.show({ message: "Erro ao salvar agente", color: "red" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title={isEdit ? "Editar Agente" : "Novo Agente"} size="lg" radius="lg">
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack gap="md">
          <Group grow>
            <TextInput label="Nome do agente" placeholder="Agente Comercial" required {...form.getInputProps("name")} />
            <Select label="Tipo" data={typeOptions} required {...form.getInputProps("type")} />
          </Group>
          <TextInput label="Descrição" placeholder="Responsável por..." {...form.getInputProps("description")} />
          <Select label="Escopo" data={[{ value: "external", label: "Externo (WhatsApp)" }, { value: "internal", label: "Interno" }]} {...form.getInputProps("scope")} />
          <Textarea
            label="Prompt do agente"
            placeholder="Você é um agente comercial especializado em locação de equipamentos. Seu objetivo é..."
            minRows={5}
            autosize
            {...form.getInputProps("prompt")}
          />
          <TagsInput
            label="Palavras-chave de ativação"
            placeholder="Digite e pressione Enter"
            description="O agente será ativado quando o cliente usar estas palavras"
            {...form.getInputProps("triggerKeywords")}
          />
          <Switch label="Agente ativo" {...form.getInputProps("isActive", { type: "checkbox" })} />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? "Salvar" : "Criar agente"}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default function AgentsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | undefined>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Agent[] }>({
    queryKey: ["agents"],
    queryFn: () => api.get("/agents").then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); notifications.show({ message: "Agente removido", color: "orange" }); },
  });

  const agents = data?.data ?? [];

  function openCreate() { setEditing(undefined); setModalOpen(true); }
  function openEdit(a: Agent) { setEditing(a); setModalOpen(true); }

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Agentes de IA</Title>
          <Text c="dimmed" size="sm" mt={4}>{agents.length} agentes configurados</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} radius="md" onClick={openCreate}>Novo Agente</Button>
      </Group>

      <AgentModal opened={modalOpen} onClose={() => setModalOpen(false)} agent={editing} />

      {isLoading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={200} radius="lg" />)}
        </SimpleGrid>
      ) : agents.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconRobot size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhum agente criado</Text>
            <Text size="sm" c="dimmed">Crie agentes para automatizar o atendimento via WhatsApp</Text>
            <Button variant="light" leftSection={<IconPlus size={16} />} mt="xs" onClick={openCreate}>Criar primeiro agente</Button>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {agents.map((agent) => (
            <Card key={agent.id} padding="lg" radius="lg" withBorder shadow="sm">
              <Group justify="space-between" mb="md">
                <ThemeIcon size={40} radius="md" color={typeColors[agent.type] ?? "gray"} variant="light">
                  <IconRobot size={20} />
                </ThemeIcon>
                <Group gap={6}>
                  <Badge color={agent.isActive ? "green" : "gray"} variant="light" size="sm">
                    {agent.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                  <Menu withinPortal position="bottom-end" shadow="sm">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" size="sm"><IconDots size={14} /></ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEdit(agent)}>Editar</Menu.Item>
                      <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => deleteMutation.mutate(agent.id)}>Remover</Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>
              <Text fw={600} size="sm" mb={4}>{agent.name}</Text>
              {agent.description && <Text size="xs" c="dimmed" mb="md" lineClamp={2}>{agent.description}</Text>}
              <Group gap="xs" mb="sm">
                <Badge color={typeColors[agent.type] ?? "gray"} variant="light" size="xs">
                  {typeOptions.find((t) => t.value === agent.type)?.label ?? agent.type}
                </Badge>
                <Badge color="gray" variant="outline" size="xs"
                  leftSection={agent.scope === "external" ? <IconWorld size={10} /> : <IconLock size={10} />}>
                  {agent.scope === "external" ? "Externo" : "Interno"}
                </Badge>
              </Group>
              {agent.triggerKeywords.length > 0 && (
                <Group gap={4}>
                  {agent.triggerKeywords.slice(0, 3).map((kw) => (
                    <Badge key={kw} size="xs" variant="outline" color="gray" leftSection={<IconBolt size={8} />}>{kw}</Badge>
                  ))}
                  {agent.triggerKeywords.length > 3 && <Text size="xs" c="dimmed">+{agent.triggerKeywords.length - 3}</Text>}
                </Group>
              )}
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

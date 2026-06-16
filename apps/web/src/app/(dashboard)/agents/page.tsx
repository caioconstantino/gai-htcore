"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, SimpleGrid, Skeleton,
  ThemeIcon, Modal, TextInput, Textarea, Select, Switch, ActionIcon, Menu, Tabs, Divider,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconRobot, IconPlus, IconBolt, IconWorld, IconLock, IconDots,
  IconTrash, IconBoltOff, IconCheck, IconVariable,
} from "@tabler/icons-react";

interface DynamicField { key: string; label: string; type: string; placeholder?: string; description?: string; required: boolean; }
interface AgentTemplate { id: string; name: string; description: string | null; type: string; scope: string; triggerKeywords: string[]; dynamicFields: DynamicField[]; _count?: { instances: number }; }
interface Agent { id: string; name: string; description: string | null; type: string; scope: string; isActive: boolean; triggerKeywords: string[]; prompt: string; templateId: string | null; }

const typeColors: Record<string, string> = { commercial: "blue", attendance: "violet", support: "green", qualification: "yellow", followup: "pink", manager: "gray" };
const typeLabels: Record<string, string> = { commercial: "Comercial", attendance: "Atendimento", support: "Suporte", qualification: "Qualificação", followup: "Follow-up", manager: "Gerente" };

// ── Activation Modal ───────────────────────────────────────────────
function ActivateModal({ template, onClose }: { template: AgentTemplate; onClose: () => void }) {
  const qc = useQueryClient();
  const fields = template.dynamicFields as DynamicField[];
  const form = useForm({ initialValues: Object.fromEntries(fields.map((f) => [f.key, ""])) });

  const mutation = useMutation({
    mutationFn: (dynamicValues: Record<string, string>) =>
      api.post("/agent-templates/activate", { templateId: template.id, dynamicValues }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      notifications.show({ message: `Agente "${template.name}" ativado com sucesso!`, color: "green" });
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
              <Button leftSection={<IconCheck size={16} />} loading={mutation.isPending}
                onClick={() => mutation.mutate({})}>Ativar agente</Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}

export default function AgentsPage() {
  const [activating, setActivating] = useState<AgentTemplate | null>(null);
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

  const agents = agentsData?.data ?? [];
  const templates = (templatesData?.data ?? []).filter((t) => !agents.some((a) => a.templateId === t.id && a.isActive));

  return (
    <Stack gap="lg" maw={1200}>
      <Box>
        <Title order={2} fw={700}>Agentes de IA</Title>
        <Text c="dimmed" size="sm" mt={4}>Seus agentes ativos e os modelos disponíveis para ativar</Text>
      </Box>

      {activating && <ActivateModal template={activating} onClose={() => setActivating(null)} />}

      <Tabs defaultValue="active">
        <Tabs.List mb="md">
          <Tabs.Tab value="active" leftSection={<IconRobot size={16} />}>
            Meus Agentes ({agents.length})
          </Tabs.Tab>
          <Tabs.Tab value="templates" leftSection={<IconPlus size={16} />}>
            Ativar Agente ({templates.length} disponíveis)
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Active agents ── */}
        <Tabs.Panel value="active">
          {loadingAgents ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={200} radius="lg" />)}
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
                <Card key={agent.id} padding="lg" radius="lg" withBorder shadow="sm">
                  <Group justify="space-between" mb="md">
                    <ThemeIcon size={40} radius="md" color={typeColors[agent.type] ?? "gray"} variant="light"><IconRobot size={20} /></ThemeIcon>
                    <Group gap={6}>
                      <Badge color={agent.isActive ? "green" : "gray"} variant="light" size="sm">{agent.isActive ? "Ativo" : "Inativo"}</Badge>
                      <Menu withinPortal position="bottom-end" shadow="sm">
                        <Menu.Target><ActionIcon variant="subtle" color="gray" size="sm"><IconDots size={14} /></ActionIcon></Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={agent.isActive ? <IconBoltOff size={14} /> : <IconBolt size={14} />}
                            onClick={() => toggleMutation.mutate({ id: agent.id, isActive: !agent.isActive })}>
                            {agent.isActive ? "Desativar" : "Ativar"}
                          </Menu.Item>
                          <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => deleteMutation.mutate(agent.id)}>Remover</Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>
                  <Text fw={600} size="sm" mb={4}>{agent.name}</Text>
                  {agent.description && <Text size="xs" c="dimmed" mb="sm" lineClamp={2}>{agent.description}</Text>}
                  <Group gap="xs" mb="sm">
                    <Badge color={typeColors[agent.type] ?? "gray"} variant="light" size="xs">{typeLabels[agent.type] ?? agent.type}</Badge>
                    <Badge color="gray" variant="outline" size="xs" leftSection={agent.scope === "external" ? <IconWorld size={10} /> : <IconLock size={10} />}>
                      {agent.scope === "external" ? "WhatsApp" : "Interno"}
                    </Badge>
                  </Group>
                  {agent.triggerKeywords.length > 0 && (
                    <Group gap={4}>
                      {agent.triggerKeywords.slice(0, 3).map((kw) => (
                        <Badge key={kw} size="xs" variant="outline" color="gray" leftSection={<IconBolt size={8} />}>{kw}</Badge>
                      ))}
                    </Group>
                  )}
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        {/* ── Available templates ── */}
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
                    <Group gap={4} mb="sm">
                      <Badge size="xs" color="violet" variant="light" leftSection={<IconVariable size={10} />}>
                        {t.dynamicFields.length} campo{t.dynamicFields.length > 1 ? "s" : ""} para preencher
                      </Badge>
                    </Group>
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

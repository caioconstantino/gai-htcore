"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, Tabs,
  Skeleton, ThemeIcon, Progress, Modal, TextInput, Select,
  PasswordInput, ActionIcon, Switch, SimpleGrid, NumberInput, Code,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBuilding, IconPlus, IconArrowLeft, IconUsers,
  IconRobot, IconBolt, IconSettings, IconPencil,
  IconCheck, IconX, IconRefresh, IconBrandWhatsapp,
} from "@tabler/icons-react";

// ── Register 360dialog webhook button ───────────────────────────
function RegisterWebhookButton({ companyId, companySlug }: { companyId: string; companySlug: string }) {
  const [result, setResult] = useState<{ webhookUrl: string } | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.post(`/companies/${companyId}/register-webhook`).then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      notifications.show({ message: "Webhook registrado com sucesso na 360dialog!", color: "green" });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao registrar webhook";
      notifications.show({ message: msg, color: "red" });
    },
  });

  return (
    <Stack gap="sm">
      {result && (
        <Box p="sm" style={{ background: "var(--mantine-color-green-0)", borderRadius: 8, border: "1px solid var(--mantine-color-green-3)" }}>
          <Text size="xs" c="green.8" fw={600} mb={4}>Webhook registrado:</Text>
          <Code style={{ fontSize: 11, wordBreak: "break-all" }}>{result.webhookUrl}</Code>
        </Box>
      )}
      <Group>
        <Button
          leftSection={<IconBrandWhatsapp size={16} />}
          color="green"
          variant="light"
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
          size="sm"
        >
          Registrar webhook na 360dialog
        </Button>
        {result && (
          <Button leftSection={<IconRefresh size={14} />} variant="subtle" size="sm" color="gray" onClick={() => mutation.mutate()}>
            Re-registrar
          </Button>
        )}
      </Group>
    </Stack>
  );
}

interface Company {
  id: string; name: string; slug: string; plan: string; isActive: boolean;
  tokensUsed: number; tokenLimit: number; userLimit: number;
  whatsappPhoneNumberId: string | null; whatsappToken: string | null;
  aiProvider: string; aiModel: string; primaryColor: string | null;
  createdAt: string;
  _count: { users: number; leads: number; conversations: number; agents: number; products: number; quotes: number };
}

interface User {
  id: string; name: string; email: string; role: string;
  isActive: boolean; lastLoginAt: string | null; tokensUsed: number; createdAt: string;
}

interface Agent {
  id: string; name: string; type: string; scope: string; isActive: boolean;
  triggerKeywords: string[]; description: string | null;
}

const roleLabels: Record<string, string> = {
  company_admin: "Admin", manager: "Gerente", commercial: "Comercial",
  operator: "Operador", super_admin: "Super Admin",
};
const roleColors: Record<string, string> = {
  company_admin: "blue", manager: "violet", commercial: "green",
  operator: "gray", super_admin: "red",
};
const typeColors: Record<string, string> = {
  commercial: "blue", attendance: "violet", support: "green",
  qualification: "yellow", financial: "orange", followup: "pink",
};

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [userModal, { open: openUser, close: closeUser }] = useDisclosure(false);
  const [editModal, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "operator" });
  const [editForm, setEditForm] = useState<Partial<Company>>({});

  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ["company", id],
    queryFn: () => api.get(`/companies/${id}`).then((r) => {
      const d: Company = r.data;
      setEditForm({ name: d.name, plan: d.plan, tokenLimit: d.tokenLimit, userLimit: d.userLimit, aiProvider: d.aiProvider, aiModel: d.aiModel, whatsappPhoneNumberId: d.whatsappPhoneNumberId ?? "", whatsappToken: d.whatsappToken ?? "" });
      return d;
    }),
  });

  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: ["company-users", id],
    queryFn: () => api.get(`/companies/${id}/users`).then((r) => r.data),
  });

  const { data: agentsData } = useQuery<{ data: Agent[] }>({
    queryKey: ["company-agents", id],
    queryFn: () => api.get(`/companies/${id}/agents`).then((r) => r.data),
  });

  const createUserMutation = useMutation({
    mutationFn: (body: typeof userForm) =>
      api.post("/users", { ...body, companyId: id }).then((r) => r.data),
    onSuccess: () => {
      notifications.show({ title: "Usuário criado", message: "Usuário adicionado com sucesso!", color: "green" });
      qc.invalidateQueries({ queryKey: ["company-users", id] });
      qc.invalidateQueries({ queryKey: ["company", id] });
      closeUser();
      setUserForm({ name: "", email: "", password: "", role: "operator" });
    },
    onError: () => notifications.show({ title: "Erro", message: "Não foi possível criar o usuário.", color: "red" }),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: (body: Partial<Company>) => api.patch(`/companies/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      notifications.show({ title: "Salvo", message: "Configurações atualizadas com sucesso!", color: "green" });
      qc.invalidateQueries({ queryKey: ["company", id] });
      closeEdit();
    },
    onError: () => notifications.show({ title: "Erro", message: "Erro ao salvar configurações.", color: "red" }),
  });

  const toggleUserMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.patch(`/users/${userId}`, { isActive }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-users", id] }),
  });

  if (isLoading) {
    return (
      <Stack gap="lg">
        <Skeleton height={40} width={300} radius="md" />
        <Skeleton height={200} radius="lg" />
      </Stack>
    );
  }

  if (!company) return <Text c="dimmed">Empresa não encontrada</Text>;

  const tokenPct = Math.round((company.tokensUsed / company.tokenLimit) * 100);
  const users = usersData?.data ?? [];
  const agents = agentsData?.data ?? [];

  return (
    <>
      <Stack gap="lg" maw={1280}>
        {/* Header */}
        <Group>
          <ActionIcon variant="subtle" color="gray" onClick={() => router.push("/companies")}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Box style={{ flex: 1 }}>
            <Group gap="sm">
              <Title order={2} fw={700}>{company.name}</Title>
              <Badge color={company.isActive ? "green" : "red"} variant="dot">
                {company.isActive ? "Ativo" : "Inativo"}
              </Badge>
              <Badge color="blue" variant="light">{company.plan}</Badge>
            </Group>
            <Text c="dimmed" size="sm">/{company.slug} · criada em {new Date(company.createdAt).toLocaleDateString("pt-BR")}</Text>
          </Box>
          <Button leftSection={<IconPencil size={16} />} variant="light" onClick={openEdit}>
            Editar empresa
          </Button>
        </Group>

        {/* KPI cards */}
        <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="sm">
          {[
            { label: "Usuários", val: company._count.users },
            { label: "Leads", val: company._count.leads },
            { label: "Conversas", val: company._count.conversations },
            { label: "Agentes", val: company._count.agents },
            { label: "Produtos", val: company._count.products },
            { label: "Orçamentos", val: company._count.quotes },
          ].map(({ label, val }) => (
            <Card key={label} padding="md" radius="lg" withBorder ta="center">
              <Text size="xl" fw={800} lh={1}>{val}</Text>
              <Text size="xs" c="dimmed" mt={4}>{label}</Text>
            </Card>
          ))}
        </SimpleGrid>

        {/* Token usage */}
        <Card padding="lg" radius="lg" withBorder shadow="sm">
          <Group mb="sm">
            <IconBolt size={16} color="var(--mantine-color-yellow-6)" />
            <Text fw={600} size="sm">Consumo de Tokens</Text>
            <Badge color={tokenPct > 80 ? "red" : "blue"} variant="light" size="sm" ml="auto">
              {company.tokensUsed.toLocaleString("pt-BR")} / {company.tokenLimit.toLocaleString("pt-BR")}
            </Badge>
          </Group>
          <Progress value={tokenPct} color={tokenPct > 80 ? "red" : tokenPct > 60 ? "yellow" : "blue"} size="md" radius="xl" />
          <Text size="xs" c="dimmed" mt={6}>{tokenPct}% utilizado</Text>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="users" radius="md">
          <Tabs.List mb="md">
            <Tabs.Tab value="users" leftSection={<IconUsers size={14} />}>
              Usuários ({users.length})
            </Tabs.Tab>
            <Tabs.Tab value="agents" leftSection={<IconRobot size={14} />}>
              Agentes ({agents.length})
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={14} />}>
              Configurações
            </Tabs.Tab>
          </Tabs.List>

          {/* Users Tab */}
          <Tabs.Panel value="users">
            <Stack gap="md">
              <Group justify="flex-end">
                <Button size="sm" leftSection={<IconPlus size={14} />} onClick={openUser}>
                  Novo Usuário
                </Button>
              </Group>
              {users.length === 0 ? (
                <Card padding="xl" withBorder radius="lg" style={{ borderStyle: "dashed" }}>
                  <Stack align="center" py="md">
                    <IconUsers size={40} color="var(--mantine-color-gray-3)" />
                    <Text c="dimmed">Nenhum usuário cadastrado</Text>
                    <Button variant="light" leftSection={<IconPlus size={14} />} size="sm" onClick={openUser}>
                      Adicionar usuário
                    </Button>
                  </Stack>
                </Card>
              ) : (
                <Card padding={0} radius="lg" withBorder shadow="sm">
                  {users.map((u, i) => (
                    <Box
                      key={u.id}
                      px="lg" py="md"
                      style={{
                        display: "flex", alignItems: "center", gap: 16,
                        borderBottom: i < users.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
                      }}
                    >
                      <Box
                        style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: "var(--mantine-color-blue-1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 700, color: "var(--mantine-color-blue-7)", fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </Box>
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={500}>{u.name}</Text>
                        <Text size="xs" c="dimmed">{u.email}</Text>
                      </Box>
                      <Group gap="sm">
                        <Badge color={roleColors[u.role] ?? "gray"} variant="light" size="sm">
                          {roleLabels[u.role] ?? u.role}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {u.lastLoginAt ? `Último acesso: ${new Date(u.lastLoginAt).toLocaleDateString("pt-BR")}` : "Nunca acessou"}
                        </Text>
                        <Switch
                          checked={u.isActive}
                          size="sm"
                          onChange={(e) => toggleUserMutation.mutate({ userId: u.id, isActive: e.currentTarget.checked })}
                        />
                      </Group>
                    </Box>
                  ))}
                </Card>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Agents Tab */}
          <Tabs.Panel value="agents">
            {agents.length === 0 ? (
              <Card padding="xl" withBorder radius="lg" style={{ borderStyle: "dashed" }}>
                <Stack align="center" py="md">
                  <IconRobot size={40} color="var(--mantine-color-gray-3)" />
                  <Text c="dimmed">Nenhum agente configurado</Text>
                </Stack>
              </Card>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {agents.map((agent) => (
                  <Card key={agent.id} padding="md" radius="lg" withBorder shadow="sm">
                    <Group justify="space-between" mb="xs">
                      <Group gap="sm">
                        <ThemeIcon size={32} radius="md" color={typeColors[agent.type] ?? "gray"} variant="light">
                          <IconRobot size={16} />
                        </ThemeIcon>
                        <Text fw={600} size="sm">{agent.name}</Text>
                      </Group>
                      <Badge color={agent.isActive ? "green" : "gray"} variant="dot" size="sm">
                        {agent.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </Group>
                    {agent.description && <Text size="xs" c="dimmed" lineClamp={2}>{agent.description}</Text>}
                    <Group gap="xs" mt="xs">
                      <Badge size="xs" color={typeColors[agent.type] ?? "gray"} variant="light">{agent.type}</Badge>
                      <Badge size="xs" color="gray" variant="outline">{agent.scope}</Badge>
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Tabs.Panel>

          {/* Settings Tab */}
          <Tabs.Panel value="settings">
            <Stack gap="md">
              <Card padding="lg" radius="lg" withBorder shadow="sm">
                <Stack gap="md">
                  <Text fw={600} size="sm">Configurações da Empresa</Text>
                  <Group grow>
                    <Box>
                      <Text size="xs" c="dimmed" mb={4}>Provedor de IA</Text>
                      <Text size="sm" fw={500}>{company.aiProvider} · {company.aiModel}</Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed" mb={4}>Limite de usuários</Text>
                      <Text size="sm" fw={500}>{company.userLimit}</Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed" mb={4}>Limite de tokens</Text>
                      <Text size="sm" fw={500}>{company.tokenLimit.toLocaleString("pt-BR")}</Text>
                    </Box>
                  </Group>
                  <Button variant="light" leftSection={<IconPencil size={14} />} w="fit-content" onClick={openEdit}>
                    Editar configurações
                  </Button>
                </Stack>
              </Card>

              {/* 360dialog webhook registration */}
              <Card padding="lg" radius="lg" withBorder shadow="sm">
                <Stack gap="sm">
                  <Text fw={600} size="sm">WhatsApp via 360dialog</Text>
                  <Text size="xs" c="dimmed">
                    Após a empresa salvar a API Key nas configurações dela, use o botão abaixo para registrar o webhook na 360dialog automaticamente.
                  </Text>
                  <RegisterWebhookButton companyId={company.id} companySlug={company.slug} />
                </Stack>
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Modal: novo usuário */}
      <Modal opened={userModal} onClose={closeUser} title={<Text fw={600}>Novo Usuário</Text>} size="md" radius="lg">
        <Stack gap="md">
          <TextInput label="Nome" placeholder="João Silva" value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} required />
          <TextInput label="Email" placeholder="joao@empresa.com" type="email" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} required />
          <PasswordInput label="Senha" placeholder="Mínimo 6 caracteres" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} required />
          <Select
            label="Perfil"
            value={userForm.role}
            onChange={(v) => setUserForm((f) => ({ ...f, role: v ?? "operator" }))}
            data={[
              { value: "company_admin", label: "Admin da Empresa" },
              { value: "manager", label: "Gerente" },
              { value: "commercial", label: "Comercial" },
              { value: "operator", label: "Operador" },
            ]}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={closeUser}>Cancelar</Button>
            <Button loading={createUserMutation.isPending} onClick={() => createUserMutation.mutate(userForm)} disabled={!userForm.name || !userForm.email || !userForm.password}>
              Criar Usuário
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: editar empresa */}
      <Modal opened={editModal} onClose={closeEdit} title={<Text fw={600}>Editar Empresa</Text>} size="lg" radius="lg">
        <Stack gap="md">
          <TextInput label="Nome" value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
          <Select
            label="Plano"
            value={editForm.plan ?? "trial"}
            onChange={(v) => setEditForm((f) => ({ ...f, plan: v ?? "trial" }))}
            data={[
              { value: "trial", label: "Trial" },
              { value: "basic", label: "Basic" },
              { value: "pro", label: "Pro" },
              { value: "enterprise", label: "Enterprise" },
            ]}
          />
          <Group grow>
            <NumberInput label="Limite de tokens" value={editForm.tokenLimit ?? 1000000} onChange={(v) => setEditForm((f) => ({ ...f, tokenLimit: Number(v) }))} thousandSeparator="," decimalSeparator="." min={10000} step={100000} />
            <NumberInput label="Limite de usuários" value={editForm.userLimit ?? 10} onChange={(v) => setEditForm((f) => ({ ...f, userLimit: Number(v) }))} min={1} max={100} />
          </Group>
          <TextInput label="WhatsApp Phone Number ID" placeholder="Ex: 1234567890" value={editForm.whatsappPhoneNumberId ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, whatsappPhoneNumberId: e.target.value }))} />
          <TextInput label="WhatsApp Token" placeholder="Token de acesso da Meta API" value={editForm.whatsappToken ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, whatsappToken: e.target.value }))} />
          <Group grow>
            <Select
              label="Provedor de IA"
              value={editForm.aiProvider ?? "openai"}
              onChange={(v) => setEditForm((f) => ({ ...f, aiProvider: v ?? "openai" }))}
              data={[{ value: "openai", label: "OpenAI" }]}
            />
            <Select
              label="Modelo"
              value={editForm.aiModel ?? "gpt-4o-mini"}
              onChange={(v) => setEditForm((f) => ({ ...f, aiModel: v ?? "gpt-4o-mini" }))}
              data={[
                { value: "gpt-4o-mini", label: "GPT-4o Mini (econômico)" },
                { value: "gpt-4o", label: "GPT-4o (premium)" },
                { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
              ]}
            />
          </Group>
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={closeEdit}>Cancelar</Button>
            <Button loading={updateCompanyMutation.isPending} onClick={() => updateCompanyMutation.mutate(editForm)}>
              Salvar Alterações
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

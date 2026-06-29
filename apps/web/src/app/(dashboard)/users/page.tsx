"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, Skeleton,
  Modal, TextInput, Select, PasswordInput, Switch, Table, Avatar,
  ActionIcon, Tooltip, Menu, Divider, Alert,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconUsers, IconPlus, IconSearch, IconDots, IconPencil,
  IconTrash, IconCheck, IconX, IconShieldLock, IconAlertCircle,
} from "@tabler/icons-react";

interface User {
  id: string; name: string; email: string; role: string;
  isActive: boolean; lastLoginAt: string | null;
  tokensUsed: number; companyId: string | null; createdAt: string;
  customRoleId?: string | null; customRoleName?: string | null;
}

interface Company { id: string; name: string; slug: string; }

interface CompanyRole { id: string; name: string; }

const ROLES = [
  { value: "company_admin", label: "Admin da Empresa" },
  { value: "manager",       label: "Gerente" },
  { value: "commercial",    label: "Comercial" },
  { value: "operator",      label: "Operador" },
];
const ROLES_SUPER = [{ value: "super_admin", label: "Super Admin" }, ...ROLES];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", company_admin: "Admin", manager: "Gerente",
  commercial: "Comercial", operator: "Operador",
};
const ROLE_COLORS: Record<string, string> = {
  super_admin: "red", company_admin: "blue", manager: "violet",
  commercial: "green", operator: "gray",
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

type FormValues = {
  name: string; email: string; password: string; role: string; companyId: string; customRoleId: string;
};

const EMPTY_FORM: FormValues = { name: "", email: "", password: "", role: "operator", companyId: "", customRoleId: "" };

export default function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const isSuperAdmin   = me?.role === "super_admin";
  const isCompanyAdmin = me?.role === "company_admin";
  const canManageUsers = isSuperAdmin || isCompanyAdmin;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const setF = (patch: Partial<FormValues>) => setForm((f) => ({ ...f, ...patch }));

  // ── Queries ──────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<{ data: User[]; total: number }>({
    queryKey: ["users"],
    queryFn: () => api.get("/users?limit=200").then((r) => r.data),
  });

  const { data: companiesData } = useQuery<{ data: Company[] }>({
    queryKey: ["companies"],
    queryFn: () => api.get("/companies").then((r) => r.data),
    enabled: isSuperAdmin,
  });

  const { data: rolesData } = useQuery<CompanyRole[]>({
    queryKey: ["roles"],
    queryFn: () => api.get("/roles").then((r) => r.data),
    enabled: isCompanyAdmin || isSuperAdmin,
  });

  // ── Mutations ─────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (body: FormValues) => api.post("/users", body).then((r) => r.data),
    onSuccess: () => {
      notifications.show({ message: "Usuário criado com sucesso!", color: "green", icon: <IconCheck size={16} /> });
      qc.invalidateQueries({ queryKey: ["users"] });
      closeCreate(); setForm(EMPTY_FORM);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao criar usuário";
      notifications.show({ message: msg, color: "red" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<FormValues> & { isActive?: boolean } }) =>
      api.patch(`/users/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      notifications.show({ message: "Usuário atualizado!", color: "green", icon: <IconCheck size={16} /> });
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditing(null);
    },
    onError: () => notifications.show({ message: "Erro ao atualizar usuário", color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      notifications.show({ message: "Usuário removido", color: "orange", icon: <IconTrash size={16} /> });
      qc.invalidateQueries({ queryKey: ["users"] });
      setDeleting(null);
    },
    onError: () => notifications.show({ message: "Erro ao remover usuário", color: "red" }),
  });

  // ── Filtered list ─────────────────────────────────────────────────
  const users = data?.data ?? [];
  const filtered = users.filter((u) => {
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const companies = companiesData?.data ?? [];
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));
  const companyRoles: CompanyRole[] = rolesData ?? [];
  const roleOptions = companyRoles.map((r) => ({ value: r.id, label: r.name }));

  // ── Open edit ─────────────────────────────────────────────────────
  function openEdit(u: User) {
    setForm({ name: u.name, email: u.email, password: "", role: u.role, companyId: u.companyId ?? "", customRoleId: u.customRoleId ?? "" });
    setEditing(u);
  }

  return (
    <>
      <Stack gap="lg" maw={1100}>
        {/* Header */}
        <Group justify="space-between" align="flex-end">
          <Box>
            <Title order={2} fw={700}>Usuários</Title>
            <Text c="dimmed" size="sm" mt={4}>
              {data?.total ?? 0} usuários cadastrados
            </Text>
          </Box>
          {canManageUsers && (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Novo Usuário
            </Button>
          )}
        </Group>

        {/* Filters */}
        <Group gap="sm">
          <TextInput
            placeholder="Buscar por nome ou email..."
            leftSection={<IconSearch size={15} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, maxWidth: 340 }}
          />
          <Select
            placeholder="Todos os perfis"
            clearable
            value={roleFilter}
            onChange={setRoleFilter}
            data={isSuperAdmin ? ROLES_SUPER : ROLES}
            style={{ width: 200 }}
          />
        </Group>

        {/* Table */}
        {isLoading ? (
          <Stack gap="sm">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={56} radius="md" />)}
          </Stack>
        ) : filtered.length === 0 ? (
          <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
            <Stack align="center" py="xl" gap="sm">
              <IconUsers size={44} color="var(--mantine-color-gray-3)" />
              <Text c="dimmed">{search || roleFilter ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}</Text>
              {!search && !roleFilter && (
                <Button variant="light" size="sm" leftSection={<IconPlus size={14} />} onClick={openCreate}>
                  Criar primeiro usuário
                </Button>
              )}
            </Stack>
          </Card>
        ) : (
          <Card padding={0} radius="lg" withBorder shadow="sm">
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Usuário</Table.Th>
                  {isSuperAdmin && <Table.Th>Empresa</Table.Th>}
                  <Table.Th>Perfil</Table.Th>
                  <Table.Th ta="center">Status</Table.Th>
                  <Table.Th>Último acesso</Table.Th>
                  <Table.Th w={80} ta="center">Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((u) => (
                  <Table.Tr key={u.id} opacity={u.isActive ? 1 : 0.5}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Avatar size={36} radius="xl" color="blue">
                          {initials(u.name)}
                        </Avatar>
                        <Box style={{ minWidth: 0 }}>
                          <Group gap={6} wrap="nowrap">
                            <Text size="sm" fw={500} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {u.name}
                            </Text>
                            {u.id === me?.id && (
                              <Badge size="xs" color="blue" variant="dot">Você</Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed">{u.email}</Text>
                        </Box>
                      </Group>
                    </Table.Td>
                    {isSuperAdmin && (
                      <Table.Td>
                        <Text size="sm" c={u.companyId ? undefined : "dimmed"}>
                          {u.companyId ? (companyMap.get(u.companyId) ?? u.companyId) : "—"}
                        </Text>
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Stack gap={2}>
                        <Badge color={ROLE_COLORS[u.role] ?? "gray"} variant="light" size="sm">
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                        {u.customRoleName && (
                          <Badge color="violet" variant="dot" size="xs">{u.customRoleName}</Badge>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Tooltip label={u.isActive ? "Ativo — clique para desativar" : "Inativo — clique para ativar"} withArrow>
                        <Switch
                          checked={u.isActive}
                          size="sm"
                          color="green"
                          onChange={(e) =>
                            updateMutation.mutate({ id: u.id, body: { isActive: e.currentTarget.checked } })
                          }
                        />
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{fmt(u.lastLoginAt)}</Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Menu withinPortal shadow="md" width={160} position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" size="sm">
                            <IconDots size={15} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEdit(u)}>
                            Editar
                          </Menu.Item>
                          {canManageUsers && u.id !== me?.id && (
                            <>
                              <Divider />
                              <Menu.Item
                                leftSection={<IconTrash size={14} />}
                                color="red"
                                onClick={() => setDeleting(u)}
                              >
                                Excluir
                              </Menu.Item>
                            </>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}
      </Stack>

      {/* ── Modal: Criar usuário ───────────────────────────────────── */}
      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title={<Group gap="xs"><IconUsers size={18} /><Text fw={600}>Novo Usuário</Text></Group>}
        size="md"
        radius="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Nome completo"
            placeholder="João Silva"
            required
            value={form.name}
            onChange={(e) => setF({ name: e.currentTarget.value })}
          />
          <TextInput
            label="Email"
            type="email"
            placeholder="joao@empresa.com"
            required
            value={form.email}
            onChange={(e) => setF({ email: e.currentTarget.value })}
          />
          <PasswordInput
            label="Senha"
            placeholder="Mínimo 8 caracteres"
            required
            value={form.password}
            onChange={(e) => setF({ password: e.currentTarget.value })}
          />
          <Select
            label="Função"
            description="Define as permissões padrão do sistema"
            required
            value={form.role}
            onChange={(v) => setF({ role: v ?? "operator" })}
            data={isSuperAdmin ? ROLES_SUPER : ROLES}
          />
          {roleOptions.length > 0 && (
            <Select
              label="Perfil de acesso personalizado"
              description="Sobrescreve as permissões padrão da função"
              placeholder="Nenhum (usa permissões da função)"
              clearable
              value={form.customRoleId || null}
              onChange={(v) => setF({ customRoleId: v ?? "" })}
              data={roleOptions}
            />
          )}
          {isSuperAdmin && (
            <Select
              label="Empresa"
              placeholder="Selecione a empresa"
              searchable
              clearable
              value={form.companyId || null}
              onChange={(v) => setF({ companyId: v ?? "" })}
              data={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={closeCreate}>Cancelar</Button>
            <Button
              loading={createMutation.isPending}
              disabled={!form.name || !form.email || !form.password}
              leftSection={<IconCheck size={15} />}
              onClick={() => createMutation.mutate({ ...form, customRoleId: form.customRoleId || undefined } as FormValues)}
            >
              Criar usuário
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Modal: Editar usuário ──────────────────────────────────── */}
      <Modal
        opened={!!editing}
        onClose={() => setEditing(null)}
        title={<Group gap="xs"><IconPencil size={18} /><Text fw={600}>Editar Usuário</Text></Group>}
        size="md"
        radius="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Nome completo"
            required
            value={form.name}
            onChange={(e) => setF({ name: e.currentTarget.value })}
          />
          <TextInput
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setF({ email: e.currentTarget.value })}
          />
          <PasswordInput
            label="Nova senha"
            description="Deixe em branco para manter a senha atual"
            placeholder="Nova senha (opcional)"
            value={form.password}
            onChange={(e) => setF({ password: e.currentTarget.value })}
          />
          <Select
            label="Função"
            value={form.role}
            onChange={(v) => setF({ role: v ?? "operator" })}
            data={isSuperAdmin ? ROLES_SUPER : ROLES}
            disabled={editing?.id === me?.id}
          />
          {roleOptions.length > 0 && editing?.id !== me?.id && (
            <Select
              label="Perfil de acesso personalizado"
              description="Sobrescreve as permissões padrão da função"
              placeholder="Nenhum (usa permissões da função)"
              clearable
              value={form.customRoleId || null}
              onChange={(v) => setF({ customRoleId: v ?? "" })}
              data={roleOptions}
            />
          )}
          {editing?.id === me?.id && (
            <Alert icon={<IconShieldLock size={15} />} color="blue" radius="md" variant="light">
              Você não pode alterar o próprio perfil.
            </Alert>
          )}
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              loading={updateMutation.isPending}
              disabled={!form.name || !form.email}
              leftSection={<IconCheck size={15} />}
              onClick={() => {
                if (!editing) return;
                const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role };
                if (form.password) body.password = form.password;
                if (editing.id !== me?.id) body.customRoleId = form.customRoleId || null;
                updateMutation.mutate({ id: editing.id, body: body as Partial<FormValues> });
              }}
            >
              Salvar alterações
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Modal: Confirmar exclusão ─────────────────────────────── */}
      <Modal
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        title={<Group gap="xs"><IconTrash size={18} color="var(--mantine-color-red-6)" /><Text fw={600} c="red">Excluir Usuário</Text></Group>}
        size="sm"
        radius="lg"
      >
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" radius="md">
            Esta ação é <strong>irreversível</strong>. O usuário <strong>{deleting?.name}</strong> e todos os seus dados serão permanentemente removidos.
          </Alert>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleting(null)} leftSection={<IconX size={14} />}>
              Cancelar
            </Button>
            <Button
              color="red"
              loading={deleteMutation.isPending}
              leftSection={<IconTrash size={14} />}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              Excluir definitivamente
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Group, Text, Title, Modal, TextInput, Textarea,
  Badge, ActionIcon, Stack, Checkbox, Paper, Divider, Loader, Center,
  SimpleGrid, Tooltip,
} from "@mantine/core";
import { IconPlus, IconEdit, IconTrash, IconShield } from "@tabler/icons-react";
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { api } from "@/lib/api";

interface CompanyRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isDefault: boolean;
  userCount: number;
  createdAt: string;
}

const emptyForm = { name: "", description: "", permissions: [] as string[], isDefault: false };

export default function RolesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyRole | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<CompanyRole | null>(null);

  const { data: roles = [], isLoading } = useQuery<CompanyRole[]>({
    queryKey: ["roles"],
    queryFn: () => api.get("/roles").then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data: typeof emptyForm) => api.post("/roles", data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof emptyForm }) =>
      api.patch(`/roles/${id}`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); setDeleteTarget(null); },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(role: CompanyRole) {
    setEditing(role);
    setForm({ name: role.name, description: role.description ?? "", permissions: [...role.permissions], isDefault: role.isDefault });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  function togglePermission(key: string) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
  }

  function selectAll() { setForm((f) => ({ ...f, permissions: [...ALL_PERMISSION_KEYS] })); }
  function clearAll() { setForm((f) => ({ ...f, permissions: [] })); }

  function submit() {
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Box p="xl" maw={1000}>
      <Group justify="space-between" mb="xl">
        <Box>
          <Title order={2} fw={700}>Perfis de Acesso</Title>
          <Text c="dimmed" size="sm" mt={4}>Crie perfis personalizados para controlar o que cada usuário pode acessar</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Novo Perfil
        </Button>
      </Group>

      {isLoading ? (
        <Center h={200}><Loader /></Center>
      ) : roles.length === 0 ? (
        <Paper p="xl" ta="center" radius="md" style={{ border: "1px dashed #374151" }}>
          <IconShield size={40} color="#6b7280" />
          <Text c="dimmed" mt="sm">Nenhum perfil cadastrado ainda</Text>
          <Button mt="md" variant="light" onClick={openCreate}>Criar primeiro perfil</Button>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {roles.map((role) => (
            <Paper key={role.id} p="md" radius="md" style={{ border: "1px solid #1e293b" }}>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Text fw={600}>{role.name}</Text>
                  {role.isDefault && <Badge size="xs" variant="light" color="blue">Padrão</Badge>}
                </Group>
                <Group gap={4}>
                  <Tooltip label="Editar">
                    <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(role)}>
                      <IconEdit size={15} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Excluir">
                    <ActionIcon variant="subtle" color="red" onClick={() => setDeleteTarget(role)}>
                      <IconTrash size={15} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
              {role.description && (
                <Text size="xs" c="dimmed" mb="xs">{role.description}</Text>
              )}
              <Group gap={4} wrap="wrap">
                {role.permissions.length === 0 ? (
                  <Text size="xs" c="dimmed">Sem permissões definidas</Text>
                ) : (
                  role.permissions.slice(0, 6).map((p) => (
                    <Badge key={p} size="xs" variant="dot" color="gray">{p}</Badge>
                  ))
                )}
                {role.permissions.length > 6 && (
                  <Badge size="xs" variant="dot" color="gray">+{role.permissions.length - 6}</Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" mt="xs">
                {role.userCount === 1 ? "1 usuário" : `${role.userCount} usuários`} com este perfil
              </Text>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      {/* Create / Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={editing ? "Editar Perfil" : "Novo Perfil de Acesso"}
        size="lg"
        styles={{ body: { paddingBottom: 24 } }}
      >
        <Stack gap="sm">
          <TextInput
            label="Nome do perfil"
            placeholder="Ex: Atendente, Supervisor..."
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Textarea
            label="Descrição"
            placeholder="Descreva o nível de acesso deste perfil..."
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Checkbox
            label="Definir como perfil padrão para novos usuários"
            checked={form.isDefault}
            onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
          />

          <Divider label="Permissões" labelPosition="left" mt="xs" />

          <Group gap="xs" mb="xs">
            <Button size="xs" variant="light" onClick={selectAll}>Marcar todos</Button>
            <Button size="xs" variant="subtle" color="gray" onClick={clearAll}>Desmarcar todos</Button>
          </Group>

          {PERMISSION_GROUPS.map(({ group, permissions }) => (
            <Box key={group}>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={6}>{group}</Text>
              <Stack gap={4}>
                {permissions.map(({ key, label }) => (
                  <Checkbox
                    key={key}
                    size="sm"
                    label={label}
                    checked={form.permissions.includes(key)}
                    onChange={() => togglePermission(key)}
                  />
                ))}
              </Stack>
            </Box>
          ))}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={closeModal}>Cancelar</Button>
            <Button
              onClick={submit}
              loading={isPending}
              disabled={!form.name.trim()}
            >
              {editing ? "Salvar" : "Criar Perfil"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete confirm */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir perfil"
        size="sm"
      >
        <Text size="sm" mb="lg">
          Tem certeza que deseja excluir o perfil <strong>{deleteTarget?.name}</strong>?
          {(deleteTarget?.userCount ?? 0) > 0 && (
            <Text size="sm" c="orange" mt="xs">
              Atenção: {deleteTarget?.userCount} usuário(s) perderão este perfil e voltarão às permissões padrão da função.
            </Text>
          )}
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button
            color="red"
            loading={deleteMut.isPending}
            onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
          >
            Excluir
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}

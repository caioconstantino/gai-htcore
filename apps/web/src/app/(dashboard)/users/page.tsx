"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge,
  Skeleton, Modal, TextInput, Select, PasswordInput, Switch,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconUsers, IconPlus, IconSearch } from "@tabler/icons-react";

interface User {
  id: string; name: string; email: string; role: string;
  isActive: boolean; lastLoginAt: string | null; tokensUsed: number;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin", company_admin: "Admin",
  manager: "Gerente", commercial: "Comercial", operator: "Operador",
};
const roleColors: Record<string, string> = {
  super_admin: "red", company_admin: "blue", manager: "violet",
  commercial: "green", operator: "gray",
};

export default function UsersPage() {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "operator", companyId: "" });

  const { data, isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post("/users", body).then((r) => r.data),
    onSuccess: () => {
      notifications.show({ title: "Usuário criado", message: "Usuário cadastrado com sucesso!", color: "green" });
      qc.invalidateQueries({ queryKey: ["users"] });
      close();
      setForm({ name: "", email: "", password: "", role: "operator", companyId: "" });
    },
    onError: () => notifications.show({ title: "Erro", message: "Não foi possível criar o usuário.", color: "red" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/users/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const users = data ?? [];
  const filtered = users.filter(
    (u) => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Stack gap="lg" maw={1000}>
        <Group justify="space-between" align="flex-end">
          <Box>
            <Title order={2} fw={700}>Usuários</Title>
            <Text c="dimmed" size="sm" mt={4}>{users.length} usuários cadastrados</Text>
          </Box>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Novo Usuário</Button>
        </Group>

        <TextInput
          placeholder="Buscar por nome ou email..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 360 }}
        />

        {isLoading ? (
          <Stack gap="sm">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={64} radius="lg" />)}
          </Stack>
        ) : filtered.length === 0 ? (
          <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
            <Stack align="center" py="xl" gap="sm">
              <IconUsers size={48} color="var(--mantine-color-gray-3)" />
              <Text c="dimmed">{search ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}</Text>
            </Stack>
          </Card>
        ) : (
          <Card padding={0} radius="lg" withBorder shadow="sm">
            {filtered.map((u, i) => (
              <Box
                key={u.id}
                px="lg" py="md"
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mantine-color-gray-0)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Box
                  style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "var(--mantine-color-blue-1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, color: "var(--mantine-color-blue-7)", fontSize: 15,
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
                  <Text size="xs" c="dimmed" style={{ minWidth: 120 }}>
                    {u.lastLoginAt
                      ? `Último: ${new Date(u.lastLoginAt).toLocaleDateString("pt-BR")}`
                      : "Nunca acessou"}
                  </Text>
                  <Switch
                    checked={u.isActive}
                    size="sm"
                    onChange={(e) => toggleMutation.mutate({ id: u.id, isActive: e.currentTarget.checked })}
                  />
                </Group>
              </Box>
            ))}
          </Card>
        )}
      </Stack>

      <Modal opened={opened} onClose={close} title={<Text fw={600}>Novo Usuário</Text>} size="md" radius="lg">
        <Stack gap="md">
          <TextInput label="Nome" placeholder="Nome completo" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <TextInput label="Email" type="email" placeholder="email@empresa.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          <PasswordInput label="Senha" placeholder="Mínimo 6 caracteres" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
          <Select
            label="Perfil"
            value={form.role}
            onChange={(v) => setForm((f) => ({ ...f, role: v ?? "operator" }))}
            data={[
              { value: "super_admin", label: "Super Admin" },
              { value: "company_admin", label: "Admin da Empresa" },
              { value: "manager", label: "Gerente" },
              { value: "commercial", label: "Comercial" },
              { value: "operator", label: "Operador" },
            ]}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={close}>Cancelar</Button>
            <Button
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || !form.email || !form.password}
            >
              Criar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

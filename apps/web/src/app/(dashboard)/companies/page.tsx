"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, SimpleGrid,
  Skeleton, ThemeIcon, Progress, Modal, TextInput, Select, NumberInput,
  ActionIcon, Menu, Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBuilding, IconPlus, IconBolt, IconDots,
  IconPencil, IconPower, IconChevronRight, IconUsers, IconRobot,
} from "@tabler/icons-react";
import Link from "next/link";

interface Company {
  id: string; name: string; slug: string; plan: string;
  isActive: boolean; tokensUsed: number; tokenLimit: number;
  createdAt: string;
  _count: { users: number; leads: number; conversations: number; agents: number };
}

const planColors: Record<string, string> = {
  trial: "gray", basic: "blue", pro: "violet", enterprise: "orange",
};

export default function CompaniesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState({ name: "", slug: "", plan: "trial", tokenLimit: 1000000, userLimit: 10 });

  useEffect(() => {
    if (user && user.role !== "super_admin") router.push("/dashboard");
  }, [user, router]);

  const { data, isLoading } = useQuery<{ data: Company[]; total: number }>({
    queryKey: ["companies"],
    queryFn: () => api.get("/companies").then((r) => r.data),
    enabled: user?.role === "super_admin",
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post("/companies", body).then((r) => r.data),
    onSuccess: () => {
      notifications.show({ title: "Empresa criada", message: "Empresa cadastrada com sucesso!", color: "green" });
      qc.invalidateQueries({ queryKey: ["companies"] });
      close();
      setForm({ name: "", slug: "", plan: "trial", tokenLimit: 1000000, userLimit: 10 });
    },
    onError: () => notifications.show({ title: "Erro", message: "Não foi possível criar a empresa.", color: "red" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/companies/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => {
      notifications.show({ title: "Atualizado", message: "Status da empresa alterado.", color: "blue" });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  const companies = data?.data ?? [];

  function handleSlugFromName(name: string) {
    const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setForm((f) => ({ ...f, name, slug }));
  }

  return (
    <>
      <Stack gap="lg" maw={1280}>
        <Group justify="space-between" align="flex-end">
          <Box>
            <Title order={2} fw={700}>Empresas</Title>
            <Text c="dimmed" size="sm" mt={4}>
              {data?.total ?? 0} empresas · {companies.filter((c) => c.isActive).length} ativas
            </Text>
          </Box>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Nova Empresa</Button>
        </Group>

        {isLoading ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={220} radius="lg" />)}
          </SimpleGrid>
        ) : companies.length === 0 ? (
          <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
            <Stack align="center" py="xl" gap="sm">
              <IconBuilding size={48} color="var(--mantine-color-gray-3)" />
              <Text fw={500} c="dimmed">Nenhuma empresa cadastrada</Text>
              <Button variant="light" leftSection={<IconPlus size={16} />} onClick={open}>
                Criar primeira empresa
              </Button>
            </Stack>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {companies.map((company) => {
              const pct = Math.round((company.tokensUsed / company.tokenLimit) * 100);
              return (
                <Card key={company.id} padding="lg" radius="lg" withBorder shadow="sm" style={{ position: "relative" }}>
                  <Group justify="space-between" mb="md" align="flex-start">
                    <Group gap="sm">
                      <ThemeIcon size={40} radius="md" color={company.isActive ? "blue" : "gray"} variant="light">
                        <IconBuilding size={20} />
                      </ThemeIcon>
                      <Box>
                        <Text fw={600} size="sm" lh={1.3}>{company.name}</Text>
                        <Text size="xs" c="dimmed">/{company.slug}</Text>
                      </Box>
                    </Group>
                    <Menu shadow="md" width={180}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" size="sm">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          component={Link}
                          href={`/companies/${company.id}`}
                          leftSection={<IconPencil size={14} />}
                        >
                          Gerenciar
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color={company.isActive ? "red" : "green"}
                          leftSection={<IconPower size={14} />}
                          onClick={() => toggleMutation.mutate({ id: company.id, isActive: !company.isActive })}
                        >
                          {company.isActive ? "Desativar" : "Ativar"}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>

                  <Group gap="xs" mb="md">
                    <Badge color={planColors[company.plan] ?? "gray"} variant="light" size="sm">
                      {company.plan}
                    </Badge>
                    <Badge color={company.isActive ? "green" : "red"} variant="dot" size="sm">
                      {company.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </Group>

                  {/* Stats */}
                  <SimpleGrid cols={4} mb="md">
                    {[
                      { label: "Usuários", val: company._count.users },
                      { label: "Leads", val: company._count.leads },
                      { label: "Conversas", val: company._count.conversations },
                      { label: "Agentes", val: company._count.agents },
                    ].map(({ label, val }) => (
                      <Box key={label} ta="center" p={6} style={{ background: "var(--mantine-color-gray-0)", borderRadius: 8 }}>
                        <Text size="lg" fw={700} lh={1}>{val}</Text>
                        <Text size="xs" c="dimmed">{label}</Text>
                      </Box>
                    ))}
                  </SimpleGrid>

                  {/* Token bar */}
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Group gap={4}>
                        <IconBolt size={12} color="var(--mantine-color-yellow-6)" />
                        <Text size="xs" c="dimmed">Tokens</Text>
                      </Group>
                      <Text size="xs" fw={500} c={pct > 80 ? "red" : "dimmed"}>{pct}%</Text>
                    </Group>
                    <Progress value={pct} color={pct > 80 ? "red" : pct > 60 ? "yellow" : "blue"} size="sm" radius="xl" />
                  </Stack>

                  <Button
                    component={Link}
                    href={`/companies/${company.id}`}
                    variant="subtle"
                    size="xs"
                    rightSection={<IconChevronRight size={14} />}
                    mt="md"
                    fullWidth
                  >
                    Gerenciar empresa
                  </Button>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>

      {/* Modal criar empresa */}
      <Modal opened={opened} onClose={close} title={<Text fw={600}>Nova Empresa</Text>} size="md" radius="lg">
        <Stack gap="md">
          <TextInput
            label="Nome da empresa"
            placeholder="Locadora ABC"
            value={form.name}
            onChange={(e) => handleSlugFromName(e.target.value)}
            required
          />
          <TextInput
            label="Slug (identificador único)"
            placeholder="locadora-abc"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            description="Letras minúsculas, números e hífens"
            required
          />
          <Select
            label="Plano"
            value={form.plan}
            onChange={(v) => setForm((f) => ({ ...f, plan: v ?? "trial" }))}
            data={[
              { value: "trial", label: "Trial (gratuito)" },
              { value: "basic", label: "Basic" },
              { value: "pro", label: "Pro" },
              { value: "enterprise", label: "Enterprise" },
            ]}
          />
          <Group grow>
            <NumberInput
              label="Limite de tokens"
              value={form.tokenLimit}
              onChange={(v) => setForm((f) => ({ ...f, tokenLimit: Number(v) }))}
              min={10000}
              step={100000}
              thousandSeparator=","
              decimalSeparator="."
            />
            <NumberInput
              label="Limite de usuários"
              value={form.userLimit}
              onChange={(v) => setForm((f) => ({ ...f, userLimit: Number(v) }))}
              min={1}
              max={100}
            />
          </Group>
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={close}>Cancelar</Button>
            <Button
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || !form.slug}
            >
              Criar Empresa
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

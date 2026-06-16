"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, Skeleton, Tabs,
  Modal, TextInput, Textarea, NumberInput, Select, Table, ActionIcon, Tooltip,
  Divider,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconPackage, IconPlus, IconCheck, IconX, IconAlertCircle, IconShoppingCart,
  IconPencil,
} from "@tabler/icons-react";

interface GlobalProduct {
  id: string; name: string; category: string; description: string | null;
  dailyPrice: string; weeklyPrice: string | null; monthlyPrice: string | null;
  selectedByCompany?: boolean; companyProductActive?: boolean;
}

interface MyProduct extends GlobalProduct {
  companyDailyPrice: string | null;
  companyWeeklyPrice: string | null;
  companyMonthlyPrice: string | null;
}

const categoryOptions = [
  "Máquinas de Terraplanagem", "Equipamentos de Elevação", "Compactadores", "Geradores",
  "Ferramentas", "Plataformas", "Compressores", "Iluminação", "Outros",
];

function fmt(v: string | null | undefined) {
  if (!v) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

// ── Modal de seleção com preços próprios ──────────────────────────
function SelectProductModal({
  product,
  existingPrices,
  onClose,
}: {
  product: GlobalProduct;
  existingPrices?: { daily: string | null; weekly: string | null; monthly: string | null };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!existingPrices;

  const form = useForm({
    initialValues: {
      dailyPrice: existingPrices?.daily ? Number(existingPrices.daily) : null as number | null,
      weeklyPrice: existingPrices?.weekly ? Number(existingPrices.weekly) : null as number | null,
      monthlyPrice: existingPrices?.monthly ? Number(existingPrices.monthly) : null as number | null,
    },
  });

  const mutation = useMutation({
    mutationFn: (v: typeof form.values) =>
      isEdit
        ? api.patch(`/global-products/select/${product.id}`, v).then((r) => r.data)
        : api.post(`/global-products/select/${product.id}`, v).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-products"] });
      qc.invalidateQueries({ queryKey: ["my-products"] });
      notifications.show({
        message: isEdit ? "Preços atualizados!" : `"${product.name}" adicionado aos seus produtos!`,
        color: "green",
      });
      onClose();
    },
    onError: () => notifications.show({ message: "Erro ao salvar produto", color: "red" }),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={isEdit ? `Editar preços — ${product.name}` : `Adicionar ${product.name}`}
      size="md"
      radius="lg"
    >
      <Stack gap="md">
        <Card padding="sm" radius="md" bg="var(--mantine-color-gray-0)" withBorder={false}>
          <Text size="xs" c="dimmed" fw={500} mb={4}>Preços de referência do catálogo global</Text>
          <Group gap="xl">
            <Box><Text size="xs" c="dimmed">Diária</Text><Text size="sm" fw={600}>{fmt(product.dailyPrice)}</Text></Box>
            {product.weeklyPrice && <Box><Text size="xs" c="dimmed">Semanal</Text><Text size="sm" fw={600}>{fmt(product.weeklyPrice)}</Text></Box>}
            {product.monthlyPrice && <Box><Text size="xs" c="dimmed">Mensal</Text><Text size="sm" fw={600}>{fmt(product.monthlyPrice)}</Text></Box>}
          </Group>
        </Card>

        <Divider label="Informe os preços que sua empresa pratica" labelPosition="center" />

        <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
          <Stack gap="md">
            <NumberInput
              label="Diária (R$)"
              description="Obrigatório"
              prefix="R$ "
              decimalSeparator=","
              thousandSeparator="."
              decimalScale={2}
              min={0}
              required
              {...form.getInputProps("dailyPrice")}
            />
            <Group grow>
              <NumberInput
                label="Semanal (R$)"
                description="Opcional"
                prefix="R$ "
                decimalSeparator=","
                thousandSeparator="."
                decimalScale={2}
                min={0}
                {...form.getInputProps("weeklyPrice")}
              />
              <NumberInput
                label="Mensal (R$)"
                description="Opcional"
                prefix="R$ "
                decimalSeparator=","
                thousandSeparator="."
                decimalScale={2}
                min={0}
                {...form.getInputProps("monthlyPrice")}
              />
            </Group>
            <Group justify="flex-end" mt="xs">
              <Button variant="subtle" onClick={onClose}>Cancelar</Button>
              <Button type="submit" leftSection={<IconCheck size={16} />} loading={mutation.isPending}>
                {isEdit ? "Salvar preços" : "Adicionar produto"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Modal>
  );
}

// ── Modal de sugestão ─────────────────────────────────────────────
function SuggestModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const form = useForm({
    initialValues: {
      name: "", category: "Outros", description: "",
      dailyPrice: 0, weeklyPrice: null as number | null, monthlyPrice: null as number | null,
    },
  });

  const mutation = useMutation({
    mutationFn: (v: typeof form.values) => api.post("/global-products/suggestions", v).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-suggestions"] });
      notifications.show({ message: "Sugestão enviada! Aguarde aprovação do administrador.", color: "green" });
      onClose(); form.reset();
    },
    onError: () => notifications.show({ message: "Erro ao enviar sugestão", color: "red" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Sugerir novo produto" size="lg" radius="lg">
      <Text size="sm" c="dimmed" mb="md">
        Se um produto que você trabalha não estiver no catálogo, sugira-o. O administrador vai revisar e aprovar.
      </Text>
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack gap="md">
          <Group grow>
            <TextInput label="Nome do produto" required {...form.getInputProps("name")} />
            <Select label="Categoria" data={categoryOptions} required {...form.getInputProps("category")} />
          </Group>
          <Textarea label="Descrição" minRows={2} {...form.getInputProps("description")} />
          <Group grow>
            <NumberInput label="Diária (R$)" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} required {...form.getInputProps("dailyPrice")} />
            <NumberInput label="Semanal (R$)" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} {...form.getInputProps("weeklyPrice")} />
            <NumberInput label="Mensal (R$)" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} {...form.getInputProps("monthlyPrice")} />
          </Group>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending} leftSection={<IconAlertCircle size={16} />}>Enviar sugestão</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────
export default function ProductsPage() {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [selecting, setSelecting] = useState<GlobalProduct | null>(null);
  const [editing, setEditing] = useState<MyProduct | null>(null);
  const qc = useQueryClient();

  const { data: catalogData, isLoading: loadingCatalog } = useQuery<{ data: GlobalProduct[] }>({
    queryKey: ["global-products"],
    queryFn: () => api.get("/global-products").then((r) => r.data),
  });

  const { data: myProductsData, isLoading: loadingMy } = useQuery<{ data: MyProduct[] }>({
    queryKey: ["my-products"],
    queryFn: () => api.get("/global-products/my-products").then((r) => r.data),
  });

  const { data: suggestionsData } = useQuery<{ data: { id: string; name: string; status: string; createdAt: string }[] }>({
    queryKey: ["my-suggestions"],
    queryFn: () => api.get("/global-products/suggestions").then((r) => r.data),
  });

  const deselectMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/global-products/select/${productId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-products"] });
      qc.invalidateQueries({ queryKey: ["my-products"] });
      notifications.show({ message: "Produto removido", color: "orange" });
    },
    onError: () => notifications.show({ message: "Erro ao remover produto", color: "red" }),
  });

  const catalog = catalogData?.data ?? [];
  const myProducts = myProductsData?.data ?? [];
  const suggestions = suggestionsData?.data ?? [];
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");

  return (
    <Stack gap="lg" maw={1200}>
      {/* Modals */}
      {selecting && (
        <SelectProductModal product={selecting} onClose={() => setSelecting(null)} />
      )}
      {editing && (
        <SelectProductModal
          product={editing}
          existingPrices={{
            daily: editing.companyDailyPrice,
            weekly: editing.companyWeeklyPrice,
            monthly: editing.companyMonthlyPrice,
          }}
          onClose={() => setEditing(null)}
        />
      )}

      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Produtos</Title>
          <Text c="dimmed" size="sm" mt={4}>
            Selecione os produtos do catálogo e informe seus preços de locação
          </Text>
        </Box>
        <Button variant="light" leftSection={<IconAlertCircle size={16} />} onClick={() => setSuggestOpen(true)}>
          Sugerir produto
        </Button>
      </Group>

      <SuggestModal opened={suggestOpen} onClose={() => setSuggestOpen(false)} />

      <Tabs defaultValue="catalog">
        <Tabs.List mb="md">
          <Tabs.Tab value="catalog" leftSection={<IconPackage size={16} />}>
            Catálogo Global ({catalog.length})
          </Tabs.Tab>
          <Tabs.Tab value="mine" leftSection={<IconShoppingCart size={16} />}>
            Meus Produtos ({myProducts.length})
          </Tabs.Tab>
          <Tabs.Tab value="suggestions" leftSection={<IconAlertCircle size={16} />}>
            Minhas Sugestões
            {pendingSuggestions.length > 0 && (
              <Badge size="xs" color="orange" ml={6}>{pendingSuggestions.length}</Badge>
            )}
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Catálogo global ── */}
        <Tabs.Panel value="catalog">
          {loadingCatalog ? (
            <Stack gap="sm">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={52} radius="lg" />)}</Stack>
          ) : catalog.length === 0 ? (
            <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
              <Stack align="center" py="xl" gap="sm">
                <IconPackage size={40} color="var(--mantine-color-gray-3)" />
                <Text c="dimmed">Catálogo ainda vazio</Text>
                <Button variant="light" size="sm" leftSection={<IconPlus size={14} />} onClick={() => setSuggestOpen(true)}>Sugerir produto</Button>
              </Stack>
            </Card>
          ) : (
            <Card padding={0} radius="lg" withBorder shadow="sm">
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Produto</Table.Th>
                    <Table.Th>Categoria</Table.Th>
                    <Table.Th ta="right">Ref. Diária</Table.Th>
                    <Table.Th ta="right">Ref. Semanal</Table.Th>
                    <Table.Th ta="right">Ref. Mensal</Table.Th>
                    <Table.Th w={120} ta="center">Ação</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {catalog.map((p) => (
                    <Table.Tr key={p.id} bg={p.companyProductActive ? "var(--mantine-color-green-0)" : undefined}>
                      <Table.Td>
                        <Group gap="xs">
                          <Text size="sm" fw={500}>{p.name}</Text>
                          {p.companyProductActive && (
                            <Badge size="xs" color="green" variant="light">Selecionado</Badge>
                          )}
                        </Group>
                        {p.description && <Text size="xs" c="dimmed" lineClamp={1}>{p.description}</Text>}
                      </Table.Td>
                      <Table.Td><Badge variant="outline" color="gray" size="xs">{p.category}</Badge></Table.Td>
                      <Table.Td ta="right"><Text size="sm" c="dimmed">{fmt(p.dailyPrice)}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" c="dimmed">{fmt(p.weeklyPrice)}</Text></Table.Td>
                      <Table.Td ta="right"><Text size="sm" c="dimmed">{fmt(p.monthlyPrice)}</Text></Table.Td>
                      <Table.Td ta="center">
                        {p.companyProductActive ? (
                          <Tooltip label="Remover dos meus produtos" withArrow>
                            <ActionIcon color="red" variant="subtle" size="sm"
                              onClick={() => deselectMutation.mutate(p.id)}
                              loading={deselectMutation.isPending}>
                              <IconX size={14} />
                            </ActionIcon>
                          </Tooltip>
                        ) : (
                          <Tooltip label="Adicionar e informar meu preço" withArrow>
                            <ActionIcon color="blue" variant="light" size="sm" onClick={() => setSelecting(p)}>
                              <IconPlus size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}
        </Tabs.Panel>

        {/* ── Meus produtos (com preços da empresa) ── */}
        <Tabs.Panel value="mine">
          {loadingMy ? (
            <Stack gap="sm">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={52} radius="lg" />)}</Stack>
          ) : myProducts.length === 0 ? (
            <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
              <Stack align="center" py="xl" gap="sm">
                <IconShoppingCart size={40} color="var(--mantine-color-gray-3)" />
                <Text c="dimmed">Nenhum produto selecionado</Text>
                <Text size="sm" c="dimmed">Vá no "Catálogo Global" e clique em + para adicionar produtos com seus preços</Text>
              </Stack>
            </Card>
          ) : (
            <Card padding={0} radius="lg" withBorder shadow="sm">
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Produto</Table.Th>
                    <Table.Th>Categoria</Table.Th>
                    <Table.Th ta="right">Minha Diária</Table.Th>
                    <Table.Th ta="right">Minha Semanal</Table.Th>
                    <Table.Th ta="right">Minha Mensal</Table.Th>
                    <Table.Th w={100} ta="center">Ações</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {myProducts.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{p.name}</Text>
                        {p.description && <Text size="xs" c="dimmed" lineClamp={1}>{p.description}</Text>}
                      </Table.Td>
                      <Table.Td><Badge variant="outline" color="gray" size="xs">{p.category}</Badge></Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" fw={600} c={p.companyDailyPrice ? "green" : "dimmed"}>
                          {fmt(p.companyDailyPrice)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c={p.companyWeeklyPrice ? "green" : "dimmed"}>
                          {fmt(p.companyWeeklyPrice)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c={p.companyMonthlyPrice ? "green" : "dimmed"}>
                          {fmt(p.companyMonthlyPrice)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="center">
                        <Group gap={4} justify="center">
                          <Tooltip label="Editar preços" withArrow>
                            <ActionIcon color="blue" variant="subtle" size="sm" onClick={() => setEditing(p)}>
                              <IconPencil size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Remover" withArrow>
                            <ActionIcon color="red" variant="subtle" size="sm"
                              onClick={() => deselectMutation.mutate(p.id)}
                              loading={deselectMutation.isPending}>
                              <IconX size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}
        </Tabs.Panel>

        {/* ── Sugestões enviadas ── */}
        <Tabs.Panel value="suggestions">
          {suggestions.length === 0 ? (
            <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
              <Stack align="center" py="xl" gap="sm">
                <IconAlertCircle size={40} color="var(--mantine-color-gray-3)" />
                <Text c="dimmed">Nenhuma sugestão enviada</Text>
                <Button variant="light" size="sm" leftSection={<IconPlus size={14} />} onClick={() => setSuggestOpen(true)}>Sugerir produto</Button>
              </Stack>
            </Card>
          ) : (
            <Stack gap="sm">
              {suggestions.map((s) => (
                <Card key={s.id} padding="md" radius="lg" withBorder shadow="sm">
                  <Group justify="space-between">
                    <Box>
                      <Text fw={600} size="sm">{s.name}</Text>
                      <Text size="xs" c="dimmed">Enviado em {new Date(s.createdAt).toLocaleDateString("pt-BR")}</Text>
                    </Box>
                    <Badge
                      color={s.status === "approved" ? "green" : s.status === "rejected" ? "red" : "orange"}
                      variant="light"
                    >
                      {s.status === "approved" ? "Aprovado" : s.status === "rejected" ? "Rejeitado" : "Aguardando revisão"}
                    </Badge>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

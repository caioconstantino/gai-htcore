"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, Skeleton, Tabs,
  Modal, TextInput, Textarea, ActionIcon, Menu, NumberInput,
  Select, Table, Divider, Switch,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconBook2, IconPlus, IconPackage, IconDots, IconPencil, IconTrash,
  IconCheck, IconX, IconAlertCircle, IconSearch,
} from "@tabler/icons-react";

interface GlobalProduct {
  id: string; name: string; category: string; description: string | null;
  dailyPrice: string; weeklyPrice: string | null; monthlyPrice: string | null;
  isMostSold: boolean; isHighRevenue: boolean; isActive: boolean;
}
interface ProductSuggestion {
  id: string; name: string; category: string; description: string | null;
  dailyPrice: string; weeklyPrice: string | null; monthlyPrice: string | null;
  status: string; reviewNote: string | null;
  company: { id: string; name: string; slug: string };
  createdAt: string;
}

const categoryOptions = [
  "Máquinas de Terraplanagem", "Equipamentos de Elevação", "Compactadores", "Geradores",
  "Ferramentas", "Plataformas", "Compressores", "Iluminação", "Outros",
];

function fmt(v: string | null) {
  if (!v) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

function ProductModal({ opened, onClose, product }: { opened: boolean; onClose: () => void; product?: GlobalProduct }) {
  const qc = useQueryClient();
  const isEdit = !!product;
  const form = useForm({
    initialValues: {
      name: product?.name ?? "",
      category: product?.category ?? "Outros",
      description: product?.description ?? "",
      dailyPrice: product ? Number(product.dailyPrice) : 0,
      weeklyPrice: product?.weeklyPrice ? Number(product.weeklyPrice) : null as number | null,
      monthlyPrice: product?.monthlyPrice ? Number(product.monthlyPrice) : null as number | null,
      isMostSold: product?.isMostSold ?? false,
      isHighRevenue: product?.isHighRevenue ?? false,
    },
  });

  const mutation = useMutation({
    mutationFn: (v: typeof form.values) =>
      isEdit
        ? api.patch(`/global-products/${product!.id}`, v).then((r) => r.data)
        : api.post("/global-products", v).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-products"] });
      notifications.show({ message: isEdit ? "Produto atualizado!" : "Produto criado no catálogo!", color: "green" });
      onClose(); form.reset();
    },
    onError: () => notifications.show({ message: "Erro ao salvar produto", color: "red" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title={isEdit ? "Editar Produto Global" : "Novo Produto no Catálogo"} size="lg" radius="lg">
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack gap="md">
          <Group grow>
            <TextInput label="Nome" required {...form.getInputProps("name")} />
            <Select label="Categoria" data={categoryOptions} required {...form.getInputProps("category")} />
          </Group>
          <Textarea label="Descrição" minRows={3} placeholder="Descreva o produto, usos, especificações..." {...form.getInputProps("description")} />

          <Divider label="Preços de referência (base para as empresas)" labelPosition="center" />
          <Text size="xs" c="dimmed">Estes são preços de referência do mercado. Cada empresa informa seus próprios preços ao selecionar o produto.</Text>

          <Group grow>
            <NumberInput label="Diária (R$)" description="Obrigatório" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} required {...form.getInputProps("dailyPrice")} />
            <NumberInput label="Semanal (R$)" description="Opcional" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} {...form.getInputProps("weeklyPrice")} />
            <NumberInput label="Mensal (R$)" description="Opcional" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} {...form.getInputProps("monthlyPrice")} />
          </Group>

          <Divider label="Classificações" labelPosition="center" />
          <Group>
            <Switch label="Mais alugado" description="Aparece em destaque nas sugestões da IA" {...form.getInputProps("isMostSold", { type: "checkbox" })} />
            <Switch label="Alta receita" description="Produto de ticket alto" {...form.getInputProps("isHighRevenue", { type: "checkbox" })} />
          </Group>

          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? "Salvar" : "Criar"}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default function KnowledgeBasePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GlobalProduct | undefined>();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: productsData, isLoading: loadingProducts } = useQuery<{ data: GlobalProduct[] }>({
    queryKey: ["global-products"],
    queryFn: () => api.get("/global-products").then((r) => r.data),
  });

  const { data: suggestionsData, isLoading: loadingSuggestions } = useQuery<{ data: ProductSuggestion[] }>({
    queryKey: ["product-suggestions"],
    queryFn: () => api.get("/global-products/suggestions").then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/global-products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["global-products"] }); notifications.show({ message: "Produto removido do catálogo", color: "orange" }); },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      api.patch(`/global-products/suggestions/${id}/review`, { status, reviewNote }).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["product-suggestions"] });
      qc.invalidateQueries({ queryKey: ["global-products"] });
      notifications.show({
        message: vars.status === "approved" ? "Produto aprovado e adicionado ao catálogo!" : "Sugestão rejeitada",
        color: vars.status === "approved" ? "green" : "orange",
      });
      setReviewId(null); setReviewNote("");
    },
  });

  const allProducts = productsData?.data ?? [];
  const suggestions = suggestionsData?.data ?? [];
  const pending = suggestions.filter((s) => s.status === "pending");

  const products = allProducts.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const categories = Array.from(new Set(allProducts.map((p) => p.category))).sort();

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Biblioteca de Inteligência</Title>
          <Text c="dimmed" size="sm" mt={4}>Catálogo global de produtos — preços de referência para as empresas</Text>
        </Box>
      </Group>

      <ProductModal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        product={editing}
      />

      <Tabs defaultValue="catalog">
        <Tabs.List mb="md">
          <Tabs.Tab value="catalog" leftSection={<IconPackage size={16} />}>
            Catálogo Global ({allProducts.length})
          </Tabs.Tab>
          <Tabs.Tab value="suggestions" leftSection={<IconAlertCircle size={16} />}>
            Sugestões das Empresas
            {pending.length > 0 && <Badge size="xs" color="orange" ml={6}>{pending.length}</Badge>}
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Catálogo tab ── */}
        <Tabs.Panel value="catalog">
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="sm">
                <TextInput
                  placeholder="Buscar produto..."
                  leftSection={<IconSearch size={14} />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  w={220}
                  size="sm"
                />
                <Select
                  placeholder="Filtrar categoria"
                  data={categories}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  clearable
                  size="sm"
                  w={200}
                />
              </Group>
              <Button leftSection={<IconPlus size={16} />} size="sm" onClick={() => { setEditing(undefined); setModalOpen(true); }}>
                Novo produto
              </Button>
            </Group>

            {loadingProducts ? (
              <Stack gap="sm">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={52} radius="lg" />)}</Stack>
            ) : products.length === 0 ? (
              <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
                <Stack align="center" py="xl" gap="sm">
                  <IconBook2 size={40} color="var(--mantine-color-gray-3)" />
                  <Text c="dimmed">{search || categoryFilter ? "Nenhum produto encontrado" : "Catálogo vazio"}</Text>
                  {!search && !categoryFilter && (
                    <Button variant="light" size="sm" leftSection={<IconPlus size={14} />} onClick={() => { setEditing(undefined); setModalOpen(true); }}>Adicionar primeiro produto</Button>
                  )}
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
                      <Table.Th w={80}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {products.map((p) => (
                      <Table.Tr key={p.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <Text size="sm" fw={500}>{p.name}</Text>
                            {p.isMostSold && <Badge size="xs" color="blue" variant="light">+ alugado</Badge>}
                            {p.isHighRevenue && <Badge size="xs" color="orange" variant="light">alta receita</Badge>}
                          </Group>
                          {p.description && <Text size="xs" c="dimmed" lineClamp={1}>{p.description}</Text>}
                        </Table.Td>
                        <Table.Td><Badge variant="outline" color="gray" size="xs">{p.category}</Badge></Table.Td>
                        <Table.Td ta="right"><Text size="sm" fw={600}>{fmt(p.dailyPrice)}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm">{fmt(p.weeklyPrice)}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm">{fmt(p.monthlyPrice)}</Text></Table.Td>
                        <Table.Td>
                          <Menu withinPortal shadow="sm">
                            <Menu.Target><ActionIcon variant="subtle" color="gray" size="sm"><IconDots size={14} /></ActionIcon></Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => { setEditing(p); setModalOpen(true); }}>Editar</Menu.Item>
                              <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => deleteMutation.mutate(p.id)}>Remover</Menu.Item>
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
        </Tabs.Panel>

        {/* ── Sugestões tab ── */}
        <Tabs.Panel value="suggestions">
          {loadingSuggestions ? (
            <Stack gap="sm">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={100} radius="lg" />)}</Stack>
          ) : suggestions.length === 0 ? (
            <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
              <Stack align="center" py="xl" gap="sm">
                <IconCheck size={40} color="var(--mantine-color-green-4)" />
                <Text c="dimmed">Nenhuma sugestão pendente</Text>
              </Stack>
            </Card>
          ) : (
            <Stack gap="sm">
              {suggestions.map((s) => (
                <Card key={s.id} padding="md" radius="lg" withBorder shadow="sm">
                  <Group justify="space-between" mb="sm">
                    <Box>
                      <Group gap="xs">
                        <Text fw={600} size="sm">{s.name}</Text>
                        <Badge variant="outline" color="gray" size="xs">{s.category}</Badge>
                        <Badge
                          size="xs"
                          color={s.status === "approved" ? "green" : s.status === "rejected" ? "red" : "orange"}
                          variant="light"
                        >
                          {s.status === "approved" ? "Aprovado" : s.status === "rejected" ? "Rejeitado" : "Pendente"}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        Sugerido por <b>{s.company.name}</b> em {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                      </Text>
                    </Box>
                    <Box ta="right">
                      <Text size="xs" c="dimmed">Preço sugerido</Text>
                      <Text size="sm" fw={600}>{fmt(s.dailyPrice)}/dia</Text>
                    </Box>
                  </Group>

                  {s.description && <Text size="xs" c="dimmed" mb="sm">{s.description}</Text>}

                  <Group gap="xl" mb={s.status === "pending" ? "sm" : 0}>
                    {s.weeklyPrice && <Box><Text size="xs" c="dimmed">Semanal</Text><Text size="sm">{fmt(s.weeklyPrice)}</Text></Box>}
                    {s.monthlyPrice && <Box><Text size="xs" c="dimmed">Mensal</Text><Text size="sm">{fmt(s.monthlyPrice)}</Text></Box>}
                  </Group>

                  {s.status === "pending" && (
                    <>
                      {reviewId === s.id ? (
                        <Stack gap="xs" mt="sm">
                          <TextInput
                            size="xs"
                            placeholder="Nota de revisão (opcional — empresa verá esta mensagem)"
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                          />
                          <Group gap="xs">
                            <Button size="xs" color="green" leftSection={<IconCheck size={12} />}
                              loading={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ id: s.id, status: "approved" })}>
                              Aprovar e adicionar ao catálogo
                            </Button>
                            <Button size="xs" color="red" variant="light" leftSection={<IconX size={12} />}
                              loading={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ id: s.id, status: "rejected" })}>
                              Rejeitar
                            </Button>
                            <Button size="xs" variant="subtle" onClick={() => setReviewId(null)}>Cancelar</Button>
                          </Group>
                        </Stack>
                      ) : (
                        <Button size="xs" variant="light" mt="xs" onClick={() => setReviewId(s.id)}>
                          Revisar sugestão
                        </Button>
                      )}
                    </>
                  )}
                  {s.reviewNote && (
                    <Text size="xs" c="dimmed" mt="xs" fs="italic">Nota: {s.reviewNote}</Text>
                  )}
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, Skeleton, Tabs,
  ThemeIcon, Modal, TextInput, Textarea, ActionIcon, Menu, NumberInput,
  Select, Table, Divider,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconBook2, IconPlus, IconPackage, IconDots, IconPencil, IconTrash,
  IconCheck, IconX, IconAlertCircle,
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
          <Textarea label="Descrição" minRows={3} {...form.getInputProps("description")} />
          <Group grow>
            <NumberInput label="Diária (R$)" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} required {...form.getInputProps("dailyPrice")} />
            <NumberInput label="Semanal (R$)" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} {...form.getInputProps("weeklyPrice")} />
            <NumberInput label="Mensal (R$)" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} {...form.getInputProps("monthlyPrice")} />
          </Group>
          <Group justify="flex-end">
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
      notifications.show({ message: vars.status === "approved" ? "Sugestão aprovada e produto criado no catálogo!" : "Sugestão rejeitada", color: vars.status === "approved" ? "green" : "orange" });
      setReviewId(null); setReviewNote("");
    },
  });

  const products = productsData?.data ?? [];
  const suggestions = suggestionsData?.data ?? [];
  const pending = suggestions.filter((s) => s.status === "pending");

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Biblioteca de Inteligência</Title>
          <Text c="dimmed" size="sm" mt={4}>Catálogo global de produtos e gestão de sugestões</Text>
        </Box>
      </Group>

      <ProductModal opened={modalOpen} onClose={() => setModalOpen(false)} product={editing} />

      <Tabs defaultValue="catalog">
        <Tabs.List mb="md">
          <Tabs.Tab value="catalog" leftSection={<IconPackage size={16} />}>
            Catálogo Global ({products.length})
          </Tabs.Tab>
          <Tabs.Tab value="suggestions" leftSection={<IconAlertCircle size={16} />}>
            Sugestões Pendentes
            {pending.length > 0 && <Badge size="xs" color="orange" ml={6}>{pending.length}</Badge>}
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Catalog tab ── */}
        <Tabs.Panel value="catalog">
          <Stack gap="md">
            <Group justify="flex-end">
              <Button leftSection={<IconPlus size={16} />} size="sm" onClick={() => { setEditing(undefined); setModalOpen(true); }}>Adicionar produto</Button>
            </Group>
            {loadingProducts ? (
              <Stack gap="sm">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={52} radius="lg" />)}</Stack>
            ) : products.length === 0 ? (
              <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
                <Stack align="center" py="xl" gap="sm">
                  <IconBook2 size={40} color="var(--mantine-color-gray-3)" />
                  <Text c="dimmed">Catálogo vazio</Text>
                  <Button variant="light" size="sm" leftSection={<IconPlus size={14} />} onClick={() => { setEditing(undefined); setModalOpen(true); }}>Adicionar primeiro produto</Button>
                </Stack>
              </Card>
            ) : (
              <Card padding={0} radius="lg" withBorder shadow="sm">
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produto</Table.Th>
                      <Table.Th>Categoria</Table.Th>
                      <Table.Th ta="right">Diária</Table.Th>
                      <Table.Th ta="right">Semanal</Table.Th>
                      <Table.Th ta="right">Mensal</Table.Th>
                      <Table.Th w={80}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {products.map((p) => (
                      <Table.Tr key={p.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>{p.name}</Text>
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

        {/* ── Suggestions tab ── */}
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
                      <Text size="xs" c="dimmed">Sugerido por <b>{s.company.name}</b> em {new Date(s.createdAt).toLocaleDateString("pt-BR")}</Text>
                    </Box>
                    <Group gap="xs" ta="right">
                      <Box>
                        <Text size="xs" c="dimmed">Diária</Text>
                        <Text size="sm" fw={600}>{fmt(s.dailyPrice)}</Text>
                      </Box>
                    </Group>
                  </Group>
                  {s.description && <Text size="xs" c="dimmed" mb="sm">{s.description}</Text>}

                  {s.status === "pending" && (
                    <>
                      {reviewId === s.id ? (
                        <Stack gap="xs" mt="sm">
                          <TextInput size="xs" placeholder="Nota de revisão (opcional)" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
                          <Group gap="xs">
                            <Button size="xs" color="green" leftSection={<IconCheck size={12} />}
                              loading={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ id: s.id, status: "approved" })}>
                              Aprovar e criar no catálogo
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
                        <Button size="xs" variant="light" mt="xs" onClick={() => setReviewId(s.id)}>Revisar sugestão</Button>
                      )}
                    </>
                  )}
                  {s.reviewNote && <Text size="xs" c="dimmed" mt="xs">Nota: {s.reviewNote}</Text>}
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

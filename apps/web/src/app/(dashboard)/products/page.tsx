"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, SimpleGrid, Skeleton,
  ThemeIcon, Modal, TextInput, Textarea, Switch, ActionIcon, Menu, NumberInput, Select, Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconPackage, IconPlus, IconStar, IconTrendingUp, IconDots, IconPencil, IconTrash } from "@tabler/icons-react";

interface Product {
  id: string; name: string; category: string; description: string | null;
  dailyPrice: string; weeklyPrice: string | null; monthlyPrice: string | null;
  isActive: boolean; isMostSold: boolean; isHighRevenue: boolean;
}

const categoryOptions = [
  "Máquinas de Terraplanagem", "Equipamentos de Elevação", "Compactadores", "Geradores",
  "Ferramentas", "Plataformas", "Compressores", "Iluminação", "Outros",
];

function fmt(value: string | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function ProductModal({ opened, onClose, product }: { opened: boolean; onClose: () => void; product?: Product }) {
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
      isActive: product?.isActive ?? true,
      isMostSold: product?.isMostSold ?? false,
      isHighRevenue: product?.isHighRevenue ?? false,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      isEdit
        ? api.patch(`/products/${product!.id}`, values).then((r) => r.data)
        : api.post("/products", values).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      notifications.show({ message: isEdit ? "Produto atualizado!" : "Produto criado!", color: "green" });
      onClose(); form.reset();
    },
    onError: () => notifications.show({ message: "Erro ao salvar produto", color: "red" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title={isEdit ? "Editar Produto" : "Novo Produto"} size="lg" radius="lg">
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack gap="md">
          <Group grow>
            <TextInput label="Nome do equipamento" placeholder="Escavadeira Hidráulica" required {...form.getInputProps("name")} />
            <Select label="Categoria" data={categoryOptions} required {...form.getInputProps("category")} />
          </Group>
          <Textarea label="Descrição" placeholder="Detalhes técnicos, capacidade, aplicações..." minRows={3} {...form.getInputProps("description")} />
          <Text size="sm" fw={500}>Preços de locação</Text>
          <Group grow>
            <NumberInput label="Diária (R$)" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} required min={0} {...form.getInputProps("dailyPrice")} />
            <NumberInput label="Semanal (R$)" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} {...form.getInputProps("weeklyPrice")} />
            <NumberInput label="Mensal (R$)" prefix="R$ " decimalSeparator="," thousandSeparator="." decimalScale={2} min={0} {...form.getInputProps("monthlyPrice")} />
          </Group>
          <Group gap="xl">
            <Switch label="Produto ativo" {...form.getInputProps("isActive", { type: "checkbox" })} />
            <Switch label="Mais vendido" {...form.getInputProps("isMostSold", { type: "checkbox" })} />
            <Switch label="Alto ticket" {...form.getInputProps("isHighRevenue", { type: "checkbox" })} />
          </Group>
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? "Salvar" : "Criar produto"}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export default function ProductsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); notifications.show({ message: "Produto removido", color: "orange" }); },
  });

  const products = data?.data ?? [];

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Produtos</Title>
          <Text c="dimmed" size="sm" mt={4}>{products.length} equipamentos cadastrados</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} radius="md" onClick={() => { setEditing(undefined); setModalOpen(true); }}>Novo Produto</Button>
      </Group>

      <ProductModal opened={modalOpen} onClose={() => setModalOpen(false)} product={editing} />

      {isLoading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={180} radius="lg" />)}
        </SimpleGrid>
      ) : products.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconPackage size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhum produto cadastrado</Text>
            <Text size="sm" c="dimmed">Cadastre equipamentos para o agente incluir nos orçamentos</Text>
            <Button variant="light" leftSection={<IconPlus size={16} />} mt="xs" onClick={() => { setEditing(undefined); setModalOpen(true); }}>Adicionar produto</Button>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {products.map((product) => (
            <Card key={product.id} padding="lg" radius="lg" withBorder shadow="sm">
              <Group justify="space-between" mb="md">
                <ThemeIcon size={40} radius="md" color="gray" variant="light"><IconPackage size={20} /></ThemeIcon>
                <Group gap={6}>
                  {product.isMostSold && <Tooltip label="Mais vendido"><IconStar size={18} color="var(--mantine-color-yellow-5)" fill="var(--mantine-color-yellow-4)" /></Tooltip>}
                  {product.isHighRevenue && <Tooltip label="Alto ticket"><IconTrendingUp size={18} color="var(--mantine-color-green-5)" /></Tooltip>}
                  <Menu withinPortal position="bottom-end" shadow="sm">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" size="sm"><IconDots size={14} /></ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => { setEditing(product); setModalOpen(true); }}>Editar</Menu.Item>
                      <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => deleteMutation.mutate(product.id)}>Remover</Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>
              <Text fw={600} size="sm" mb={4}>{product.name}</Text>
              <Group gap="xs" mb="md">
                <Badge variant="outline" color="gray" size="xs">{product.category}</Badge>
                <Badge variant="light" color={product.isActive ? "green" : "gray"} size="xs">{product.isActive ? "Ativo" : "Inativo"}</Badge>
              </Group>
              <Box p="sm" style={{ background: "var(--mantine-color-gray-0)", borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
                {[["Diária", product.dailyPrice], ["Semanal", product.weeklyPrice], ["Mensal", product.monthlyPrice]].map(([label, val]) => (
                  <Box key={label as string}>
                    <Text size="xs" c="dimmed">{label}</Text>
                    <Text size="xs" fw={700}>{fmt(val as string | null)}</Text>
                  </Box>
                ))}
              </Box>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

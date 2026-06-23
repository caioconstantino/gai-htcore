"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, Skeleton, Tabs,
  Modal, TextInput, Textarea, NumberInput, Select, Switch, Table,
  ActionIcon, Tooltip, Menu, Divider, Alert, Progress, List, SimpleGrid,
  ScrollArea,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconPackage, IconPlus, IconCheck, IconX, IconAlertCircle, IconDots,
  IconPencil, IconTrash, IconUpload, IconDownload, IconFileSpreadsheet,
  IconCircleCheck, IconAlertTriangle, IconRobot,
} from "@tabler/icons-react";

// ── Periods (same order as the XLSX columns) ──────────────────────
const PERIODS = [
  { days: 1,   label: "Diária" },
  { days: 3,   label: "03 dias" },
  { days: 7,   label: "07 dias" },
  { days: 14,  label: "14 dias" },
  { days: 28,  label: "28 dias" },
  { days: 2,   label: "02 dias" },
  { days: 4,   label: "04 dias" },
  { days: 5,   label: "05 dias" },
  { days: 6,   label: "06 dias" },
  { days: 8,   label: "08 dias" },
  { days: 9,   label: "09 dias" },
  { days: 10,  label: "10 dias" },
  { days: 11,  label: "11 dias" },
  { days: 12,  label: "12 dias" },
  { days: 13,  label: "13 dias" },
  { days: 15,  label: "15 dias" },
  { days: 16,  label: "16 dias" },
  { days: 17,  label: "17 dias" },
  { days: 18,  label: "18 dias" },
  { days: 19,  label: "19 dias" },
  { days: 21,  label: "21 dias" },
  { days: 22,  label: "22 dias" },
  { days: 23,  label: "23 dias" },
  { days: 24,  label: "24 dias" },
  { days: 25,  label: "25 dias" },
  { days: 26,  label: "26 dias" },
  { days: 27,  label: "27 dias" },
  { days: 29,  label: "29 dias" },
  { days: 30,  label: "30 dias" },
  { days: 365, label: "365 Dias" },
] as const;

// Main periods shown in the table and at top of form
const MAIN_PERIODS = [1, 3, 7, 14, 28];

type Prices = Record<string, number | null | undefined>;

interface Product {
  id: string; code: string | null; name: string; category: string;
  description: string | null; prices: Prices;
  dailyPrice: string; weeklyPrice: string | null; monthlyPrice: string | null;
  isMostSold: boolean; isHighRevenue: boolean; isActive: boolean; createdAt: string;
}

interface Suggestion {
  id: string; name: string; category: string; description: string | null;
  dailyPrice: string; weeklyPrice: string | null; monthlyPrice: string | null;
  status: string; reviewNote: string | null; createdAt: string;
  company: { id: string; name: string; slug: string };
}

function fmt(v: string | number | null | undefined) {
  if (v == null || v === "" || Number(v) === 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

function fmtPrice(prices: Prices, days: number): string {
  const v = prices?.[String(days)];
  return v ? fmt(v) : "—";
}

type ProductForm = {
  code: string;
  name: string;
  category: string;
  description: string;
  prices: Record<string, number | null>;
  isMostSold: boolean;
  isHighRevenue: boolean;
};

function makeEmptyPrices(): Record<string, number | null> {
  const p: Record<string, number | null> = {};
  PERIODS.forEach(({ days }) => { p[String(days)] = null; });
  return p;
}

function productToPricesForm(product: Product): Record<string, number | null> {
  const p = makeEmptyPrices();
  PERIODS.forEach(({ days }) => {
    const v = product.prices?.[String(days)];
    p[String(days)] = v != null ? Number(v) : null;
  });
  return p;
}

// ── Modal: Create / Edit product ──────────────────────────────────
function ProductModal({ product, onClose }: { product?: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!product;

  const form = useForm<ProductForm>({
    initialValues: {
      code: product?.code ?? "",
      name: product?.name ?? "",
      category: product?.category ?? "",
      description: product?.description ?? "",
      prices: product ? productToPricesForm(product) : makeEmptyPrices(),
      isMostSold: product?.isMostSold ?? false,
      isHighRevenue: product?.isHighRevenue ?? false,
    },
  });

  const mutation = useMutation({
    mutationFn: (v: ProductForm) => {
      // Strip null prices before sending
      const prices: Record<string, number> = {};
      for (const [k, val] of Object.entries(v.prices)) {
        if (val != null && val > 0) prices[k] = val;
      }
      const payload = { ...v, prices };
      return isEdit
        ? api.patch(`/global-products/${product!.id}`, payload).then((r) => r.data)
        : api.post("/global-products", payload).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-global-products"] });
      notifications.show({ message: isEdit ? "Produto atualizado!" : "Produto criado!", color: "green", icon: <IconCheck size={16} /> });
      onClose();
    },
    onError: () => notifications.show({ message: "Erro ao salvar produto", color: "red" }),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPackage size={18} />
          <Text fw={600}>{isEdit ? "Editar Produto" : "Novo Produto"}</Text>
        </Group>
      }
      size="xl"
      radius="lg"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <form onSubmit={form.onSubmit((v) => mutation.mutate(v))}>
        <Stack gap="md">
          {/* Identity */}
          <SimpleGrid cols={3} spacing="sm">
            <TextInput label="Código" placeholder="AND001" {...form.getInputProps("code")} />
            <TextInput label="Nome / Equipamento" required {...form.getInputProps("name")} style={{ gridColumn: "span 2" }} />
          </SimpleGrid>
          <Group grow>
            <TextInput
              label="Categoria"
              placeholder="Ex: Andaimes"
              required
              description="Digite livremente — categoria nova será criada"
              {...form.getInputProps("category")}
            />
            <Textarea label="Descrição" minRows={1} {...form.getInputProps("description")} />
          </Group>

          {/* Prices — main periods highlighted */}
          <Box>
            <Text size="sm" fw={600} mb={8}>Preços por período (R$)</Text>
            <Text size="xs" c="dimmed" mb={12}>
              Principais períodos primeiro. Deixe em branco os períodos não disponíveis.
            </Text>

            {/* Main periods */}
            <SimpleGrid cols={5} spacing="sm" mb="sm">
              {PERIODS.filter((p) => MAIN_PERIODS.includes(p.days)).map(({ days, label }) => (
                <NumberInput
                  key={days}
                  label={<Text size="xs" fw={700} c="blue">{label}</Text>}
                  prefix="R$ "
                  decimalSeparator=","
                  thousandSeparator="."
                  decimalScale={2}
                  min={0}
                  placeholder="0,00"
                  value={form.values.prices[String(days)] ?? ""}
                  onChange={(v) => form.setFieldValue(`prices.${days}`, v === "" ? null : Number(v))}
                />
              ))}
            </SimpleGrid>

            {/* All other periods */}
            <SimpleGrid cols={5} spacing="sm">
              {PERIODS.filter((p) => !MAIN_PERIODS.includes(p.days)).map(({ days, label }) => (
                <NumberInput
                  key={days}
                  label={<Text size="xs" c="dimmed">{label}</Text>}
                  prefix="R$ "
                  decimalSeparator=","
                  thousandSeparator="."
                  decimalScale={2}
                  min={0}
                  placeholder="0,00"
                  value={form.values.prices[String(days)] ?? ""}
                  onChange={(v) => form.setFieldValue(`prices.${days}`, v === "" ? null : Number(v))}
                />
              ))}
            </SimpleGrid>
          </Box>

          <Group>
            <Switch label="Mais vendido" {...form.getInputProps("isMostSold", { type: "checkbox" })} />
            <Switch label="Alta receita" {...form.getInputProps("isHighRevenue", { type: "checkbox" })} />
          </Group>

          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending} leftSection={<IconCheck size={15} />}>
              {isEdit ? "Salvar" : "Criar produto"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Modal: XLSX import ────────────────────────────────────────────
interface ImportResult {
  created: number; skipped: number; skippedNames: string[]; errors: string[];
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/global-products/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return r.data as ImportResult;
    },
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["admin-global-products"] });
    },
    onError: () => notifications.show({ message: "Erro ao importar arquivo", color: "red" }),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    importMutation.mutate(file);
    e.target.value = "";
  }

  function downloadTemplate() {
    api.get("/global-products/import-template", { responseType: "blob" }).then((r) => {
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modelo-produtos.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={<Group gap="xs"><IconFileSpreadsheet size={18} /><Text fw={600}>Importar via XLSX</Text></Group>}
      size="md"
      radius="lg"
    >
      <Stack gap="md">
        {!result && (
          <>
            <Alert icon={<IconAlertCircle size={16} />} color="blue" radius="md" variant="light">
              Colunas obrigatórias: <strong>Código, Categoria, Equipamentos</strong> + preços por período.
              Produtos com o mesmo nome serão ignorados. Categorias novas são criadas automaticamente.
            </Alert>
            <Button variant="light" leftSection={<IconDownload size={15} />} onClick={downloadTemplate} size="sm" w="fit-content">
              Baixar modelo (.xlsx)
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFile} />
            <Card
              padding="xl"
              radius="lg"
              withBorder
              style={{ borderStyle: "dashed", cursor: importMutation.isPending ? "not-allowed" : "pointer", opacity: importMutation.isPending ? 0.7 : 1 }}
              onClick={() => !importMutation.isPending && fileRef.current?.click()}
            >
              <Stack align="center" gap="xs" py="md">
                <IconUpload size={36} color="var(--mantine-color-blue-5)" />
                <Text fw={500}>{fileName ?? "Clique para selecionar o arquivo"}</Text>
                <Text size="xs" c="dimmed">.xlsx ou .xls — máx. 10 MB</Text>
              </Stack>
            </Card>
            {importMutation.isPending && (
              <Stack gap={4}>
                <Text size="sm" c="dimmed">Importando...</Text>
                <Progress animated value={100} />
              </Stack>
            )}
          </>
        )}

        {result && (
          <Stack gap="md">
            <SimpleGrid cols={3} spacing="sm">
              {[
                { label: "criados", value: result.created, color: "green" },
                { label: "ignorados", value: result.skipped, color: "orange" },
                { label: "erros", value: result.errors.length, color: "red" },
              ].map(({ label, value, color }) => (
                <Card key={label} padding="sm" radius="md" withBorder ta="center">
                  <Text size="xl" fw={700} c={color}>{value}</Text>
                  <Text size="xs" c="dimmed">{label}</Text>
                </Card>
              ))}
            </SimpleGrid>

            {result.created > 0 && (
              <Alert icon={<IconCircleCheck size={16} />} color="green" radius="md" variant="light">
                {result.created} produto{result.created > 1 ? "s importados" : " importado"} com sucesso!
              </Alert>
            )}
            {result.skipped > 0 && (
              <Alert icon={<IconAlertCircle size={16} />} color="orange" radius="md" variant="light">
                <Text size="sm" fw={500} mb={4}>{result.skipped} ignorado{result.skipped > 1 ? "s" : ""} (já existem):</Text>
                <List size="xs">
                  {result.skippedNames.slice(0, 8).map((n) => <List.Item key={n}>{n}</List.Item>)}
                  {result.skippedNames.length > 8 && <List.Item>e mais {result.skippedNames.length - 8}...</List.Item>}
                </List>
              </Alert>
            )}
            {result.errors.length > 0 && (
              <Alert icon={<IconAlertTriangle size={16} />} color="red" radius="md" variant="light">
                <Text size="sm" fw={500} mb={4}>Erros:</Text>
                <List size="xs">
                  {result.errors.slice(0, 8).map((e, i) => <List.Item key={i}>{e}</List.Item>)}
                  {result.errors.length > 8 && <List.Item>e mais {result.errors.length - 8}...</List.Item>}
                </List>
              </Alert>
            )}

            <Group justify="flex-end" gap="sm">
              <Button variant="light" leftSection={<IconUpload size={14} />} onClick={() => { setResult(null); setFileName(null); }}>
                Importar outro
              </Button>
              <Button onClick={onClose} leftSection={<IconCheck size={14} />}>Concluir</Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────
export default function GlobalProductsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";

  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<string>("products");

  const { data, isLoading } = useQuery<{ data: Product[]; total: number }>({
    queryKey: ["admin-global-products"],
    queryFn: () => api.get("/global-products").then((r) => r.data),
    enabled: isSuperAdmin,
  });

  const { data: suggestionsData } = useQuery<{ data: Suggestion[]; total: number }>({
    queryKey: ["all-suggestions"],
    queryFn: () => api.get("/global-products/suggestions").then((r) => r.data),
    enabled: isSuperAdmin,
  });

  const generateSpecialistsMutation = useMutation({
    mutationFn: () => api.post("/global-products/generate-specialists").then((r) => r.data as {
      created: number; updated: number; createdNames: string[]; updatedNames: string[]; categories: string[];
    }),
    onSuccess: (data) => {
      const total = data.created + data.updated;
      notifications.show({
        title: "Agentes especialistas gerados!",
        message: `${data.created} criado${data.created !== 1 ? "s" : ""}, ${data.updated} atualizado${data.updated !== 1 ? "s" : ""} · ${total} categoria${total !== 1 ? "s" : ""}: ${data.categories.join(", ")}`,
        color: "teal",
        icon: <IconRobot size={16} />,
        autoClose: 8000,
      });
    },
    onError: () => notifications.show({ message: "Erro ao gerar agentes especialistas", color: "red" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/global-products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-global-products"] });
      notifications.show({ message: "Produto desativado", color: "orange" });
      setDeleteTarget(null);
    },
    onError: () => notifications.show({ message: "Erro ao desativar produto", color: "red" }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, reviewNote }: { id: string; status: "approved" | "rejected"; reviewNote?: string }) =>
      api.patch(`/global-products/suggestions/${id}/review`, { status, reviewNote }).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["all-suggestions"] });
      qc.invalidateQueries({ queryKey: ["admin-global-products"] });
      notifications.show({
        message: vars.status === "approved" ? "Sugestão aprovada e produto criado!" : "Sugestão rejeitada",
        color: vars.status === "approved" ? "green" : "orange",
      });
    },
    onError: () => notifications.show({ message: "Erro ao revisar sugestão", color: "red" }),
  });

  const products = data?.data ?? [];
  const suggestions = suggestionsData?.data ?? [];
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");

  if (!isSuperAdmin) {
    return <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">Acesso restrito ao Super Admin.</Alert>;
  }

  return (
    <>
      {createOpen && <ProductModal onClose={() => setCreateOpen(false)} />}
      {editProduct && <ProductModal product={editProduct} onClose={() => setEditProduct(null)} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}

      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={<Group gap="xs"><IconTrash size={18} color="var(--mantine-color-red-6)" /><Text fw={600} c="red">Desativar Produto</Text></Group>}
        size="sm"
        radius="lg"
      >
        <Stack gap="md">
          <Text size="sm">O produto <strong>{deleteTarget?.name}</strong> será desativado e deixará de aparecer no catálogo.</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteTarget(null)} leftSection={<IconX size={14} />}>Cancelar</Button>
            <Button color="red" loading={deleteMutation.isPending} leftSection={<IconTrash size={14} />}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Desativar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Stack gap="lg" maw={1400}>
        <Group justify="space-between" align="flex-end">
          <Box>
            <Title order={2} fw={700}>Catálogo Global de Produtos</Title>
            <Text c="dimmed" size="sm" mt={4}>
              {data?.total ?? 0} produtos · disponíveis para todas as empresas
            </Text>
          </Box>
          <Group gap="sm">
            <Button
              variant="light"
              color="teal"
              leftSection={<IconRobot size={16} />}
              onClick={() => generateSpecialistsMutation.mutate()}
              loading={generateSpecialistsMutation.isPending}
            >
              Gerar Agentes por Categoria
            </Button>
            <Button variant="light" leftSection={<IconFileSpreadsheet size={16} />} onClick={() => setImportOpen(true)}>
              Importar XLSX
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
              Novo Produto
            </Button>
          </Group>
        </Group>

        <Tabs value={activeTab} onChange={(v) => setActiveTab(v ?? "products")}>
          <Tabs.List mb="md">
            <Tabs.Tab value="products" leftSection={<IconPackage size={15} />}>
              Produtos ({products.length})
            </Tabs.Tab>
            <Tabs.Tab value="suggestions" leftSection={<IconAlertCircle size={15} />}>
              Sugestões das Empresas
              {pendingSuggestions.length > 0 && <Badge size="xs" color="orange" ml={6}>{pendingSuggestions.length}</Badge>}
            </Tabs.Tab>
          </Tabs.List>

          {/* ── Products tab ── */}
          <Tabs.Panel value="products">
            {isLoading ? (
              <Stack gap="sm">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={52} radius="md" />)}</Stack>
            ) : products.length === 0 ? (
              <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
                <Stack align="center" py="xl" gap="sm">
                  <IconPackage size={44} color="var(--mantine-color-gray-3)" />
                  <Text c="dimmed">Nenhum produto no catálogo</Text>
                  <Group gap="sm">
                    <Button variant="light" size="sm" leftSection={<IconFileSpreadsheet size={14} />} onClick={() => setImportOpen(true)}>Importar XLSX</Button>
                    <Button size="sm" leftSection={<IconPlus size={14} />} onClick={() => setCreateOpen(true)}>Criar manualmente</Button>
                  </Group>
                </Stack>
              </Card>
            ) : (
              <Card padding={0} radius="lg" withBorder shadow="sm" style={{ overflowX: "auto" }}>
                <Table highlightOnHover style={{ minWidth: 800 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={80}>Código</Table.Th>
                      <Table.Th>Produto</Table.Th>
                      <Table.Th>Categoria</Table.Th>
                      <Table.Th ta="right">Diária</Table.Th>
                      <Table.Th ta="right">3 dias</Table.Th>
                      <Table.Th ta="right">7 dias</Table.Th>
                      <Table.Th ta="right">14 dias</Table.Th>
                      <Table.Th ta="right">28 dias</Table.Th>
                      <Table.Th ta="center">Destaques</Table.Th>
                      <Table.Th w={60} ta="center">Ações</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {products.map((p) => (
                      <Table.Tr key={p.id} opacity={p.isActive ? 1 : 0.45}>
                        <Table.Td>
                          <Text size="xs" c="dimmed" ff="monospace">{p.code ?? "—"}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Text size="sm" fw={500}>{p.name}</Text>
                            {!p.isActive && <Badge size="xs" color="red" variant="dot">Inativo</Badge>}
                          </Group>
                          {p.description && <Text size="xs" c="dimmed" lineClamp={1}>{p.description}</Text>}
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="outline" color="blue" size="xs">{p.category}</Badge>
                        </Table.Td>
                        {[1, 3, 7, 14, 28].map((d) => (
                          <Table.Td key={d} ta="right">
                            <Text size="sm" c={p.prices?.[String(d)] ? undefined : "dimmed"}>
                              {fmtPrice(p.prices, d)}
                            </Text>
                          </Table.Td>
                        ))}
                        <Table.Td ta="center">
                          <Group gap={4} justify="center" wrap="nowrap">
                            {p.isMostSold && <Badge size="xs" color="green" variant="light">+ Vendido</Badge>}
                            {p.isHighRevenue && <Badge size="xs" color="violet" variant="light">Alta Receita</Badge>}
                          </Group>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Menu withinPortal shadow="md" width={140} position="bottom-end">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray" size="sm"><IconDots size={15} /></ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => setEditProduct(p)}>Editar</Menu.Item>
                              <Divider />
                              <Menu.Item leftSection={<IconTrash size={14} />} color="red" disabled={!p.isActive} onClick={() => setDeleteTarget(p)}>
                                Desativar
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            )}
          </Tabs.Panel>

          {/* ── Suggestions tab ── */}
          <Tabs.Panel value="suggestions">
            {suggestions.length === 0 ? (
              <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
                <Stack align="center" py="xl" gap="sm">
                  <IconAlertCircle size={40} color="var(--mantine-color-gray-3)" />
                  <Text c="dimmed">Nenhuma sugestão recebida</Text>
                </Stack>
              </Card>
            ) : (
              <Stack gap="sm">
                {suggestions.map((s) => (
                  <Card key={s.id} padding="md" radius="lg" withBorder shadow="sm">
                    <Group justify="space-between" wrap="nowrap">
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group gap="sm" wrap="nowrap">
                          <Text fw={600} size="sm">{s.name}</Text>
                          <Badge variant="outline" color="gray" size="xs">{s.category}</Badge>
                        </Group>
                        <Group gap="xs" mt={4}>
                          <Text size="xs" c="dimmed">{s.company.name}</Text>
                          <Text size="xs" c="dimmed">·</Text>
                          <Text size="xs" c="dimmed">
                            Diária: {fmt(s.dailyPrice)}
                            {s.weeklyPrice ? ` · Semanal: ${fmt(s.weeklyPrice)}` : ""}
                            {s.monthlyPrice ? ` · Mensal: ${fmt(s.monthlyPrice)}` : ""}
                          </Text>
                        </Group>
                        {s.description && <Text size="xs" c="dimmed" mt={2} lineClamp={1}>{s.description}</Text>}
                        {s.reviewNote && (
                          <Text size="xs" c={s.status === "rejected" ? "red" : "green"} mt={4}>Nota: {s.reviewNote}</Text>
                        )}
                      </Box>
                      <Stack align="flex-end" gap="xs" style={{ flexShrink: 0 }}>
                        <Badge color={s.status === "approved" ? "green" : s.status === "rejected" ? "red" : "orange"} variant="light">
                          {s.status === "approved" ? "Aprovado" : s.status === "rejected" ? "Rejeitado" : "Pendente"}
                        </Badge>
                        {s.status === "pending" && (
                          <Group gap="xs">
                            <Button size="xs" color="green" variant="light" leftSection={<IconCheck size={12} />}
                              loading={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ id: s.id, status: "approved" })}>
                              Aprovar
                            </Button>
                            <Button size="xs" color="red" variant="light" leftSection={<IconX size={12} />}
                              loading={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ id: s.id, status: "rejected" })}>
                              Rejeitar
                            </Button>
                          </Group>
                        )}
                      </Stack>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </>
  );
}

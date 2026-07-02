"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Card, Text, Title, Stack, Group, Badge, Avatar, Skeleton,
  Select, Drawer, Divider, Table,
} from "@mantine/core";
import { IconFileText, IconCurrencyDollar, IconFilter } from "@tabler/icons-react";

interface QuoteItem { id: string; productName: string; quantity: number; unitPrice: string; totalPrice: string; }
interface Quote {
  id: string; totalValue: string; discountPercent: string; status: string; createdAt: string;
  validUntil: string | null; notes: string | null;
  lead: { name: string | null; phone: string };
  items: QuoteItem[];
}

const statusOptions = [
  { value: "", label: "Todos os status" },
  { value: "draft", label: "Rascunho" }, { value: "sent", label: "Enviado" },
  { value: "accepted", label: "Aceito" }, { value: "rejected", label: "Recusado" }, { value: "expired", label: "Expirado" },
];
const statusColors: Record<string, string> = {
  draft: "gray", sent: "blue", accepted: "green", rejected: "red", expired: "orange",
};

function fmt(v: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

export default function QuotesPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>("");
  const [selected, setSelected] = useState<Quote | null>(null);

  const { data, isLoading } = useQuery<{ data: Quote[]; total: number }>({
    queryKey: ["quotes"],
    queryFn: () => api.get("/quotes").then((r) => r.data),
  });

  const quotes = (data?.data ?? []).filter((q) => !statusFilter || q.status === statusFilter);

  const totalValue = quotes.filter((q) => q.status === "accepted")
    .reduce((sum, q) => sum + Number(q.totalValue), 0);

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Orçamentos</Title>
          <Text c="dimmed" size="sm" mt={4}>{quotes.length} orçamentos · {fmt(totalValue)} aceitos</Text>
        </Box>
        <Select data={statusOptions} value={statusFilter} onChange={setStatusFilter}
          leftSection={<IconFilter size={14} />} style={{ width: 200 }} size="sm" />
      </Group>

      <Drawer opened={!!selected} onClose={() => setSelected(null)} position="right" size="lg"
        title={`Orçamento — ${selected?.lead.name ?? selected?.lead.phone}`} padding="lg">
        {selected && (
          <Stack gap="md">
            <Group gap="xs">
              <Badge color={statusColors[selected.status] ?? "gray"} variant="light" size="lg">
                {statusOptions.find((s) => s.value === selected.status)?.label}
              </Badge>
              <Text size="sm" c="dimmed">Criado em {new Date(selected.createdAt).toLocaleDateString("pt-BR")}</Text>
              {selected.validUntil && <Text size="sm" c="dimmed">Válido até {new Date(selected.validUntil).toLocaleDateString("pt-BR")}</Text>}
            </Group>
            <Divider label="Itens" />
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th ta="center">Qtd</Table.Th>
                  <Table.Th ta="right">Unit.</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selected.items.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{item.productName}</Table.Td>
                    <Table.Td ta="center">{item.quantity}</Table.Td>
                    <Table.Td ta="right">{fmt(item.unitPrice)}</Table.Td>
                    <Table.Td ta="right" fw={600}>{fmt(item.totalPrice)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Divider />
            <Group justify="space-between">
              <Text size="sm">Desconto</Text>
              <Text size="sm" c="orange">{selected.discountPercent}%</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={700}>Total</Text>
              <Text fw={700} c="green.7" size="lg">{fmt(selected.totalValue)}</Text>
            </Group>
            {selected.notes && (
              <>
                <Divider label="Observações" />
                <Text size="sm" c="dimmed">{selected.notes}</Text>
              </>
            )}
          </Stack>
        )}
      </Drawer>

      {isLoading ? (
        <Stack gap="sm">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={76} radius="lg" />)}</Stack>
      ) : quotes.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconFileText size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhum orçamento encontrado</Text>
            <Text size="sm" c="dimmed">Orçamentos gerados pelo agente aparecerão aqui</Text>
          </Stack>
        </Card>
      ) : (
        <Card padding={0} radius="lg" withBorder shadow="sm">
          <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <Text fw={600} size="sm">{quotes.length} orçamento{quotes.length !== 1 ? "s" : ""}</Text>
          </Box>
          {quotes.map((quote, i) => (
            <Box key={quote.id} px="lg" py="md" onClick={() => setSelected(quote)}
              style={{
                display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "background 0.1s",
                borderBottom: i < quotes.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mantine-color-gray-0)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Avatar color="green" radius="md" size={40}><IconCurrencyDollar size={20} /></Avatar>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500}>{quote.lead.name ?? quote.lead.phone}</Text>
                <Text size="xs" c="dimmed" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {quote.items.map((it) => `${it.quantity}x ${it.productName}`).join(", ")}
                </Text>
              </Box>
              <Group gap="sm">
                <Box ta="right">
                  <Text size="sm" fw={700} c="green.7">{fmt(quote.totalValue)}</Text>
                  {Number(quote.discountPercent) > 0 && <Text size="xs" c="dimmed">{quote.discountPercent}% desc.</Text>}
                </Box>
                <Badge color={statusColors[quote.status] ?? "gray"} variant="light" size="sm">
                  {statusOptions.find((s) => s.value === quote.status)?.label ?? quote.status}
                </Badge>
                <Text size="xs" c="dimmed">{new Date(quote.createdAt).toLocaleDateString("pt-BR")}</Text>
              </Group>
            </Box>
          ))}
        </Card>
      )}
    </Stack>
  );
}

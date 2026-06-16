"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Box, Card, Text, Title, Stack, Group, Badge, Avatar, Skeleton } from "@mantine/core";
import { IconFileText, IconCurrencyDollar } from "@tabler/icons-react";

interface Quote {
  id: string;
  totalValue: string;
  discountPercent: string;
  status: string;
  createdAt: string;
  lead: { name: string | null; phone: string };
  items: Array<{ productName: string; quantity: number }>;
}

const statusColors: Record<string, string> = {
  draft: "gray", sent: "blue", accepted: "green", rejected: "red", expired: "orange",
};
const statusLabels: Record<string, string> = {
  draft: "Rascunho", sent: "Enviado", accepted: "Aceito", rejected: "Recusado", expired: "Expirado",
};

function fmt(v: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

export default function QuotesPage() {
  const { data, isLoading } = useQuery<{ data: Quote[] }>({
    queryKey: ["quotes"],
    queryFn: () => api.get("/quotes").then((r) => r.data),
  });

  const quotes = data?.data ?? [];

  return (
    <Stack gap="lg" maw={1200}>
      <Box>
        <Title order={2} fw={700}>Orçamentos</Title>
        <Text c="dimmed" size="sm" mt={4}>{quotes.length} orçamentos gerados</Text>
      </Box>

      {isLoading ? (
        <Stack gap="sm">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={76} radius="lg" />)}
        </Stack>
      ) : quotes.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconFileText size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhum orçamento gerado</Text>
            <Text size="sm" c="dimmed">Orçamentos gerados pelo agente aparecerão aqui</Text>
          </Stack>
        </Card>
      ) : (
        <Card padding={0} radius="lg" withBorder shadow="sm">
          <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <Text fw={600} size="sm">Lista de Orçamentos</Text>
          </Box>
          {quotes.map((quote, i) => (
            <Box
              key={quote.id}
              px="lg" py="md"
              style={{
                display: "flex", alignItems: "center", gap: 16,
                borderBottom: i < quotes.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
                cursor: "pointer", transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mantine-color-gray-0)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Avatar color="green" radius="md" size={40}>
                <IconCurrencyDollar size={20} />
              </Avatar>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={500}>{quote.lead.name ?? quote.lead.phone}</Text>
                <Text size="xs" c="dimmed" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {quote.items.map((it) => `${it.quantity}x ${it.productName}`).join(", ")}
                </Text>
              </Box>
              <Group gap="sm">
                <Box ta="right">
                  <Text size="sm" fw={700} c="green.7">{fmt(quote.totalValue)}</Text>
                  {Number(quote.discountPercent) > 0 && (
                    <Text size="xs" c="dimmed">{quote.discountPercent}% desc.</Text>
                  )}
                </Box>
                <Badge color={statusColors[quote.status] ?? "gray"} variant="light" size="sm">
                  {statusLabels[quote.status] ?? quote.status}
                </Badge>
                <Text size="xs" c="dimmed">
                  {new Date(quote.createdAt).toLocaleDateString("pt-BR")}
                </Text>
              </Group>
            </Box>
          ))}
        </Card>
      )}
    </Stack>
  );
}

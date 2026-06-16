"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Button, Card, Text, Title, Stack, Group, Badge, SimpleGrid, Skeleton, ThemeIcon, Tooltip,
} from "@mantine/core";
import { IconPackage, IconPlus, IconStar, IconTrendingUp } from "@tabler/icons-react";

interface Product {
  id: string;
  name: string;
  category: string;
  description: string | null;
  dailyPrice: string;
  weeklyPrice: string | null;
  monthlyPrice: string | null;
  isActive: boolean;
  isMostSold: boolean;
  isHighRevenue: boolean;
}

function fmt(value: string | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export default function ProductsPage() {
  const { data, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then((r) => r.data),
  });

  const products = data?.data ?? [];

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Produtos</Title>
          <Text c="dimmed" size="sm" mt={4}>{products.length} equipamentos cadastrados</Text>
        </Box>
        <Button leftSection={<IconPlus size={16} />} radius="md">Novo Produto</Button>
      </Group>

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
            <Button variant="light" leftSection={<IconPlus size={16} />} mt="xs">Adicionar produto</Button>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {products.map((product) => (
            <Card key={product.id} padding="lg" radius="lg" withBorder shadow="sm">
              <Group justify="space-between" mb="md">
                <ThemeIcon size={40} radius="md" color="gray" variant="light">
                  <IconPackage size={20} />
                </ThemeIcon>
                <Group gap={6}>
                  {product.isMostSold && (
                    <Tooltip label="Mais vendido">
                      <IconStar size={18} color="var(--mantine-color-yellow-5)" fill="var(--mantine-color-yellow-4)" />
                    </Tooltip>
                  )}
                  {product.isHighRevenue && (
                    <Tooltip label="Alto ticket">
                      <IconTrendingUp size={18} color="var(--mantine-color-green-5)" />
                    </Tooltip>
                  )}
                </Group>
              </Group>

              <Text fw={600} size="sm" mb={6}>{product.name}</Text>
              <Badge variant="outline" color="gray" size="xs" mb="md">{product.category}</Badge>

              <Box
                p="sm"
                style={{
                  background: "var(--mantine-color-gray-0)",
                  borderRadius: 8,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  textAlign: "center",
                }}
              >
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

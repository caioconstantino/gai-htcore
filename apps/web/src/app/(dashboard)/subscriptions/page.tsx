"use client";
import { Box, Card, Title, Text, Stack, Group, Badge, SimpleGrid, ThemeIcon } from "@mantine/core";
import { IconCreditCard, IconCheck } from "@tabler/icons-react";

const plans = [
  { name: "Trial", price: "Grátis", tokens: "100k", users: 3, color: "gray", features: ["1 agente", "WhatsApp básico", "Suporte por email"] },
  { name: "Basic", price: "R$ 299/mês", tokens: "500k", users: 5, color: "blue", features: ["3 agentes", "Follow-up automático", "Dashboard básico", "Suporte prioritário"] },
  { name: "Pro", price: "R$ 699/mês", tokens: "2M", users: 15, color: "violet", features: ["Agentes ilimitados", "Orçamentos em PDF", "Relatórios avançados", "API de integração", "Suporte 24/7"] },
  { name: "Enterprise", price: "Sob consulta", tokens: "Ilimitado", users: 999, color: "orange", features: ["Tudo do Pro", "SLA dedicado", "Onboarding presencial", "Customizações", "Gerente de conta"] },
];

export default function SubscriptionsPage() {
  return (
    <Stack gap="lg" maw={1200}>
      <Box>
        <Title order={2} fw={700}>Assinaturas</Title>
        <Text c="dimmed" size="sm" mt={4}>Planos e configurações de assinatura da plataforma</Text>
      </Box>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {plans.map((plan) => (
          <Card key={plan.name} padding="lg" radius="lg" withBorder shadow="sm">
            <Group mb="md">
              <ThemeIcon size={36} radius="md" color={plan.color} variant="light">
                <IconCreditCard size={18} />
              </ThemeIcon>
              <Badge color={plan.color} variant="light">{plan.name}</Badge>
            </Group>
            <Text fw={800} size="xl" mb={4}>{plan.price}</Text>
            <Text size="xs" c="dimmed" mb="md">{plan.tokens} tokens · até {plan.users === 999 ? "∞" : plan.users} usuários</Text>
            <Stack gap={6}>
              {plan.features.map((f) => (
                <Group key={f} gap="xs">
                  <IconCheck size={14} color="var(--mantine-color-green-6)" />
                  <Text size="xs">{f}</Text>
                </Group>
              ))}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

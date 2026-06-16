"use client";
import { Box, Card, Title, Text, Stack, Group, Badge, ThemeIcon, Switch, SimpleGrid } from "@mantine/core";
import { IconShield, IconKey, IconLock, IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { useState } from "react";

export default function SecurityPage() {
  const [mfa, setMfa] = useState(false);
  const [ipFilter, setIpFilter] = useState(false);
  const [sessionLimit, setSessionLimit] = useState(true);

  const checks = [
    { label: "JWT com expiração de 7 dias", ok: true },
    { label: "Bcrypt para hash de senhas (salt 12)", ok: true },
    { label: "Rate limiting na API (100 req/15min)", ok: true },
    { label: "Helmet.js habilitado", ok: true },
    { label: "CORS configurado por origem", ok: true },
    { label: "RLS no banco de dados (Supabase)", ok: true },
    { label: "Isolamento multi-tenant por companyId", ok: true },
    { label: "MFA para super admins", ok: false },
  ];

  return (
    <Stack gap="lg" maw={900}>
      <Box>
        <Title order={2} fw={700}>Segurança</Title>
        <Text c="dimmed" size="sm" mt={4}>Configurações de segurança da plataforma</Text>
      </Box>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {[
          { label: "MFA para Super Admins", desc: "Autenticação de dois fatores obrigatória", value: mfa, set: setMfa, icon: IconKey, available: false },
          { label: "Filtro por IP", desc: "Restringir acesso por endereço IP", value: ipFilter, set: setIpFilter, icon: IconLock, available: false },
          { label: "Limite de sessões", desc: "Máximo 3 sessões simultâneas por usuário", value: sessionLimit, set: setSessionLimit, icon: IconShield, available: true },
        ].map(({ label, desc, value, set, icon: Icon, available }) => (
          <Card key={label} padding="lg" radius="lg" withBorder shadow="sm">
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon size={36} radius="md" color="blue" variant="light"><Icon size={18} /></ThemeIcon>
                <Box>
                  <Text fw={600} size="sm">{label}</Text>
                  <Text size="xs" c="dimmed">{desc}</Text>
                </Box>
              </Group>
              {available
                ? <Switch checked={value} onChange={(e) => set(e.currentTarget.checked)} />
                : <Badge color="gray" variant="outline" size="xs">Em breve</Badge>
              }
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Card padding="lg" radius="lg" withBorder shadow="sm">
        <Group mb="md">
          <ThemeIcon size={32} radius="md" color="green" variant="light"><IconShield size={16} /></ThemeIcon>
          <Text fw={600} size="sm">Checklist de Segurança</Text>
        </Group>
        <Stack gap="sm">
          {checks.map(({ label, ok }) => (
            <Group key={label} gap="sm">
              {ok
                ? <IconCheck size={16} color="var(--mantine-color-green-6)" />
                : <IconAlertCircle size={16} color="var(--mantine-color-yellow-6)" />}
              <Text size="sm" c={ok ? "inherit" : "dimmed"}>{label}</Text>
              {!ok && <Badge color="yellow" variant="light" size="xs" ml="auto">Pendente</Badge>}
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

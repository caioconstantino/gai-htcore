"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Box, Card, Text, Title, Stack, Group, Badge, TextInput,
  Avatar, SimpleGrid, Skeleton,
} from "@mantine/core";
import { IconUsers, IconSearch, IconFlame, IconSnowflake, IconTemperature } from "@tabler/icons-react";

interface Lead {
  id: string;
  name: string | null;
  phone: string;
  companyName: string | null;
  stage: string;
  temperature: string;
  source: string;
  lastInteractionAt: string;
}

const stageLabels: Record<string, string> = {
  new: "Novo", qualified: "Qualificado", proposal: "Proposta",
  negotiation: "Negociação", won: "Ganho", lost: "Perdido",
};
const stageColors: Record<string, string> = {
  new: "blue", qualified: "violet", proposal: "yellow",
  negotiation: "orange", won: "green", lost: "red",
};

function TempIcon({ temp }: { temp: string }) {
  if (temp === "hot") return <IconFlame size={16} color="var(--mantine-color-orange-5)" />;
  if (temp === "cold") return <IconSnowflake size={16} color="var(--mantine-color-blue-4)" />;
  return <IconTemperature size={16} color="var(--mantine-color-yellow-5)" />;
}

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<{ data: Lead[]; total: number }>({
    queryKey: ["leads"],
    queryFn: () => api.get("/leads").then((r) => r.data),
  });

  const leads = data?.data ?? [];
  const filtered = leads.filter((l) =>
    !search ||
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search) ||
    l.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={2} fw={700}>Leads</Title>
          <Text c="dimmed" size="sm" mt={4}>{data?.total ?? 0} leads cadastrados</Text>
        </Box>
      </Group>

      <TextInput
        placeholder="Buscar por nome, telefone ou empresa..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 380 }}
        size="md"
      />

      {isLoading ? (
        <Stack gap="sm">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={72} radius="lg" />)}
        </Stack>
      ) : filtered.length === 0 ? (
        <Card padding="xl" radius="lg" withBorder style={{ borderStyle: "dashed" }}>
          <Stack align="center" py="xl" gap="sm">
            <IconUsers size={48} color="var(--mantine-color-gray-3)" />
            <Text fw={500} c="dimmed">Nenhum lead encontrado</Text>
            <Text size="sm" c="dimmed">
              {search ? "Tente uma busca diferente" : "Leads do WhatsApp aparecerão aqui automaticamente"}
            </Text>
          </Stack>
        </Card>
      ) : (
        <Card padding={0} radius="lg" withBorder shadow="sm">
          <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
            <Text fw={600} size="sm">Lista de Leads</Text>
          </Box>
          {filtered.map((lead, i) => (
            <Box
              key={lead.id}
              px="lg"
              py="md"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                borderBottom: i < filtered.length - 1 ? "1px solid var(--mantine-color-gray-1)" : "none",
                transition: "background 0.1s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mantine-color-gray-0)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Avatar color="blue" radius="xl" size={40}>
                {lead.name?.charAt(0)?.toUpperCase() ?? lead.phone.slice(-2)}
              </Avatar>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs">
                  <Text size="sm" fw={500}>{lead.name ?? "Sem nome"}</Text>
                  <TempIcon temp={lead.temperature} />
                </Group>
                <Text size="xs" c="dimmed">
                  {lead.phone}{lead.companyName ? ` · ${lead.companyName}` : ""}
                </Text>
              </Box>
              <Group gap="sm">
                <Badge color={stageColors[lead.stage] ?? "gray"} variant="light" size="sm">
                  {stageLabels[lead.stage] ?? lead.stage}
                </Badge>
                <Text size="xs" c="dimmed">
                  {new Date(lead.lastInteractionAt).toLocaleDateString("pt-BR")}
                </Text>
              </Group>
            </Box>
          ))}
        </Card>
      )}
    </Stack>
  );
}

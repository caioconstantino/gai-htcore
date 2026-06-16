"use client";
import { Box, Card, Title, Text, Stack, Group, Badge, Button, ThemeIcon, SimpleGrid, Switch } from "@mantine/core";
import { IconPlugConnected, IconBrandWhatsapp, IconBrandOpenai, IconWebhook, IconApi } from "@tabler/icons-react";
import { useState } from "react";

const integrations = [
  { name: "Meta WhatsApp Business API", desc: "Integração oficial com a API do WhatsApp para envio e recebimento de mensagens.", icon: IconBrandWhatsapp, color: "green", status: "active" },
  { name: "OpenAI", desc: "GPT-4o e GPT-4o Mini para processamento de linguagem natural dos agentes.", icon: IconBrandOpenai, color: "gray", status: "active" },
  { name: "Webhooks Externos", desc: "Envie eventos da plataforma para sistemas externos via webhook HTTP.", icon: IconWebhook, color: "blue", status: "inactive" },
  { name: "API REST G.AI", desc: "Acesso programático à plataforma via API REST com autenticação JWT.", icon: IconApi, color: "violet", status: "active" },
];

export default function IntegrationsPage() {
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(integrations.map(i => [i.name, i.status === "active"]))
  );

  return (
    <Stack gap="lg" maw={1000}>
      <Box>
        <Title order={2} fw={700}>Integrações</Title>
        <Text c="dimmed" size="sm" mt={4}>Conectores e APIs integrados à plataforma G.AI</Text>
      </Box>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {integrations.map((intg) => (
          <Card key={intg.name} padding="lg" radius="lg" withBorder shadow="sm">
            <Group justify="space-between" mb="md">
              <Group gap="sm">
                <ThemeIcon size={40} radius="md" color={intg.color} variant="light">
                  <intg.icon size={20} />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="sm">{intg.name}</Text>
                  <Badge color={states[intg.name] ? "green" : "gray"} variant="dot" size="xs">
                    {states[intg.name] ? "Ativo" : "Inativo"}
                  </Badge>
                </Box>
              </Group>
              <Switch
                checked={states[intg.name]}
                onChange={(e) => setStates(s => ({ ...s, [intg.name]: e.currentTarget.checked }))}
                size="sm"
              />
            </Group>
            <Text size="sm" c="dimmed">{intg.desc}</Text>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

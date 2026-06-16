"use client";

import { Box, Card, Text, Title, Stack, Group, ThemeIcon } from "@mantine/core";
import { IconBrandWhatsapp, IconRobot, IconKey } from "@tabler/icons-react";

const sections = [
  {
    icon: IconBrandWhatsapp,
    color: "green",
    title: "WhatsApp",
    description: "Configuração do Meta WhatsApp Business API",
    body: "Configure seu número de WhatsApp Business, token de acesso e webhook no Meta for Developers.",
  },
  {
    icon: IconRobot,
    color: "violet",
    title: "IA",
    description: "Configuração do provedor de inteligência artificial",
    body: "Selecione o modelo de IA e configure os limites de tokens por empresa.",
  },
  {
    icon: IconKey,
    color: "orange",
    title: "API Keys",
    description: "Chaves de integração da plataforma",
    body: "Gerencie as chaves de API para integração com sistemas externos.",
  },
];

export default function SettingsPage() {
  return (
    <Stack gap="lg" maw={720}>
      <Box>
        <Title order={2} fw={700}>Configurações</Title>
        <Text c="dimmed" size="sm" mt={4}>Gerencie as configurações da plataforma</Text>
      </Box>

      <Stack gap="md">
        {sections.map(({ icon: Icon, color, title, description, body }) => (
          <Card key={title} padding="lg" radius="lg" withBorder shadow="sm">
            <Group mb="sm">
              <ThemeIcon size={40} radius="md" color={color} variant="light">
                <Icon size={20} />
              </ThemeIcon>
              <Box>
                <Text fw={600} size="sm">{title}</Text>
                <Text size="xs" c="dimmed">{description}</Text>
              </Box>
            </Group>
            <Text size="sm" c="dimmed">{body}</Text>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

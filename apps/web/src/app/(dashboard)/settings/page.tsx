"use client";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Box, Card, Text, Title, Stack, Group, ThemeIcon, TextInput, Select,
  Button, Divider, Badge, Progress, PasswordInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconBrandWhatsapp, IconRobot, IconBuilding, IconDeviceFloppy } from "@tabler/icons-react";

interface Company {
  id: string; name: string; slug: string; plan: string; isActive: boolean;
  whatsappPhoneNumberId: string | null; aiProvider: string; aiModel: string;
  tokenLimit: number; tokensUsed: number; userLimit: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const companyId = user?.companyId;

  const { data: company } = useQuery<Company>({
    queryKey: ["company", companyId],
    queryFn: () => api.get(`/companies/${companyId}`).then((r) => r.data),
    enabled: !!companyId,
  });

  const whatsappForm = useForm({
    initialValues: { whatsappPhoneNumberId: "", whatsappToken: "" },
  });

  const aiForm = useForm({
    initialValues: { aiProvider: "openai", aiModel: "gpt-4o-mini" },
  });

  useEffect(() => {
    if (company) {
      whatsappForm.setValues({ whatsappPhoneNumberId: company.whatsappPhoneNumberId ?? "", whatsappToken: "" });
      aiForm.setValues({ aiProvider: company.aiProvider ?? "openai", aiModel: company.aiModel ?? "gpt-4o-mini" });
    }
  }, [company]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch(`/companies/${companyId}`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company", companyId] }); notifications.show({ message: "Configurações salvas!", color: "green" }); },
    onError: () => notifications.show({ message: "Erro ao salvar", color: "red" }),
  });

  const tokenPct = company ? Math.min(100, (company.tokensUsed / company.tokenLimit) * 100) : 0;

  return (
    <Stack gap="lg" maw={720}>
      <Box>
        <Title order={2} fw={700}>Configurações</Title>
        <Text c="dimmed" size="sm" mt={4}>Configurações da sua empresa na plataforma G.AI</Text>
      </Box>

      {/* Company info */}
      <Card padding="lg" radius="lg" withBorder shadow="sm">
        <Group mb="md">
          <ThemeIcon size={40} radius="md" color="blue" variant="light"><IconBuilding size={20} /></ThemeIcon>
          <Box>
            <Text fw={600} size="sm">Dados da Empresa</Text>
            <Text size="xs" c="dimmed">Informações do plano e uso</Text>
          </Box>
        </Group>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm">Empresa</Text>
            <Text size="sm" fw={500}>{company?.name ?? "—"}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Plano</Text>
            <Badge color="blue" variant="light" tt="capitalize">{company?.plan ?? "—"}</Badge>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Status</Text>
            <Badge color={company?.isActive ? "green" : "red"} variant="light">
              {company?.isActive ? "Ativa" : "Inativa"}
            </Badge>
          </Group>
          <Divider />
          <Group justify="space-between">
            <Text size="sm">Tokens utilizados</Text>
            <Text size="sm" fw={500}>{fmt(company?.tokensUsed ?? 0)} / {fmt(company?.tokenLimit ?? 0)}</Text>
          </Group>
          <Progress value={tokenPct} color={tokenPct > 80 ? "red" : tokenPct > 60 ? "orange" : "blue"} size="sm" radius="xl" />
        </Stack>
      </Card>

      {/* WhatsApp config */}
      <Card padding="lg" radius="lg" withBorder shadow="sm">
        <Group mb="md">
          <ThemeIcon size={40} radius="md" color="green" variant="light"><IconBrandWhatsapp size={20} /></ThemeIcon>
          <Box>
            <Text fw={600} size="sm">WhatsApp Business API</Text>
            <Text size="xs" c="dimmed">Configure sua integração com a Meta</Text>
          </Box>
        </Group>
        <form onSubmit={whatsappForm.onSubmit((v) => mutation.mutate({ whatsappPhoneNumberId: v.whatsappPhoneNumberId || null, ...(v.whatsappToken ? { whatsappToken: v.whatsappToken } : {}) }))}>
          <Stack gap="md">
            <TextInput
              label="Phone Number ID"
              description="Encontrado no Meta for Developers → WhatsApp → API Setup"
              placeholder="123456789012345"
              {...whatsappForm.getInputProps("whatsappPhoneNumberId")}
            />
            <PasswordInput
              label="Access Token"
              description="Token permanente gerado no Meta Business Manager"
              placeholder="EAAxxxxx..."
              {...whatsappForm.getInputProps("whatsappToken")}
            />
            <Box p="sm" style={{ background: "var(--mantine-color-blue-0)", borderRadius: 8, border: "1px solid var(--mantine-color-blue-2)" }}>
              <Text size="xs" c="blue.7" fw={500}>URL do Webhook para configurar no Meta:</Text>
              <Text size="xs" c="blue.6" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                {typeof window !== "undefined" ? `${window.location.origin.replace("3000", "3001")}/webhook/${company?.slug ?? "sua-empresa"}` : ""}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>Verify Token: <code>{process.env.NEXT_PUBLIC_WA_VERIFY_TOKEN ?? "gai_whatsapp_verify_2026"}</code></Text>
            </Box>
            <Group justify="flex-end">
              <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={mutation.isPending}>Salvar WhatsApp</Button>
            </Group>
          </Stack>
        </form>
      </Card>

      {/* AI config */}
      <Card padding="lg" radius="lg" withBorder shadow="sm">
        <Group mb="md">
          <ThemeIcon size={40} radius="md" color="violet" variant="light"><IconRobot size={20} /></ThemeIcon>
          <Box>
            <Text fw={600} size="sm">Inteligência Artificial</Text>
            <Text size="xs" c="dimmed">Provedor e modelo padrão para os agentes</Text>
          </Box>
        </Group>
        <form onSubmit={aiForm.onSubmit((v) => mutation.mutate(v))}>
          <Stack gap="md">
            <Select
              label="Provedor de IA"
              data={[{ value: "openai", label: "OpenAI" }]}
              {...aiForm.getInputProps("aiProvider")}
            />
            <Select
              label="Modelo padrão"
              data={[
                { value: "gpt-4o", label: "GPT-4o (mais inteligente)" },
                { value: "gpt-4o-mini", label: "GPT-4o Mini (mais rápido e econômico)" },
                { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (legado)" },
              ]}
              description="Agentes podem sobrescrever este modelo individualmente"
              {...aiForm.getInputProps("aiModel")}
            />
            <Group justify="flex-end">
              <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={mutation.isPending}>Salvar IA</Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}

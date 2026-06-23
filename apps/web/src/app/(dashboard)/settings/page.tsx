"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Box, Card, Text, Title, Stack, Group, ThemeIcon, TextInput, Textarea, Select,
  Button, Divider, Badge, Progress, PasswordInput, CopyButton, ActionIcon,
  Tooltip, Code, SimpleGrid,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconBrandWhatsapp, IconRobot, IconBuilding, IconDeviceFloppy,
  IconCopy, IconCheck, IconRefresh, IconId,
} from "@tabler/icons-react";

interface CompanyMetadata {
  nomeFantasia?: string; razaoSocial?: string; cnpj?: string; enderecoSede?: string;
  linkMaps?: string; telefoneContato?: string; whatsappNumero?: string; website?: string;
  proprietarioResponsavel?: string; ramoAtuacao?: string; fundacao?: string; socios?: string;
}

interface Company {
  id: string; name: string; slug: string; plan: string; isActive: boolean;
  whatsappPhoneNumberId: string | null; aiProvider: string; aiModel: string;
  tokenLimit: number; tokensUsed: number; userLimit: number;
  metadata: CompanyMetadata;
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const companyId = user?.companyId;
  const [webhookUrl, setWebhookUrl] = useState("");

  const { data: company } = useQuery<Company>({
    queryKey: ["company", companyId],
    queryFn: () => api.get(`/companies/${companyId}`).then((r) => r.data),
    enabled: !!companyId,
  });

  const infoForm = useForm<CompanyMetadata>({
    initialValues: {
      nomeFantasia: "", razaoSocial: "", cnpj: "", enderecoSede: "", linkMaps: "",
      telefoneContato: "", whatsappNumero: "", website: "",
      proprietarioResponsavel: "", ramoAtuacao: "", fundacao: "", socios: "",
    },
  });

  const whatsappForm = useForm({
    initialValues: { whatsappToken: "" },
  });

  const aiForm = useForm({
    initialValues: { aiProvider: "openai", aiModel: "gpt-4o-mini" },
  });

  useEffect(() => {
    if (company) {
      aiForm.setValues({ aiProvider: company.aiProvider ?? "openai", aiModel: company.aiModel ?? "gpt-4o-mini" });
      const m = company.metadata ?? {};
      infoForm.setValues({
        nomeFantasia:            m.nomeFantasia ?? "",
        razaoSocial:             m.razaoSocial ?? "",
        cnpj:                    m.cnpj ?? "",
        enderecoSede:            m.enderecoSede ?? "",
        linkMaps:                m.linkMaps ?? "",
        telefoneContato:         m.telefoneContato ?? "",
        whatsappNumero:          m.whatsappNumero ?? "",
        website:                 m.website ?? "",
        proprietarioResponsavel: m.proprietarioResponsavel ?? "",
        ramoAtuacao:             m.ramoAtuacao ?? "",
        fundacao:                m.fundacao ?? "",
        socios:                  m.socios ?? "",
      });
      if (typeof window !== "undefined") {
        const backendBase = window.location.origin.replace(/:\d+$/, ":3001");
        setWebhookUrl(`${backendBase}/webhook/${company.slug}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {/* Informações Gerais */}
      <Card padding="lg" radius="lg" withBorder shadow="sm">
        <Group mb="md">
          <ThemeIcon size={40} radius="md" color="indigo" variant="light"><IconId size={20} /></ThemeIcon>
          <Box>
            <Text fw={600} size="sm">Informações da Empresa</Text>
            <Text size="xs" c="dimmed">Dados cadastrais e de contato</Text>
          </Box>
        </Group>
        <form onSubmit={infoForm.onSubmit((v) => {
          const metadata: Record<string, string> = {};
          for (const [k, val] of Object.entries(v)) {
            if (val && String(val).trim()) metadata[k] = String(val).trim();
          }
          mutation.mutate({ metadata });
        })}>
          <Stack gap="md">
            <SimpleGrid cols={2} spacing="md">
              <TextInput label="Nome Fantasia" placeholder="Ex: Locaza Rental" {...infoForm.getInputProps("nomeFantasia")} />
              <TextInput label="Razão Social" placeholder="Ex: Locaza Locações Ltda" {...infoForm.getInputProps("razaoSocial")} />
            </SimpleGrid>
            <SimpleGrid cols={2} spacing="md">
              <TextInput label="CNPJ" placeholder="00.000.000/0001-00" {...infoForm.getInputProps("cnpj")} />
              <TextInput label="Fundação" placeholder="Ex: 2010" {...infoForm.getInputProps("fundacao")} />
            </SimpleGrid>
            <TextInput label="Endereço Sede" placeholder="Rua, número, bairro, cidade - UF" {...infoForm.getInputProps("enderecoSede")} />
            <TextInput label="Link Google Maps" placeholder="https://maps.google.com/..." {...infoForm.getInputProps("linkMaps")} />
            <SimpleGrid cols={2} spacing="md">
              <TextInput label="Telefone de Contato" placeholder="(12) 3456-7890" {...infoForm.getInputProps("telefoneContato")} />
              <TextInput label="WhatsApp" placeholder="(12) 91234-5678" {...infoForm.getInputProps("whatsappNumero")} />
            </SimpleGrid>
            <SimpleGrid cols={2} spacing="md">
              <TextInput label="Website" placeholder="https://www.suaempresa.com.br" {...infoForm.getInputProps("website")} />
              <TextInput label="Proprietário / Responsável" placeholder="Nome completo" {...infoForm.getInputProps("proprietarioResponsavel")} />
            </SimpleGrid>
            <TextInput label="Ramo de Atuação" placeholder="Ex: Locação de Equipamentos de Construção" {...infoForm.getInputProps("ramoAtuacao")} />
            <Textarea label="Sócios" placeholder="Nome dos sócios, separados por vírgula ou em linhas" minRows={2} {...infoForm.getInputProps("socios")} />
            <Group justify="flex-end">
              <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={mutation.isPending}>
                Salvar Informações
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      {/* 360dialog config */}
      <Card padding="lg" radius="lg" withBorder shadow="sm">
        <Group mb="md">
          <ThemeIcon size={40} radius="md" color="green" variant="light"><IconBrandWhatsapp size={20} /></ThemeIcon>
          <Box>
            <Text fw={600} size="sm">WhatsApp via 360dialog</Text>
            <Text size="xs" c="dimmed">Configure sua chave de API da 360dialog</Text>
          </Box>
        </Group>

        <form onSubmit={whatsappForm.onSubmit((v) => {
          if (!v.whatsappToken) { notifications.show({ message: "Informe a API Key", color: "red" }); return; }
          mutation.mutate({ whatsappToken: v.whatsappToken });
        })}>
          <Stack gap="md">
            <PasswordInput
              label="360dialog API Key (D360-API-KEY)"
              description="Encontrada no painel da 360dialog → sua conta → API Key"
              placeholder="ER5JD9Y6HJJCW1NX4I28M8CU8JR0WVQW"
              {...whatsappForm.getInputProps("whatsappToken")}
            />

            {/* Webhook URL info box */}
            <Box p="sm" style={{ background: "var(--mantine-color-green-0)", borderRadius: 8, border: "1px solid var(--mantine-color-green-2)" }}>
              <Text size="xs" c="green.8" fw={600} mb={4}>URL do Webhook para configurar na 360dialog:</Text>
              <Group gap="xs" align="center">
                <Code style={{ flex: 1, wordBreak: "break-all", fontSize: 11 }}>
                  {webhookUrl || "https://seu-backend.com/webhook/" + (company?.slug ?? "sua-empresa")}
                </Code>
                <CopyButton value={webhookUrl} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copiado!" : "Copiar"} withArrow>
                      <ActionIcon color={copied ? "teal" : "gray"} variant="subtle" size="sm" onClick={copy}>
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
              <Text size="xs" c="dimmed" mt={6}>
                Salve a API Key acima e peça ao administrador para registrar o webhook na 360dialog.
              </Text>
            </Box>

            <Group justify="flex-end">
              <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={mutation.isPending}>
                Salvar API Key
              </Button>
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
              <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={mutation.isPending}>
                Salvar IA
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}

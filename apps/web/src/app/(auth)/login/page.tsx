"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Box, Button, Center, Paper, PasswordInput, Stack,
  Text, TextInput, Title, Alert, ThemeIcon,
} from "@mantine/core";
import { IconBolt, IconAlertCircle } from "@tabler/icons-react";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAuth(data.token, data.user);
      router.push("/dashboard");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? "Email ou senha inválidos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <Box style={{ width: "100%", maxWidth: 420 }}>
        <Center mb="xl">
          <Stack align="center" gap="xs">
            <ThemeIcon size={64} radius="xl" color="blue" variant="filled">
              <IconBolt size={32} />
            </ThemeIcon>
            <Title order={1} c="white" style={{ fontSize: 36, letterSpacing: -1 }}>
              G.AI
            </Title>
            <Text c="blue.2" size="sm">Infraestrutura Comercial Inteligente</Text>
          </Stack>
        </Center>

        <Paper p="xl" radius="lg" shadow="xl" style={{ background: "rgba(255,255,255,0.97)" }}>
          <Stack gap="xs" mb="lg">
            <Title order={3} ta="center">Acesse sua conta</Title>
            <Text c="dimmed" size="sm" ta="center">Entre com suas credenciais para continuar</Text>
          </Stack>

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Email"
                placeholder="seu@email.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                size="md"
              />
              <PasswordInput
                label="Senha"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                size="md"
              />

              {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
                  {error}
                </Alert>
              )}

              <Button type="submit" loading={loading} size="md" fullWidth mt="xs">
                Entrar
              </Button>
            </Stack>
          </form>
        </Paper>

        <Text ta="center" c="blue.8" size="xs" mt="lg" style={{ opacity: 0.4 }}>
          G.AI © 2026 · HT Core Solutions
        </Text>
      </Box>
    </Box>
  );
}

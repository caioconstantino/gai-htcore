import type { Metadata } from "next";
import { ColorSchemeScript } from "@mantine/core";
import { Providers } from "./providers";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

export const metadata: Metadata = {
  title: "G.AI — Infraestrutura Comercial Inteligente",
  description: "Plataforma de agentes de IA para locadoras de equipamentos",
  icons: { icon: "/icon.png", shortcut: "/icon.png", apple: "/icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <ColorSchemeScript />
      </head>
      <body style={{ margin: 0, background: "#f8fafc" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

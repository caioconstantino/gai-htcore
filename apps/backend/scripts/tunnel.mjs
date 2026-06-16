#!/usr/bin/env node
/**
 * tunnel.mjs — inicia ngrok, captura a URL, atualiza .env e registra o webhook
 * na 360dialog para todas as empresas com API key configurada.
 *
 * Uso: node scripts/tunnel.mjs
 */

import { spawn, execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dir, "../.env");
const NGROK_API = "http://localhost:4040/api/tunnels";
const NGROK_EXE =
  process.platform === "win32"
    ? `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\\ngrok.exe`
    : "ngrok";

// ── helpers ──────────────────────────────────────────────────────
function readEnv() {
  return readFileSync(ENV_PATH, "utf8");
}

function setEnvVar(key, value) {
  let content = readEnv();
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  writeFileSync(ENV_PATH, content, "utf8");
}

function getEnvVar(key) {
  const match = readEnv().match(new RegExp(`^${key}=(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getNgrokUrl(retries = 12, interval = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(NGROK_API);
      if (res.ok) {
        const data = await res.json();
        const tunnel = data.tunnels?.find((t) => t.proto === "https");
        if (tunnel?.public_url) return tunnel.public_url;
      }
    } catch {
      // ainda iniciando
    }
    console.log(`  Aguardando ngrok... (${i + 1}/${retries})`);
    await sleep(interval);
  }
  throw new Error("Timeout: ngrok não respondeu em tempo hábil.");
}

async function registerWebhook(apiKey, webhookUrl) {
  const dialogBase = getEnvVar("DIALOG_360_BASE_URL") ?? "https://waba-sandbox.360dialog.io";
  const res = await fetch(`${dialogBase}/v1/configs/webhook`, {
    method: "POST",
    headers: { "D360-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`360dialog error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── main ─────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚇 G.AI Tunnel Setup\n");

  // 1. Matar ngrok anterior se existir
  try {
    if (process.platform === "win32") {
      execSync("taskkill /F /IM ngrok.exe", { stdio: "ignore" });
    } else {
      execSync("pkill -f ngrok", { stdio: "ignore" });
    }
    console.log("  Ngrok anterior encerrado.");
    await sleep(500);
  } catch {
    // nenhum processo anterior — ok
  }

  // 2. Iniciar ngrok em background
  console.log("  Iniciando ngrok na porta 3001...");
  const proc = spawn(NGROK_EXE, ["http", "3001"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  proc.unref();

  // 3. Aguardar URL pública
  const publicUrl = await getNgrokUrl();
  console.log(`\n  ✅ Túnel ativo: ${publicUrl}\n`);

  // 4. Atualizar .env
  setEnvVar("BACKEND_PUBLIC_URL", publicUrl);
  console.log(`  .env atualizado: BACKEND_PUBLIC_URL=${publicUrl}`);

  // 5. Buscar empresas com API key no banco via Prisma
  // Importa Prisma dinamicamente para não precisar de build
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  let companies = [];
  try {
    companies = await prisma.company.findMany({
      where: { whatsappToken: { not: null }, isActive: true },
      select: { id: true, name: true, slug: true, whatsappToken: true },
    });
  } finally {
    await prisma.$disconnect();
  }

  if (companies.length === 0) {
    console.log("\n  ⚠️  Nenhuma empresa com API key 360dialog configurada.");
    console.log("     Configure a API key no painel admin → empresa → Settings.\n");
    return;
  }

  // 6. Registrar webhook para cada empresa
  console.log(`\n  Registrando webhook para ${companies.length} empresa(s)...\n`);
  for (const company of companies) {
    const webhookUrl = `${publicUrl}/webhook/${company.slug}`;
    try {
      await registerWebhook(company.whatsappToken, webhookUrl);
      console.log(`  ✅ ${company.name.padEnd(25)} → ${webhookUrl}`);
    } catch (err) {
      console.error(`  ❌ ${company.name}: ${err.message}`);
    }
  }

  console.log("\n  🎉 Webhooks registrados! Subindo serviços...\n");
}

main().catch((err) => {
  console.error("\n❌ Erro:", err.message);
  process.exit(1);
});

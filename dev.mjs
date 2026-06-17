#!/usr/bin/env node
/**
 * dev.mjs — inicia tudo com um único comando na raiz:
 *   node dev.mjs   ou   pnpm dev
 *
 *  1. Mata processos antigos (ngrok, node)
 *  2. Inicia ngrok → captura URL → atualiza .env
 *  3. Registra webhook na 360dialog para todas as empresas com API key
 *  4. Sobe backend + frontend em paralelo com logs coloridos
 */

import { spawn, spawnSync, execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dir, "apps/backend");
const FRONTEND = resolve(__dir, "apps/web");

// ── cores ANSI ───────────────────────────────────────────────────
const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  blue:   "\x1b[34m",
  red:    "\x1b[31m",
  gray:   "\x1b[90m",
};

function log(prefix, color, msg) {
  String(msg).replace(/\r/g, "").split("\n").filter(Boolean).forEach((line) =>
    process.stdout.write(`${color}[${prefix}]${c.reset} ${line}\n`)
  );
}

function spawnLogged(prefix, color, cmd, args, cwd) {
  const proc = spawn(cmd, args, { shell: true, cwd, env: process.env });
  proc.stdout?.on("data", (d) => log(prefix, color, d));
  proc.stderr?.on("data", (d) => log(prefix, color, d));
  proc.on("exit", (code) => {
    if (code && code !== 0) log(prefix, c.red, `Encerrado com código ${code}`);
  });
  return proc;
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── main ─────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.cyan}  G.AI — Dev Environment${c.reset}\n`);

  // 1. Matar processos anteriores (ngrok + node exceto o próprio processo)
  try { execSync("taskkill /F /IM ngrok.exe 2>nul", { stdio: "ignore" }); } catch {}
  try { execSync(`taskkill /F /IM node.exe /FI "PID ne ${process.pid}" 2>nul`, { stdio: "ignore" }); } catch {}
  await sleep(800);

  // 1b. Tentar iniciar Redis via WSL (se disponível) ou avisar
  try {
    const wslCheck = spawnSync("wsl", ["redis-cli", "ping"], { timeout: 3000, encoding: "utf8" });
    if (wslCheck.stdout?.trim() === "PONG") {
      log("redis  ", c.green, "Redis já está rodando.");
    } else {
      const wslStart = spawnSync("wsl", ["bash", "-c", "sudo service redis-server start 2>/dev/null || redis-server --daemonize yes 2>/dev/null"], { timeout: 5000, encoding: "utf8" });
      if (wslStart.status === 0) {
        log("redis  ", c.green, "Redis iniciado via WSL.");
      } else {
        log("redis  ", c.yellow, "WSL não disponível. BullMQ e cache de histórico estarão desabilitados.");
        log("redis  ", c.yellow, "Para ativar: instale WSL2 + 'sudo apt install redis-server', ou Docker Desktop.");
      }
    }
  } catch {
    log("redis  ", c.yellow, "Redis não encontrado — filas de follow-up desabilitadas.");
  }

  // 2. Executar tunnel.mjs (ngrok + .env + 360dialog) — aguarda terminar
  log("setup", c.cyan, "Configurando ngrok e webhooks...");
  const tunnel = spawnSync("node", ["scripts/tunnel.mjs"], {
    cwd: BACKEND,
    stdio: "inherit",    // mostra output direto no terminal
    shell: true,
    env: process.env,
  });

  if (tunnel.status !== 0) {
    log("setup", c.red, "Falha no setup do túnel. Abortando.");
    process.exit(1);
  }

  // 3. Subir serviços em paralelo
  console.log(`\n${c.bold}  Subindo serviços...${c.reset}\n`);

  const back  = spawnLogged("backend ", c.blue,   "npx", ["tsx", "watch", "src/server.ts"], BACKEND);
  await sleep(2500);
  const front = spawnLogged("frontend", c.yellow, "npx", ["next", "dev"],                  FRONTEND);

  // Ctrl+C encerra tudo
  function shutdown() {
    console.log(`\n${c.gray}  Encerrando serviços...${c.reset}\n`);
    [back, front].forEach((p) => { try { p.kill(); } catch {} });
    try { execSync("taskkill /F /IM ngrok.exe 2>nul", { stdio: "ignore" }); } catch {}
    process.exit(0);
  }
  process.on("SIGINT",  shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(`\n${c.red}❌ ${err.message}${c.reset}\n`);
  process.exit(1);
});

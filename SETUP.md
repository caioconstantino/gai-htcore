# G.AI — Setup do Ambiente

## 1. Pré-requisitos
- Node.js >= 20
- pnpm >= 9
- Docker Desktop (para Redis local)
- Conta no Supabase (supabase.com)

## 2. Instalar dependências
```bash
pnpm install
```

## 3. Supabase — Criar projeto
1. Acesse supabase.com → New Project
2. Nome: `gai-platform`
3. Anote: **Project URL** e **anon key** e **service_role key**
4. Em Settings > Database: copie a **Connection string (URI)** no modo **Transaction** (porta 6543) → `DATABASE_URL`
5. Copie também a **Direct connection** (porta 5432) → `DIRECT_URL`

## 4. Configurar variáveis de ambiente

### Backend
```bash
cp apps/backend/.env.example apps/backend/.env
```
Preencha `apps/backend/.env`:
```
DATABASE_URL=postgresql://postgres.[ref]:[senha]@aws-0-[region].pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.[ref]:[senha]@aws-0-[region].pooler.supabase.com:5432/postgres
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...
JWT_SECRET=gere-uma-string-aleatoria-longa
API_SECRET=outra-string-aleatoria
WHATSAPP_VERIFY_TOKEN=token-que-voce-definir-no-meta
WHATSAPP_APP_SECRET=secret-do-app-meta
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
PORT=3001
```

### Frontend
```bash
cp apps/web/.env.local.example apps/web/.env.local
```

## 5. Subir Redis local
```bash
docker-compose up -d
```

## 6. Criar tabelas no banco
```bash
cd apps/backend
pnpm db:push
```

## 7. Aplicar RLS no Supabase
1. Acesse Supabase → SQL Editor
2. Cole e execute o conteúdo de `apps/backend/prisma/rls.sql`

## 8. Criar usuário super_admin inicial
No SQL Editor do Supabase:
```sql
INSERT INTO users (id, name, email, "passwordHash", role, "isActive", "tokensUsed", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'HT Core Admin',
  'admin@htcore.com.br',
  -- hash de 'admin@2026' gerado com bcrypt rounds=12
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oG5l5ZhZi',
  'super_admin',
  true, 0, now(), now()
);
```
> Troque o email e gere um novo hash de senha em: bcrypt-generator.com (rounds: 12)

## 9. Rodar em desenvolvimento
```bash
# Na raiz do projeto:
pnpm dev
```
- Backend: http://localhost:3001
- Frontend: http://localhost:3000

## 10. Configurar WhatsApp (Meta)
1. Acesse developers.facebook.com → Criar App → Business
2. Adicione o produto "WhatsApp"
3. Configure o webhook: `https://seu-dominio.com/webhook/{company-slug}`
4. Verify Token: o mesmo que `WHATSAPP_VERIFY_TOKEN` no .env
5. Assine eventos: `messages`

-- ============================================================
-- G.AI — Row Level Security (RLS) para SaaS Multiempresa
-- Executar no Supabase após rodar as migrations do Prisma
-- ============================================================

-- Habilita RLS em todas as tabelas de tenant
ALTER TABLE companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_logs ENABLE ROW LEVEL SECURITY;

-- ─── FUNÇÃO HELPER ───────────────────────────────────────────────────────────
-- Retorna o company_id do usuário autenticado via JWT (claim customizado)
CREATE OR REPLACE FUNCTION current_company_id()
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_company_id', TRUE), '')
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_role', TRUE), '')
$$ LANGUAGE sql STABLE;

-- ─── POLICIES: companies ─────────────────────────────────────────────────────
CREATE POLICY "companies: super_admin vê tudo"
  ON companies FOR ALL
  USING (current_user_role() = 'super_admin');

CREATE POLICY "companies: empresa vê só a si mesma"
  ON companies FOR SELECT
  USING (id = current_company_id());

-- ─── POLICIES: users ─────────────────────────────────────────────────────────
CREATE POLICY "users: super_admin vê tudo"
  ON users FOR ALL
  USING (current_user_role() = 'super_admin');

CREATE POLICY "users: vê usuários da própria empresa"
  ON users FOR SELECT
  USING (company_id = current_company_id());

CREATE POLICY "users: gerencia usuários da própria empresa"
  ON users FOR ALL
  USING (company_id = current_company_id());

-- ─── POLICIES: agents ────────────────────────────────────────────────────────
CREATE POLICY "agents: super_admin vê tudo"
  ON agents FOR ALL
  USING (current_user_role() = 'super_admin');

CREATE POLICY "agents: isolamento por empresa"
  ON agents FOR ALL
  USING (company_id = current_company_id());

-- ─── POLICIES: products ──────────────────────────────────────────────────────
CREATE POLICY "products: super_admin vê tudo"
  ON products FOR ALL
  USING (current_user_role() = 'super_admin');

CREATE POLICY "products: isolamento por empresa"
  ON products FOR ALL
  USING (company_id = current_company_id());

-- ─── POLICIES: leads ─────────────────────────────────────────────────────────
CREATE POLICY "leads: super_admin vê tudo"
  ON leads FOR ALL
  USING (current_user_role() = 'super_admin');

CREATE POLICY "leads: isolamento por empresa"
  ON leads FOR ALL
  USING (company_id = current_company_id());

-- ─── POLICIES: conversations ─────────────────────────────────────────────────
CREATE POLICY "conversations: super_admin vê tudo"
  ON conversations FOR ALL
  USING (current_user_role() = 'super_admin');

CREATE POLICY "conversations: isolamento por empresa"
  ON conversations FOR ALL
  USING (company_id = current_company_id());

-- ─── POLICIES: messages ──────────────────────────────────────────────────────
CREATE POLICY "messages: super_admin vê tudo"
  ON messages FOR ALL
  USING (current_user_role() = 'super_admin');

CREATE POLICY "messages: isolamento por empresa"
  ON messages FOR ALL
  USING (company_id = current_company_id());

-- ─── POLICIES: quotes ────────────────────────────────────────────────────────
CREATE POLICY "quotes: super_admin vê tudo"
  ON quotes FOR ALL
  USING (current_user_role() = 'super_admin');

CREATE POLICY "quotes: isolamento por empresa"
  ON quotes FOR ALL
  USING (company_id = current_company_id());

-- ─── POLICIES: token_usage_logs ──────────────────────────────────────────────
CREATE POLICY "token_logs: super_admin vê tudo"
  ON token_usage_logs FOR ALL
  USING (current_user_role() = 'super_admin');

CREATE POLICY "token_logs: isolamento por empresa"
  ON token_usage_logs FOR ALL
  USING (company_id = current_company_id());

-- ─── POLÍTICAS DERIVADAS (sem company_id direto) ────────────────────────────
-- quote_items → via quote
CREATE POLICY "quote_items: isolamento via quote"
  ON quote_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_items.quote_id
        AND q.company_id = current_company_id()
    )
  );

-- commercial_rules
CREATE POLICY "commercial_rules: super_admin vê tudo"
  ON commercial_rules FOR ALL
  USING (current_user_role() = 'super_admin');

CREATE POLICY "commercial_rules: isolamento por empresa"
  ON commercial_rules FOR ALL
  USING (company_id = current_company_id());

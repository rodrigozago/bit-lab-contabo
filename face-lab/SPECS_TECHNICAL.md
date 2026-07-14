# ⚙️ Especificações Técnicas — v0.2 (Vendas + Planos)

**Versão**: Gato-Veloz-v0.2  
**Data**: Julho 10, 2026  
**Escopo**: Dados, APIs, Integrações

---

## 💾 Modelo de Dados Novo

### Tabelas Adicionadas

```sql
-- Planos (subscription tiers)
CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,  -- 'starter', 'professional', 'enterprise'
  name text NOT NULL,
  price_usd decimal NOT NULL,
  price_brl decimal NOT NULL,
  max_events int,              -- null = ilimitado
  max_photos_per_month int,    -- null = ilimitado
  team_members int DEFAULT 1,
  commission_rate decimal,      -- 0.20 = 20% comissão
  features jsonb,              -- array de features
  created_at timestamptz DEFAULT now()
);

-- Subscriptions (photographer planos)
CREATE TABLE photographer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  stripe_subscription_id text UNIQUE,
  status text NOT NULL,        -- 'active', 'trialing', 'canceled', 'paused'
  billing_cycle_start timestamptz,
  billing_cycle_end timestamptz,
  auto_renew boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Photographer branding (site customizado)
CREATE TABLE photographer_branding (
  photographer_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  site_slug text UNIQUE NOT NULL,  -- 'fotograxyz' em fotograxyz.face-lab.tech
  site_title text,
  site_description text,
  logo_url text,
  primary_color text,              -- '#3b82f6'
  secondary_color text,
  favicon_url text,
  socials jsonb,                   -- {instagram: url, facebook: url, ...}
  custom_domain text UNIQUE,       -- futuro: joao.fotografo.com
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fotos com preço (novo campo)
ALTER TABLE photos ADD COLUMN IF NOT EXISTS price_usd decimal DEFAULT 10.00;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS price_brl decimal DEFAULT 50.00;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS can_purchase boolean DEFAULT true;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS tags text[];

-- Carrinhos de compra
CREATE TABLE carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items jsonb NOT NULL,        -- [{photo_id, qty, price}, ...]
  total_usd decimal,
  total_brl decimal,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Compras/Pedidos
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES users(id),
  guest_id uuid NOT NULL REFERENCES users(id),
  event_id uuid NOT NULL REFERENCES albums(id),
  items jsonb NOT NULL,        -- [{photo_id, price, ...}, ...]
  quantity int NOT NULL,
  amount_usd decimal NOT NULL,
  amount_brl decimal NOT NULL,
  currency text DEFAULT 'BRL',
  
  stripe_payment_id text UNIQUE,
  stripe_charge_id text,
  status text NOT NULL,        -- 'pending', 'paid', 'failed', 'refunded'
  
  guest_email text,
  guest_name text,
  
  download_links jsonb,        -- {photo_id: signed_url, ...}
  downloaded_at timestamptz,
  expires_at timestamptz,      -- 30 dias pra download
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Histórico de Payouts
CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payout_id text UNIQUE,
  amount_usd decimal NOT NULL,
  amount_brl decimal NOT NULL,
  
  status text NOT NULL,        -- 'pending', 'completed', 'failed'
  
  bank_account jsonb,          -- {account_number, routing_number, ...} (encrypted)
  
  period_start timestamptz,
  period_end timestamptz,
  
  fees_usd decimal,            -- Stripe fees
  fees_brl decimal,
  
  requested_at timestamptz,
  scheduled_date timestamptz,
  completed_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

-- Analytics (pré-calculado para performance)
CREATE TABLE photographer_analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES albums(id),
  
  date date NOT NULL,
  
  views int DEFAULT 0,          -- Página visitada
  adds_to_cart int DEFAULT 0,   -- Fotos adicionadas ao carrinho
  purchases int DEFAULT 0,      -- Compras completadas
  revenue_usd decimal DEFAULT 0,
  revenue_brl decimal DEFAULT 0,
  
  UNIQUE(photographer_id, event_id, date)
);

-- Avaliações de clientes
CREATE TABLE photographer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES users(id),
  
  rating int NOT NULL,         -- 1-5 stars
  review_text text,
  
  verified_purchase boolean,   -- Apenas quem comprou pode avaliar
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Team members (para planos Professional+)
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  role text NOT NULL,          -- 'editor', 'viewer', 'analyst'
  permissions jsonb,           -- {can_upload, can_edit_prices, can_view_sales, ...}
  
  added_at timestamptz DEFAULT now(),
  
  UNIQUE(photographer_id, team_member_id)
);

-- Cupons/Promoções (futuro)
CREATE TABLE discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid REFERENCES users(id) ON DELETE CASCADE,  -- null = global
  
  code text UNIQUE NOT NULL,
  discount_type text,          -- 'percentage' (20%) ou 'fixed' (R$ 10)
  discount_value decimal,
  
  max_uses int,
  current_uses int DEFAULT 0,
  
  valid_from timestamptz,
  valid_until timestamptz,
  
  created_at timestamptz DEFAULT now()
);
```

---

## 🔌 Integrações Externas

### Stripe Integration

```typescript
// Webhooks to handle
POST /webhooks/stripe
  ├─ payment_intent.succeeded      → Purchase completa
  ├─ charge.refunded               → Reembolso
  ├─ payout.paid                   → Payout enviado
  └─ payment_intent.payment_failed → Falha de pagamento

// Objetos Stripe que usamos
├─ Customer                        (photographer_id linking)
├─ PaymentIntent                   (purchase flow)
├─ Charge                          (capture payment)
├─ Payout                          (enviando grana pro fotógrafo)
└─ ConnectAccount                  (separar contas de cada fotógrafo)
```

### Email Sending

```
Triggers:
  ├─ purchase.completed          → Foto está pronta pro download
  ├─ payout.scheduled            → Aviso de payout agendado
  ├─ photographer.new_review     → Nova avaliação
  ├─ billing.upcoming            → Cobrança próxima
  ├─ billing.failed              → Falha de cobrança
  ├─ photographer.new_sale       → Nova venda (summary)
  └─ guest.download_expiring     → Link expira em 7 dias
```

---

## 📊 Estrutura de Pricing (Database)

```sql
INSERT INTO plans VALUES
  ('starter', 'Starter', 29.00, 145.00, 5, 500, 1, 0.30, 
    '{"features": ["custom_site", "basic_analytics", "watermark"]}'),
    
  ('professional', 'Professional', 79.00, 395.00, NULL, 5000, 2, 0.20,
    '{"features": ["custom_site", "advanced_analytics", "team_members", "api_access"]}'),
    
  ('enterprise', 'Enterprise', 199.00, 995.00, NULL, NULL, NULL, 0.15,
    '{"features": ["everything", "white_label", "priority_support"]}');
```

---

## 🎯 Key APIs Novas

### Guest Checkout

```typescript
// POST /api/cart/add
{
  photo_id: uuid,
  quantity: 1
}

// POST /api/checkout
{
  items: [{photo_id, qty}, ...],
  email: string,
  payment_method: Stripe token
}

// GET /api/purchases/:id/download
// Returns signed URL pra download da foto
```

### Photographer Sales

```typescript
// GET /api/photographer/sales
// Retorna todas vendas com filtros
{
  filters: {
    event_id?: uuid,
    photo_id?: uuid,
    date_from?: date,
    date_to?: date
  }
  page: number,
  limit: number
}

// GET /api/photographer/analytics/daily
{
  event_id?: uuid,
  date_from: date,
  date_to: date
}
// Returns {date, views, adds_to_cart, purchases, revenue}

// PATCH /api/photographer/photos/:id
{
  price_usd?: decimal,
  price_brl?: decimal,
  title?: string,
  description?: string,
  tags?: string[],
  can_purchase?: boolean
}
```

### Branding

```typescript
// POST /api/photographer/branding
{
  site_slug: string,           // 'fotograxyz'
  site_title: string,
  site_description: string,
  logo_url?: string,
  primary_color?: string,
  secondary_color?: string,
  socials?: {instagram?, facebook?, ...}
}

// GET /fotograxyz.face-lab.tech/*
// Retorna site customizado (gerado dinamicamente)
```

### Payouts

```typescript
// GET /api/photographer/payouts
// Histórico de payouts

// POST /api/photographer/payouts/create
{
  amount?: decimal,  // null = payout tudo disponível
  schedule_date?: date
}

// PATCH /api/photographer/payouts/:id/setup
{
  stripe_bank_account_token: string,
  // ou: stripe_connect_account_id
}
```

---

## 🔐 Segurança & Compliance

### PCI Compliance
```
❌ NUNCA armazenar CC
✅ SEMPRE usar Stripe para pagamentos
✅ Tokens do cliente → Stripe.com → Charge
```

### Refund Policy
```
✅ Guest pode pedir refund em 7 dias
✅ Automático para falhas de download
❌ Sem refund após 7 dias (digital product)
```

### Tax
```
NOTA: Precisa definir
├─ IVA para EU customers
├─ GST para CA customers
├─ ICMS para customers BR
└─ Affiliate/1099 pra fotografos
```

---

## 📊 Analytics Key Metrics

```typescript
// Photographer Dashboard
{
  this_month: {
    revenue_usd: number,
    revenue_brl: number,
    purchases: number,
    photos_sold: number,
    conversion_rate: number,  // adds_to_cart / purchases
    avg_order_value: number,
    top_photos: [{photo_id, sold_count, revenue}, ...],
    top_events: [{event_id, revenue, purchases}, ...],
  },
  
  all_time: {
    total_revenue: number,
    total_sales: number,
    avg_rating: number,
    total_reviews: number,
    lifetime_value_per_guest: number,
  },
  
  funnel: {
    site_visitors: number,
    gallery_views: number,
    adds_to_cart: number,
    completed_purchases: number,
    conversion_rate: number,
  }
}
```

---

## 🎨 Public Site Generation (fotograxyz)

```typescript
// Dynamic site gerado com template
type PhotographerSite = {
  slug: string,
  branding: PhotographerBranding,
  about_page: string,
  portfolio: Photo[],
  upcoming_events: Album[],
  reviews: PhotographerReview[],
  contact_form: {
    to_email: string,
    webhook_url?: string
  }
}

// Rotas dinâmicas:
GET /:slug                    → Homepage customizado
GET /:slug/about              → Bio
GET /:slug/portfolio          → Grid de fotos (top rated/best sellers)
GET /:slug/events             → Próximos eventos
GET /:slug/event/:event_id    → Evento específico
GET /:slug/reviews            → Reviews
POST /:slug/contact           → Formulário contato (envia email)
```

---

## 🔄 Payment Flow Detalhado

```
1. Guest add foto ao cart
2. Guest checkout
3. Stripe PaymentIntent created
4. Guest vê tela de pagamento (Stripe Hosted)
5. Guest paga
6. Stripe webhook: payment_intent.succeeded
7. Face Lab cria Purchase record (status: paid)
8. Gera signed download link (válido 30 dias)
9. Envia email com link
10. Guest downloaded
11. Registra em analytics
12. Monthly: calcula payouts
13. Payout scheduled pro fotógrafo
14. Guest pode deixar review
```

---

## ⏳ Arquitetura de Background Jobs

```
Celery/Bull tasks:
  ├─ Generate.download_link (async)
  ├─ SendEmail.purchase_receipt
  ├─ SendEmail.payout_scheduled
  ├─ CalculateAnalytics (daily)
  ├─ GeneratePayouts (monthly)
  ├─ ExpireDownloadLinks (daily)
  └─ SyncWithStripe (hourly)
```

---

## 📱 Responsive Considerations

```
Desktop (>1024px):
  ├─ Sidebar navigation
  ├─ Multi-column grids (3-4 cols)
  ├─ Full analytics dashboards

Tablet (768-1024px):
  ├─ Collapsed sidebar
  ├─ 2-column grids
  ├─ Simplified analytics

Mobile (<768px):
  ├─ Hamburger menu
  ├─ 1-column grids
  ├─ Bottom navigation
  ├─ Touch-optimized checkout
```

---

## 🚀 Database Indexing Strategy

```sql
-- Performance critical
CREATE INDEX idx_purchases_photographer ON purchases(photographer_id);
CREATE INDEX idx_purchases_guest ON purchases(guest_id);
CREATE INDEX idx_purchases_created ON purchases(created_at DESC);
CREATE INDEX idx_photos_album ON photos(album_id);
CREATE INDEX idx_photographer_analytics_daily ON photographer_analytics_daily(photographer_id, date DESC);
CREATE INDEX idx_carts_user ON carts(user_id);

-- Vector search (futuro)
CREATE INDEX idx_faces_embedding ON faces USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

## ✅ MVP Database Schema Checklist

Essential para v0.2:
- [x] plans table
- [x] photographer_subscriptions
- [x] photographer_branding
- [x] photos.price_* fields
- [x] carts table
- [x] purchases table
- [x] payouts table
- [x] photographer_analytics_daily

Nice-to-have (v0.3+):
- [ ] photographer_reviews
- [ ] team_members
- [ ] discount_codes
- [ ] advanced analytics tables

---

**Pronto para desenvolvimento! 🚀**


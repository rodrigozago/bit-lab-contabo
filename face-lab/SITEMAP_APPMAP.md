# 🗺️ Sitemap & App Map — Face Lab (v0.2+)

**Versão**: Gato-Veloz-v0.2 (com vendas + planos)  
**Escopo**: Completo UI/UX para Figma  
**Diálogo**: Fotografo pode vender fotos (SaaS com reconhecimento facial)

---

## 📊 Análise Comparativa

### Plataformas Similares
- **Pixieset**: Galeria bonita, cliente confirma/rejeita, fotógrafo controla preço
- **Fotoify**: Multi-evento, cliente pode escolher fotos e comprar album
- **Face Lab Diferencial**: ⭐ Reconhecimento facial automático (zero seleção manual do fotógrafo!)

---

## 🎯 Principais Mudanças vs v0.1

| Aspecto | v0.1 (Alpha) | v0.2+ (MVP com Vendas) |
|---|---|---|
| **Roles** | Guest, Producer, Admin | Guest, Photographer, Admin |
| **Sites** | Centralizado | Personalizado (fotograxyz.face-lab.tech) |
| **Planos** | Grátis | Pagos (Starter/Professional/Enterprise) |
| **Galeria** | Ver fotos | Ver + Comprar fotos |
| **Checkout** | N/A | Stripe integration |
| **Vendas** | N/A | Analytics, payouts |

---

## 📱 Estrutura de Navegação

### 1. LANDING & ONBOARDING

#### 1.1 Public Pages (Sem Login)
```
/                                    Landing Page
├── /photographer-showcase           "Por que ser fotógrafo?"
├── /for-guests                      "Como convidado funciona?"
├── /pricing                         Planos & Preços
├── /features                        Features (facial recognition)
├── /blog                            Blog/Resources
├── /faq                             Perguntas frequentes
├── /contact                         Contato
├── /terms                           Termos de uso
└── /privacy                         Política de privacidade
```

#### 1.2 Auth Pages
```
/auth/login                          Login unificado
/auth/signup                         Signup (escolher role)
├── signup/guest                     Criar conta como guest
└── signup/photographer              Criar conta como fotógrafo (paga)
/auth/callback                       OAuth callback
/auth/forgot-password                Recuperar senha
```

---

### 2. GUEST JOURNEY (Comprador de Fotos)

```
/guest
├── /gallery                         Dashboard de fotos
│   ├── /gallery/all                 Todas as fotos de eventos
│   ├── /gallery/favorites           Fotos salvas/starred
│   └── /gallery/purchases           Fotos já compradas
│
├── /events                          Lista de eventos onde aparece
│   └── /events/:eventId             Detalhes do evento
│       ├── /events/:eventId/photos  Grid de fotos
│       └── /events/:eventId/album   Baixar album completo
│
├── /checkout
│   ├── /checkout/photo/:id          Comprar 1 foto
│   ├── /checkout/album/:id          Comprar album inteiro
│   └── /checkout/cart               Carrinho de compras
│
├── /account
│   ├── /account/profile             Editar perfil
│   ├── /account/enrollments         Meus rostos cadastrados
│   ├── /account/purchases           Histórico de compras
│   ├── /account/downloads           Minhas fotos (links/zips)
│   └── /account/settings            Configurações
│
└── /photographer/:slug              Página do fotógrafo
    ├── /photographer/:slug/about    Bio + portfolio
    ├── /photographer/:slug/events   Eventos do fotógrafo
    └── /photographer/:slug/reviews  Avaliações
```

---

### 3. PHOTOGRAPHER JOURNEY (Vendedor de Fotos)

```
/photographer
├── /dashboard                       Hub principal
│   ├── Stats: fotos, vendas, revenue
│   ├── Ações rápidas: novo evento, settings
│   └── Alerts: vendas recentes, avaliações
│
├── /events                          Gerenciar eventos
│   ├── /events/new                  Criar novo evento
│   ├── /events/:id/edit             Editar evento
│   ├── /events/:id                  Detalhes evento
│   │   ├── Photos Grid              Todas as fotos do evento
│   │   ├── Guests                   Convidados identificados
│   │   ├── Sales                    Vendas deste evento
│   │   └── Analytics               Views, adds to cart, conversão
│   ├── /events/:id/settings         Config evento (preço, marca d'água, etc)
│   └── /events/:id/shares           Compartilhamentos públicos
│
├── /photos                          Gerenciar fotos
│   ├── /photos/upload               Upload em massa
│   ├── /photos/all                  Grid todas as fotos
│   ├── /photos/:id/edit             Editar meta (título, tags)
│   ├── /photos/:id/preview          Preview
│   └── /photos/bulk-actions         Editar múltiplas (preço, status, etc)
│
├── /site                            Personalizar site (fotograxyz.face-lab.tech)
│   ├── /site/branding               Logo, cores, fonts
│   ├── /site/pages                  Páginas custom (About, Contact)
│   ├── /site/portfolio              Portfolio/showcase
│   ├── /site/links                  Links sociais
│   ├── /site/theme                  Temas pré-built
│   └── /site/preview                Preview do site
│
├── /pricing                         Configurar preços
│   ├── /pricing/photos              Preço por foto
│   ├── /pricing/albums              Preço por album
│   ├── /pricing/bundles             Pacotes (ex: 5 fotos = desc)
│   └── /pricing/discounts           Cupons/promoções
│
├── /gallery                         "Sua galeria" (view como guest)
│   └── /gallery/:eventId            Como visitante vê
│
├── /sales                           Histórico de vendas
│   ├── Sales Table                  Todas as vendas
│   ├── Filters: evento, foto, data
│   ├── Export: CSV
│   └── /sales/:id/details           Detalhes venda
│
├── /payouts                         Receber pagamentos
│   ├── Saldo disponível
│   ├── Histórico de payouts
│   ├── /payouts/setup               Configurar banco/Stripe
│   └── /payouts/schedule            Agendar payout
│
├── /account
│   ├── /account/profile             Dados pessoais
│   ├── /account/site                URL do site (fotograxyz)
│   ├── /account/plan                Plano atual + upgrade
│   ├── /account/billing             Histórico de pagamentos (plano)
│   ├── /account/team                Membros da equipe (plus)
│   ├── /account/integrations        Google Drive, Zapier, etc
│   └── /account/settings            Preferências
│
├── /analytics                       Dashboard de analytics
│   ├── Overview: views, adds, conversão
│   ├── Top photos (por vendas)
│   ├── Referral sources
│   ├── Guest demographics
│   ├── Trending events
│   └── Custom reports
│
├── /help
│   ├── /help/docs                   Documentação
│   ├── /help/tutorials              Video tutorials
│   ├── /help/contact                Contato support
│   └── /help/faq                    FAQ específico
│
└── /resources                       Templates, presets
    ├── /resources/watermarks        Marca d'água customizadas
    ├── /resources/landing-pages     Templates de evento
    └── /resources/email-templates   Email templates
```

---

### 4. PHOTOGRAPHER PUBLIC SITE (fotograxyz.face-lab.tech)

```
/ (homepage customizado)
├── /about                           Bio do fotógrafo
├── /portfolio                       Mostra de trabalhos
├── /events                          Eventos abertos
├── /reviews                         Avaliações de clientes
├── /contact                         Formulário contato
└── /legal                           Termos + privacidade
```

---

### 5. ADMIN PAGES

```
/admin
├── /dashboard                       Overview de sistema
│   ├── Usuários (guests, photographers)
│   ├── Eventos totais
│   ├── Revenue
│   └── Alerts/Issues
│
├── /photographers                   Gerenciar fotografos
│   ├── Table: email, plan, status
│   ├── /photographers/:id           Detalhes fotógrafo
│   └── /photographers/:id/ban       Suspender/Remover
│
├── /support                         Tickets de suporte
│   ├── Inbox de issues
│   ├── /support/:id                 Responder ticket
│   └── Analytics: response time, resolution rate
│
├── /payments                        Sistema de pagamentos
│   ├── Transactions log
│   ├── Refunds
│   └── Payout history
│
├── /content-moderation              Revisar conteúdo
│   ├── Fotos reportadas
│   ├── /photos/:id/review           Revisar foto
│   └── Actions: approve, blur, remove
│
├── /analytics                       Relatórios globais
│   ├── Platform metrics
│   ├── Revenue reports
│   ├── User growth
│   └── Custom queries
│
├── /settings                        Configurações admin
│   ├── Fees & Payouts               Comissão, thresholds
│   ├── Feature flags
│   ├── Email templates
│   └── API keys
│
└── /maintenance                     Operacional
    ├── Database status
    ├── Queue jobs
    └── Error logs
```

---

## 🎨 PLANOS & PRICING

### Modelo de Negócio

```
Guest:                          Sempre Grátis
                                • Fazer enrollment
                                • Ver fotos
                                • Comprar fotos individual

Photographer/Professional:
  └─ Starter ........... R$ 29/mês
      ✅ 5 eventos/mês
      ✅ Até 500 fotos
      ✅ Site customizado (fotograxyz.face-lab.tech)
      ✅ Vendas de fotos (comissão 30%)
      ❌ Team members
      ❌ API access
      ❌ Advanced analytics
      
  └─ Professional ...... R$ 79/mês (MOST POPULAR)
      ✅ Eventos ilimitados
      ✅ Até 5k fotos/mês
      ✅ Site customizado + custom domain
      ✅ Vendas (comissão 20%)
      ✅ 2 team members
      ✅ Basic analytics
      ✅ Priority support
      ✅ Bulk operations
      ✅ Watermark customizado
      ❌ API access
      ❌ Advanced features
      
  └─ Enterprise ....... R$ 199/mês+
      ✅ Eventos ilimitados
      ✅ Fotos ilimitadas
      ✅ API access
      ✅ Custom domain
      ✅ Vendas (comissão 15%)
      ✅ Unlimited team members
      ✅ Advanced analytics + custom reports
      ✅ Priority 24/7 support
      ✅ Custom integrations
      ✅ White-label option
```

### Comissão da Platform

```
Platform Revenue:     Comissão (%) + Payment Fee
  ├─ Starter:         30% + 2.9% + $0.30
  ├─ Professional:    20% + 2.9% + $0.30
  └─ Enterprise:      15% + 2.9% + $0.30 (negociável)

Exemplo: Foto vendida por R$ 50 (Professional)
  Fotógrafo recebe:   R$ 50 × 80% = R$ 40 (comissão 20%)
  Payment fee:        R$ 50 × 2.9% + $0.30 ≈ R$ 1.80
  Platform lucra:     R$ 50 - R$ 40 - R$ 1.80 = R$ 8.20 (16.4%)
```

---

## 🎯 DIFERENCIAL: Reconhecimento Facial

### Como Destaca no Marketing

```
PROBLEMA (sem reconhecimento facial):
  "Fotógrafo tira 500 fotos em casamento"
  "Precisa gastar 2 horas selecionando fotos de cada convidado"
  "Perde tempo = menos lucro"

SOLUÇÃO (Face Lab):
  "Reconhecimento facial automático"
  "Convidado cadastra rosto uma vez"
  "Recebe todas suas fotos em minutos"
  "Fotógrafo pronto pra vender = mais lucro!"

VALUE PROPOSITION POR ROLE:
  ├─ Guest:       "Encontre suas fotos em SEGUNDOS (não horas)"
  ├─ Fotógrafo:   "Venda mais fotos = mais receita"
  └─ Platform:    "Diferencial competitivo vs Pixieset"
```

### Features que Exploram IA

```
✨ Smart Features (podem ser premium):
  ├─ Auto-tagging de fotos         (vem com facial rec)
  ├─ "Similar photos" suggestions   (agrupar mesma pessoa, ângulos)
  ├─ Best shot picker              (qual é melhor: com sorrisso vs sem?)
  ├─ Duplicate detection            (remover fotos repetidas)
  ├─ Face-based analytics          (qual pessoa mais fotografada?)
  └─ Recommended pricing            (fotos populares = preço maior?)
```

---

## 📊 USER FLOWS & KEY PAGES

### Flow 1: Guest Discovering & Buying

```
1. Guest receives link "face.bit-lab.tech/fotograxyz"
2. Sees landing (fotograxyz customized)
3. Clicks "View my photos"
4. Makes enrollment (webcam/upload)
5. Gets grid of their photos (FACIAL RECOGNITION MAGIC ✨)
6. Clicks photo → detail view
7. Clicks "Buy this photo" → checkout
8. Pays
9. Download link appears
10. Enjoys fotos!
```

### Flow 2: Photographer Selling

```
1. Photographer logs in
2. Dashboard shows recent sales, revenue
3. Uploads 500 fotos from casamento
4. Creates "Casamento João & Maria" event
5. Sets price per photo (R$ 30)
6. Generates share link
7. Shares on WhatsApp/Instagram
8. Guests start enrolling
9. Photos start selling (🎉)
10. Analytics show top photos, conversion rate
11. Ships to payout account
```

---

## 🎨 FIGMA WIREFRAMES NEEDED

### Guest Views (5 pages)
```
1. ✓ landing-page              → Public homepage
2. ✓ guest-enrollment          → Webcam/upload rosto
3. ✓ guest-gallery             → Grid de fotos
4. ✓ photo-detail              → Foto grande + botões
5. ✓ guest-checkout            → Carrinho + pagamento
6. ✓ guest-account             → Perfil + histórico
```

### Photographer Views (12 pages)
```
1. ✓ photographer-dashboard    → Overview vendas
2. ✓ event-list                → Lista de eventos
3. ✓ event-detail              → Fotos + analytics
4. ✓ event-settings            → Config (preço, marca d'água)
5. ✓ photo-grid                → Todas fotos
6. ✓ branding-page             → Customizar site
7. ✓ pricing-settings          → Preços por foto/album
8. ✓ sales-history             → Vendas table
9. ✓ payouts                   → Receber pagamentos
10.✓ photographer-account      → Perfil fotógrafo
11.✓ analytics-dashboard       → Gráficos vendas
12.✓ team-management           → Adicionar membros (pro+)
```

### Photographer Public Site (5 pages)
```
1. ✓ fotograxyz-homepage       → Landing customizado
2. ✓ fotograxyz-about          → Bio fotógrafo
3. ✓ fotograxyz-portfolio      → Showcase fotos
4. ✓ fotograxyz-events         → Próximos eventos
5. ✓ fotograxyz-contact        → Contato
```

### Admin Views (6 pages)
```
1. ✓ admin-dashboard           → Métricas globais
2. ✓ admin-photographers       → Gerenciar users
3. ✓ admin-support             → Tickets
4. ✓ admin-payments            → Transações
5. ✓ admin-moderation          → Revisar conteúdo
6. ✓ admin-analytics           → Relatórios
```

### Shared Pages (3 pages)
```
1. ✓ login                     → Login unificado
2. ✓ signup                    → Role selection
3. ✓ 404 / error               → Erro page
```

---

## 🎯 PRIORITY: MVP vs Future

### MVP (v0.2 - 2 meses)
```
ESSENCIAL:
  ✅ Guest enrollment + gallery
  ✅ Fotografo upload + event mgmt
  ✅ Photo detail + buy (Stripe)
  ✅ Basic photographer dashboard
  ✅ Fotograxyz customized site
  ✅ Basic plan (Starter/Pro)
```

### Phase 2 (v0.3 - 1 mês depois)
```
IMPACTANTE:
  ✅ Advanced analytics
  ✅ Team management
  ✅ Watermark customization
  ✅ Email templates
  ✅ Guest reviews/ratings
```

### Phase 3 (v0.4+)
```
NICE-TO-HAVE:
  ✅ API access
  ✅ White-label
  ✅ Custom integrations
  ✅ Advanced pricing (bundles, coupons)
  ✅ AI recommendations
```

---

## 📱 Responsive Design Notes

```
Desktop:
  ├─ Sidebar navigation (photographer)
  ├─ Full grid layouts
  └─ Multi-column dashboards

Tablet:
  ├─ Collapsible sidebar
  ├─ 2-column layouts
  └─ Touch-friendly buttons

Mobile:
  ├─ Hamburger menu
  ├─ 1-column layouts
  ├─ Bottom navigation (guest)
  └─ Large touch targets
```

---

## 🎨 Design System Considerations

### Color Scheme
```
Primary:       #3b82f6 (azul — keep from v0.1)
Success:       #10b981 (verde — vendas)
Warning:       #f59e0b (amarelo — alerts)
Danger:        #ef4444 (vermelho — errors)
Dark:          #1f2937 (cinza escuro)
Light:         #f9fafb (cinza claro)
```

### Typhography
```
Headings:      Inter Bold, 28px-48px
Body:          Inter Regular, 14px-16px
Code:          Mono, 12px
```

### Components to Standardize
```
✅ Buttons:          Primary, Secondary, Tertiary, Danger
✅ Cards:            Event card, Photo card, Stats card
✅ Forms:            Input, Select, Textarea, Upload
✅ Tables:           Sortable, Filterable, Paginated
✅ Modals:           Confirm, Alert, Form modal
✅ Notifications:    Toast, Badge, Alert banner
✅ Loaders:          Skeleton, Spinner, Progress
```

---

## 🔀 Navigation Patterns

### Guest Navigation (Bottom bar mobile, Top nav desktop)
```
├─ Gallery (home)
├─ Events
├─ Purchases
├─ Account
└─ Settings
```

### Photographer Navigation (Sidebar desktop, Hamburger mobile)
```
├─ Dashboard
├─ Events
├─ Photos
├─ Site
├─ Pricing
├─ Sales
├─ Payouts
├─ Analytics
├─ Account
└─ Help
```

### Admin Navigation (Sidebar)
```
├─ Dashboard
├─ Photographers
├─ Support
├─ Payments
├─ Moderation
├─ Analytics
└─ Settings
```

---

## ✅ Checklist Antes do Figma

- [ ] Alinhamento em planos (Starter/Pro/Enterprise)
- [ ] Confirmar preços em R$ ou USD
- [ ] Definir comissão da plataforma (20-30%)
- [ ] Stripe vs outra gateway de pagamento
- [ ] Email templates + triggers
- [ ] Watermark options
- [ ] Team permissions (Pro+)
- [ ] Custom domain vs subdomain
- [ ] Analytics KPIs principais
- [ ] Support system (ticketing)

---

**Pronto para Figma! 🎨**

Próximo passo: Designer cria wireframes + prototypes  
Depois: Dev implementa componentes + páginas  
Timeframe: 4-6 semanas para MVP


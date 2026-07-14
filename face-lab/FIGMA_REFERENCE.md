# 🎨 Figma Reference — Visual Components & Pages

**Para Designers**: Use este arquivo como guia pra montar o Figma  
**Versão**: v0.2  
**Tipografia**: Inter | **Cores**: Azul #3b82f6, Verde #10b981, Vermelho #ef4444

---

## 🎨 Design System

### Colors
```
Primary:       #3b82f6   (azul — actions, links)
Success:       #10b981   (verde — vendas, status positive)
Warning:       #f59e0b   (amarelo — alerts, pending)
Danger:        #ef4444   (vermelho — errors, refund)
Dark:          #1f2937   (background, text)
Light:         #f9fafb   (background alternativo)
Gray:          #6b7280   (text secundário)
```

### Typography
```
H1: Inter Bold 48px
H2: Inter Bold 36px
H3: Inter Bold 28px
H4: Inter Bold 24px
Body: Inter Regular 16px
Small: Inter Regular 14px
Caption: Inter Regular 12px
Mono: Fira Code 12px (códigos)
```

### Spacing System
```
4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
(padrão: múltiplos de 4)
```

### Border Radius
```
Small: 4px
Medium: 8px
Large: 12px
Full: 999px (pills, avatars)
```

---

## 🧩 Core Components (Reutilizáveis)

### Buttons
```
PRIMARY BUTTON
┌─────────────────┐
│  ✓ Add to Cart  │
└─────────────────┘
Color: #3b82f6
Hover: #2563eb (darker)
Active: #1d4ed8
Disabled: #d1d5db (gray)

SECONDARY BUTTON (outline)
┌─────────────────┐
│  View Photo     │
└─────────────────┘
Border: 2px #3b82f6
Color text: #3b82f6
Bg: transparent

SUCCESS BUTTON
┌─────────────────┐
│  ✓ Confirm      │
└─────────────────┘
Color: #10b981
(mesmo pattern: hover/active mais escuro)

DANGER BUTTON
┌─────────────────┐
│  Refund         │
└─────────────────┘
Color: #ef4444

Icon Buttons
┌─────┐
│ ❤️  │
└─────┘
24x24 square, padding: 8px
```

### Cards
```
Photo Card (Galeria)
┌─────────────────────────────┐
│ [Foto 300x300]             │
│                            │
│ R$ 50                  ❤️  │
│ "Summer Dress Photo"       │
│                            │
│ ┌─────────────┐ ┌────────┐│
│ │ Ver Detalhes│ │ Comprar││
│ └─────────────┘ └────────┘│
└─────────────────────────────┘
Hover: shadow increase, scale 0.98

Event Card (Photographer)
┌──────────────────────────────┐
│ [Capa] "Casamento João"     │
│                             │
│ 47 fotos · 12 pessoas       │
│ R$ 2.350 em vendas          │
│ ●●●●● (5 stars, 12 reviews) │
│                             │
│ [Edit] [View] [Analytics]   │
└──────────────────────────────┘

Stat Card (Dashboard)
┌──────────────────────┐
│ Revenue this month   │
│                      │
│ R$ 1.234,56         │
│ ↑ 24% vs last month  │ (green)
└──────────────────────┘
```

### Forms
```
Input Field
Label
[________________________]
Helper text or error message

Select Dropdown
[Starter Plan ▼]

Checkbox
☑ Auto-renew subscription

Radio Button
● Monthly
○ Yearly

Text Area
[_________________________]
[_________________________]
[_________________________]

Upload Area (drag & drop)
┌─────────────────────────┐
│     📁 Drag fotos aqui  │
│        ou clique         │
└─────────────────────────┘
```

### Navigation

**Top Bar (Guest)**
```
┌──────────────────────────────────────────────┐
│ FACE LAB  [Search] [Cart] [Account] [Menu]   │
└──────────────────────────────────────────────┘
```

**Sidebar (Photographer)**
```
┌─────────────────┐
│ FACE LAB        │
│━━━━━━━━━━━━━━━━│
│ Dashboard       │
│ Events          │ (active: azul)
│ Photos          │
│ Site            │
│ Sales           │
│ Payouts         │
│ Analytics       │
│ Account         │
│━━━━━━━━━━━━━━━━│
│ Help            │
│ Settings        │
│━━━━━━━━━━━━━━━━│
│ profile@email   │
│ Logout          │
└─────────────────┘
```

**Bottom Navigation (Mobile Guest)**
```
┌─────────────────────────────────────────────┐
│   🏠   📷   ❤️   🛒   👤                     │
│Gallery Photos Heart Cart Account            │
└─────────────────────────────────────────────┘
```

### Tables (Photographer Sales)
```
┌──────────────────────────────────────────────────────┐
│ Date      Photo               Price   Guest      Sts │
├──────────────────────────────────────────────────────┤
│ Jul 10    Summer Dress        R$ 50   João M.    ✓   │
│ Jul 10    Beach Portrait      R$ 50   Maria S.   ✓   │
│ Jul 9     Group Shot          R$ 35   Ana C.     ✓   │
│ Jul 9     (Failed Payment)    R$ 50   Pedro L.   ✗   │
└──────────────────────────────────────────────────────┘
Stripe on header, click to sort
Alternating row colors: white + #f9fafb
```

### Modals/Dialogs

**Purchase Confirmation**
```
┌─────────────────────────────────────────┐
│  ✓ Purchase Complete                  X │
├─────────────────────────────────────────┤
│                                         │
│  Your photos are ready to download!    │
│                                         │
│  📧 Check your email for link          │
│  Link expires in: 30 days               │
│                                         │
│  [View Downloads] [OK]                 │
│                                         │
└─────────────────────────────────────────┘
```

**Event Settings Modal**
```
┌──────────────────────────────────────────┐
│  Event Settings                        X │
├──────────────────────────────────────────┤
│                                          │
│ Event Name: Casamento João & Maria      │
│                                          │
│ Price per Photo:                         │
│ [50.00 BRL]                              │
│                                          │
│ Watermark Enabled:                       │
│ ☑ Yes                                    │
│                                          │
│ Discount for albums:                    │
│ [20%]  (off 5+ fotos)                   │
│                                          │
│ [Cancel] [Save Changes]                  │
│                                          │
└──────────────────────────────────────────┘
```

---

## 📱 Page Layouts (Wireframe Specs)

### 1. GUEST: Landing Page
```
Hero Section (full width)
┌──────────────────────────────────────────┐
│                                          │
│    FIND YOUR PHOTOS INSTANTLY            │
│  Using Facial Recognition                │
│                                          │
│      [Enter / Sign Up]                   │
│                                          │
│   "Events you attended" or "Browse"      │
│                                          │
└──────────────────────────────────────────┘

Value Props (3 columns)
┌──────────┬──────────┬──────────┐
│   🎯    │   ⚡    │   🎁    │
│ Instant │  Quick  │ Affordable
│         │ Reviews │           
└──────────┴──────────┴──────────┘

FAQ (accordion)
CTA: Sign Up

Social Proof
Testimonials
```

### 2. GUEST: Gallery (Photos)
```
Header
├─ Event name: "Casamento João & Maria"
├─ 47 photos · 12 people
├─ Photographer: João Photography
└─ 5 stars (24 reviews)

Grid Layout (responsive)
Mobile: 1 column
Tablet: 2 columns
Desktop: 3-4 columns

Each Photo Card:
[Photo 300x300]
R$ 50
"Photo title"
❤️ Button
[View Details] [Buy]

Pagination or infinite scroll
```

### 3. GUEST: Photo Detail
```
Header: Back to Gallery | Share | Report

Main Content
├─ Large Photo (800x600+)
├─ Photographer name + avatar
├─ Photo title
├─ Photo description
├─ Tags
└─ Price: R$ 50 in big

Actions
├─ ❤️ Add to Favorites
├─ [Add to Cart]
├─ [Buy Now]
└─ [View in Drive]

Comments/Reviews (bottom)
Suggested Similar Photos (carousel)
```

### 4. GUEST: Checkout
```
Progress: Step 1 of 2

Your Cart
┌───────────────────────────┐
│ Photo 1 | Summer Dress    │
│ R$ 50   | [Remove]        │
├───────────────────────────┤
│ Photo 2 | Beach Portrait  │
│ R$ 50   | [Remove]        │
├───────────────────────────┤
│                Subtotal: R$ 100.00
│                    Tax: R$ 0.00
│ [Promo Code]             ▼
│                   Total: R$ 100.00
│            [Proceed to Payment]
└───────────────────────────┘
```

### 5. PHOTOGRAPHER: Dashboard
```
Header: Welcome back, João! | Settings

Stats Row (4 columns)
├─ Revenue (this month): R$ 2.350
├─ Orders: 47
├─ Views: 1.240
└─ Conversion: 3.8%

Quick Actions (2 columns)
├─ [+ New Event]
├─ [Upload Photos]
├─ [View Site]
└─ [Invite Team]

Recent Sales (table)
Latest Reviews (list)

Bottom: Analytics CTA
```

### 6. PHOTOGRAPHER: Events
```
Header: Events | [+ New Event] | [Filters ▼]

Event Cards Grid (2-3 columns)
┌─────────────────────────────────┐
│ [Cover Image]                   │
│                                 │
│ Casamento João & Maria          │
│ 47 photos · R$ 2.350 sold       │
│ ●●●●● 5.0 (12 reviews)          │
│                                 │
│ [Edit] [View Gallery] [Delete]  │
└─────────────────────────────────┘

Status badge: Active / Draft / Archived
```

### 7. PHOTOGRAPHER: Branding
```
Header: Customize Your Site

Logo Upload
┌───────────────────────┐
│   [Upload Logo]       │ (drag & drop)
└───────────────────────┘

Colors
Primary Color: [#3b82f6] ◼
Secondary Color: [#ffffff] ◼

Social Links
Instagram: [joaophoto]
Facebook: [joaofotografia]
TikTok: [joao_photo]

Site URL
✓ joaophoto.face-lab.tech (taken)
[Upgrade to Custom Domain]

Preview (mobile + desktop)
[Save Changes]
```

### 8. PHOTOGRAPHER: Pricing
```
Header: Pricing & Discounts

Price per Photo
Price in BRL: [50.00]
Price in USD: [9.99]

Bundle Pricing
5 photos: 10% discount
10 photos: 15% discount
20+ photos: 20% discount

Promo Codes
┌──────────────────────────┐
│ Code: SUMMER20           │
│ Discount: 20%            │
│ Valid until: Aug 31      │ [Edit] [Delete]
├──────────────────────────┤
│ Code: NEWSLETTER15       │
│ Discount: 15%            │
│ Valid until: Dec 31      │ [Edit] [Delete]
└──────────────────────────┘

[+ Create Promo Code]
```

### 9. PHOTOGRAPHER: Sales Analytics
```
Header: Sales & Analytics

Timeframe Filter: [This Month ▼]

Charts (grid)
├─ Revenue Trend (line chart)
├─ Orders by Day (bar chart)
├─ Top Photos (top 5 list)
└─ Conversion Funnel (funnel chart)

Details Table
All sales with sorting/filtering
Export: [CSV] [PDF]
```

### 10. PHOTOGRAPHER: Payouts
```
Header: Earnings & Payouts

Current Balance
┌──────────────────────────┐
│  Available to Withdraw   │
│      R$ 5.234,56        │
│  [Schedule Payout]       │
└──────────────────────────┘

Payout History
┌──────────────────────────┐
│ Date     | Amount | Sts  │
├──────────────────────────┤
│ Jul 5    | R$ 2k  | ✓    │
│ Jun 5    | R$ 1.5k| ✓    │
│ May 5    | R$ 800 | ✓    │
└──────────────────────────┘

Setup Bank Account
[+ Connect Bank]
```

---

## 📐 Responsive Breakpoints

```
Mobile: < 640px
Tablet: 640px - 1024px
Desktop: > 1024px

Touch targets: minimum 44x44px
Spacing mobile: reduced by 25%
Column count: adjust per screen size
```

---

## 🎬 Animations & Interactions

```
Buttons:
  Hover: scale 1.05 + shadow increase
  Click: scale 0.95 (feedback)

Cards:
  Hover: shadow increase, slight lift

Modals:
  Open: fade in + scale from center
  Close: fade out

Transitions: all 200ms ease-in-out

Loading:
  Spinner: rotate animation
  Skeleton screens for async content
```

---

## ✅ Figma Layers Organization

```
Face Lab v0.2
├─ 🎨 Design System
│  ├─ Colors
│  ├─ Typography
│  └─ Components
├─ 📱 Guest
│  ├─ Landing
│  ├─ Enrollment
│  ├─ Gallery
│  ├─ Photo Detail
│  ├─ Checkout
│  └─ Account
├─ 🎥 Photographer
│  ├─ Dashboard
│  ├─ Events
│  ├─ Photos
│  ├─ Branding
│  ├─ Pricing
│  ├─ Sales
│  ├─ Payouts
│  └─ Account
├─ 🌐 Public Site
│  ├─ fotograxyz Homepage
│  ├─ About
│  ├─ Portfolio
│  ├─ Events
│  └─ Contact
├─ ⚙️  Admin
│  ├─ Dashboard
│  ├─ Photographers
│  ├─ Support
│  ├─ Payments
│  └─ Analytics
└─ 🔧 Shared
   ├─ Auth Login
   ├─ Auth Signup
   └─ 404 Error
```

---

**Ready to start designing in Figma! 🎨**

Use this as your reference while building wireframes. Keep components in a separate library for reuse.


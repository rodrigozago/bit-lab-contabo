# 🎨 DESIGN.md — Face Lab Visual Identity & UI System

**Para**: Gerar designs via LLM (Midjourney, DALL-E, Claude, etc)  
**Versão**: Gato-Veloz-v0.2  
**Estilo**: Moderno, clean, minimalista + tech-forward  
**Mood**: Confiança, velocidade, alegria (fotos reunindo pessoas)

---

## 🌈 Paleta de Cores

### Primária (Zentiq-inspired: Elegant & Minimal)
- **Preto Deep**: `#1a1a1a` — Headlines, primary text (elegância)
- **Branco Puro**: `#ffffff` — Backgrounds, spacious layouts
- **Ouro Sofisticado**: `#d4a574` — Accents, premium elements, hover states
  - Light: `#e8d4c0` (subtle accents)
  - Dark: `#8b7355` (hover on ouro)

### Secundária (Maintaining Functionality)
- **Verde Positivo**: `#2d5016` — Vendas, sucesso (darker, refined)
  - Light: `#7cb342` (action)
  - Dark: `#1b3a06` (emphasis)

- **Azul Sofisticado**: `#4a6fa5` — Links, secondary actions (museum-style blue)
  - Light: `#7b9fc7` (hover)
  - Dark: `#2c3e50` (emphasis)

- **Vermelho Erro**: `#a94442` — Errors, refund, delete (muted)
  - Light: `#d4a5a5`
  - Dark: `#6f2b2b`

### Neutros (Zentiq Palette)
- **Dark**: `#2a2a2a` — Text principal, strong contrast
- **Medium-Dark**: `#5a5a5a` — Text secundário
- **Medium**: `#8a8a8a` — Captions, helper text
- **Light**: `#d0d0d0` — Borders, subtle dividers
- **Very Light**: `#f5f5f5` — Section backgrounds, alternating
- **Off-White**: `#fafaf9` — Main background (warmer than pure white)

### Special (Premium Accents)
- **Gold Accent**: `#d4a574` — Highlights, premium actions, photographer badges
- **Platinum**: `#e8e8e8` — Divider lines, subtle separations
- **Gradient (Zentiq-style)**: `#1a1a1a` → `#2a2a2a` (dark headers)
- **Overlay**: `rgba(0,0,0,0.7)` — Photo overlays with text

---

## 🔤 Typography

### Font Family
**Inter** (Google Fonts)
- Regular: 400 weight
- Medium: 500 weight
- Bold: 700 weight
- Mono: Fira Code (for codes, prices)

### Scale & Hierarchy

**Display/Hero** (Landing Pages)
- Size: 48-64px
- Weight: Bold (700)
- Line height: 1.2
- Usage: Main titles, hero sections

**Heading 1** (Page Titles)
- Size: 36px
- Weight: Bold (700)
- Line height: 1.2
- Color: #1f2937

**Heading 2** (Section Titles)
- Size: 28px
- Weight: Bold (700)
- Line height: 1.3
- Color: #1f2937

**Heading 3** (Subsections)
- Size: 24px
- Weight: Bold (700)
- Line height: 1.4
- Color: #1f2937

**Body Text** (Paragraphs)
- Size: 16px
- Weight: Regular (400)
- Line height: 1.6
- Color: #1f2937
- Letter spacing: 0

**Body Small** (Descriptions)
- Size: 14px
- Weight: Regular (400)
- Line height: 1.5
- Color: #6b7280

**Caption** (Helpers, timestamps)
- Size: 12px
- Weight: Regular (400)
- Line height: 1.4
- Color: #9ca3af

**Button Text**
- Size: 14px
- Weight: Medium (500)
- Letter spacing: 0.5px
- Uppercase or title case (consistent)

---

## 🎯 Design Principles (Zentiq-Inspired: Gallery Elegance)

### 1. Gallery-First Elegance
- Photos are ART (not just content)
- Generous whitespace (museum-quality spacing)
- Minimal text, maximum visual impact
- Grid layouts with breathing room between pieces
- Dark backgrounds with light content OR light background with dark typography

### 2. Minimalist Sophistication (Zentiq DNA)
- Remove unnecessary elements
- High contrast (dark text on light OR vice versa)
- Elegant typography (Montserrat/Playfair for headings)
- Ouro accents for premium moments
- No busy patterns or gradients (only solid colors + photos)

### 3. Photo-Centric with Respect
- Photos are not thumbnails—they're the hero
- Full-width photo galleries on hero sections
- Generous padding around image grids (24-48px)
- Photos breathe (not cramped together)
- Light overlays for text-on-image (dark, translucent)

### 4. Trust Through Elegance
- Premium typography (sophisticated fonts)
- Plenty of whitespace = luxury feeling
- Consistent alignment (grid-based)
- Subtle animations (slow, elegant transitions)
- Gold accents for premium features (photographer profiles, selling options)

### 5. Facial Recognition Magic ✨ (Subtle)
- Soft glow around detected faces (not bright neon)
- Confidence shown as subtle badge (not percentage bar)
- Animation: Slow fade-in, not snappy
- Language: "We found you in..." not "Matched 87%"
- Make the magic invisible (just works, no showiness)

### 6. Flexible Pricing (Soft-Sell)
- Photos are FREE by default (prominent)
- Selling is OPTIONAL (photographer choice, not pushy)
- "This photo is available" (neutral language)
- Price shown elegantly below image (not banner)
- No urgent CTAs like "Buy Now!" (use "Acquire" or "Get")

---

## 🧩 Core Components

### Buttons (Zentiq Refined)

**Primary Button** (Action)
- Background: #d4a574 (Gold) or #4a6fa5 (Sophisticated blue)
- Text: White or #1a1a1a, 14px Bold
- Padding: 12px 24px
- Border radius: 6px (subtle, not rounded)
- Hover: Slightly darker shade, minimal shadow
- Active: Scale 0.98 (subtle feedback)
- Disabled: #d0d0d0 (light gray), opacity 0.6
- Icon + text: icon left, 8px gap
- NO background color change (solid is premium)

**Secondary Button** (Outline)
- Border: 2px solid #2a2a2a (dark outline)
- Background: Transparent
- Text: #1a1a1a, 14px Medium
- Hover: Background #f5f5f5 (very subtle)
- Same padding, radius as primary
- Usage: Less important actions

**Success Button** (Green)
- Background: #2d5016 (muted green)
- Text: White, 14px Bold
- Same styling as primary (substitute color)
- Usage: Confirm, Complete, Save

**Danger Button** (Red)
- Background: #a94442 (muted red)
- Text: White
- Usage: Delete, Refund, Cancel

**Ghost Button** (No background)
- Background: Transparent
- Text: #4a6fa5 (blue link) or #1a1a1a (dark)
- Border: none
- Hover: Text darker, no background
- Usage: Links, cancel actions, tertiary CTAs

**Icon Button** (Premium)
- 44x44px minimum (touch target)
- Padding: 8px
- Background on hover: #f5f5f5 (subtle)
- No text, just icon (24x24px)
- Color: #1a1a1a (dark)

### Cards

**Photo Card** (Gallery)
```
┌─────────────────────────┐
│ [Photo 300x300]         │
│ Aspect ratio: 1:1       │
│ Object-fit: cover       │
│ Border radius: 8px      │
├─────────────────────────┤
│ Title (16px Bold)       │
│ Description (14px gray) │
│ Price: R$ 50            │
│ Stars: ●●●●● 4.8 (12)   │
├─────────────────────────┤
│ [Button] [Button]       │
└─────────────────────────┘
Hover: Shadow increase (#00000015)
Transform: scale(1.02)
Transition: 200ms ease
```

**Event Card** (Photographer)
```
┌──────────────────────────┐
│ [Event Banner 400x200]   │
│ Overlay gradient bottom  │
│                          │
│ "Event Name"  (white)    │
│ "47 fotos · 12 people"   │
│ ★★★★★ 4.9 (24 reviews)  │
├──────────────────────────┤
│ Buttons: Edit | View All │
│ Status: [Active] [Paid]  │
└──────────────────────────┘
```

**Stat Card** (Dashboard)
```
┌──────────────────────┐
│ Revenue (gray label) │
│                      │
│ R$ 1.234,56 (large) │
│ ↑ 24% vs last month  │ (green)
│                      │
│ [Sparkline chart]    │
└──────────────────────┘
Background: #f9fafb
Border: 1px #e5e7eb
```

### Photo Grid

**Masonry Layout**
- Desktop: 3-4 columns (auto adjust)
- Tablet: 2 columns
- Mobile: 1 column
- Gap: 16px
- Images fill container
- Aspect ratios vary (natural)
- Lazy load images

**Grid Item Interaction**
- Hover: Overlay appears (gradient dark)
- Show: Price, rating, 2-3 action buttons
- Click: Opens lightbox or detail page
- Animation: Fade in overlay 200ms

### Forms

**Input Field**
```
Label (14px gray, above)
[___________________]
Border: 1px #e5e7eb
Border radius: 6px
Padding: 12px 16px
Font: 16px (prevents zoom on mobile)
Focus: Border #3b82f6, shadow #3b82f6 subtle
Filled: Background #f9fafb
```

**Select Dropdown**
```
[Selected Item ▼]
Border: 1px #e5e7eb
Icon: Chevron right (blue on hover)
Open: Dropdown below, z-index high
Options: Scroll if >6 items
```

**Checkbox**
```
☑ Unchecked: Empty box, 1px border #d1d5db
☑ Checked: Blue box #3b82f6, white checkmark
☑ Disabled: Gray box, opacity 0.5
Size: 20x20px (touch friendly)
Label: 14px regular, clickable area extends
```

**Upload Area** (Drag & drop)
```
┌─────────────────────────┐
│    📁 Arraste fotos     │
│       ou clique         │
│   (até 50 fotos)        │
│                         │
│ Aceita: JPG, PNG, WebP  │
│ Máx: 10MB cada          │
└─────────────────────────┘
Border: 2px dashed #d1d5db
Border radius: 12px
Hover: Border #3b82f6, background #eff6ff
Drag active: Background #dbeafe
```

### Navigation

**Top Navigation Bar** (Guest)
```
┌────────────────────────────────────────┐
│ FACE LAB  [Search]  [♥24] [🛒5] [≡]   │
└────────────────────────────────────────┘
Height: 64px
Background: White
Border bottom: 1px #e5e7eb
Sticky on scroll

Logo: 24px bold, blue #3b82f6
Search: Expandable input
Icons: 24x24, blue on hover
Menu: Hamburger (3 lines)
```

**Sidebar Navigation** (Photographer)
```
┌──────────────────┐
│ FACE LAB         │
│  Logo + text     │
├──────────────────┤
│ 📊 Dashboard     │ (active: blue bg)
│ 📅 Events        │
│ 🖼️  Photos        │
│ 🌐 Site          │
│ 💰 Sales         │
│ 💸 Payouts       │
│ 📈 Analytics     │
│ 👤 Account       │
├──────────────────┤
│ ❓ Help          │
│ ⚙️  Settings      │
├──────────────────┤
│ 👤 João Photo    │
│ Logout           │
└──────────────────┘
Width: 280px (desktop)
Collapse to icons: 80px (tablet)
Drawer: Mobile
Active item: Blue bg #eff6ff, blue text
```

### Tables

**Sales Table**
```
┌────────────────────────────────────────┐
│ Date    │ Photo      │ Price  │ Sts    │
├────────────────────────────────────────┤
│ Jul 10  │ Summer...  │ R$ 50  │ ✓      │
│ Jul 9   │ Beach...   │ R$ 50  │ ✓      │
│ Jul 9   │ Group...   │ R$ 35  │ ✗      │
└────────────────────────────────────────┘
Headers: 14px bold, light gray background
Rows: 14px regular, alternate #f9fafb
Border: Subtle 1px #e5e7eb
Hover row: #f3f4f6
Clickable rows: Cursor pointer
Sort: Chevron icon on header click
```

### Modals / Dialogs

**Purchase Success Modal**
```
┌──────────────────────────────────────┐
│ ✓ Compra Realizada!              X  │
├──────────────────────────────────────┤
│                                      │
│ 🎉 Suas fotos estão prontas!        │
│                                      │
│ Um link de download foi enviado     │
│ para seu email.                     │
│                                      │
│ Link válido por 30 dias             │
│                                      │
│        [Ver Downloads]  [OK]         │
│                                      │
└──────────────────────────────────────┘
Background: Semi-transparent dark overlay
Modal: White background, shadow, border-radius 12px
Icon: Large checkmark, green #10b981
```

---

## 📱 Page Layouts & Compositions

### 1. LANDING PAGE (Public, Zentiq Style)

**Hero Section** (Full viewport height on desktop)
```
Background: Dark #1a1a1a (solid black, not gradient)
OR Photo background (large, high-quality, faces in focus)

Content overlay (left 50%, generous padding):
┌─────────────────────────────────────┐
│ DISCOVER YOUR MOMENTS               │
│ Gallery-Quality Photography          │
│                                      │
│ Find yourself instantly in           │
│ beautifully curated photo galleries. │
│                                      │
│ [Explore Gallery] [Learn More]      │
│                                      │
│ ★★★★★ 4.9 (1200+ reviews)          │
│ "Elegant, effortless discovery"     │
│ — Professional Photographer          │
└─────────────────────────────────────┘

Right 50%: LARGE hero image (high-res, 3-4 faces in professional composition)
Photos fill space completely
NO gradient overlay (let photo speak)
```

**Value Proposition Section** (After scroll, Zentiq Minimal)
```
3 Columns (1 on mobile):
Background: White or #fafaf9
Generous padding: 64px top/bottom, 48px sides

Column 1:
📷 Icon (gold accent #d4a574)
Instant Discovery
"Find yourself in seconds
with AI facial recognition"
(14px body text, dark)

Column 2:
🎁 Icon (gold accent)
Flexible Pricing
"Free by default. Photographers
choose what to sell."
(clear, no hard sell)

Column 3:
✨ Icon (gold accent)
Professional Gallery
"Museum-quality presentation
of your moments"
(emphasis on aesthetic)

All text dark #1a1a1a
NO icons with emoji (use minimalist SVG icons)
NO busy graphics
```

**Social Proof**
```
Reviews slider (carousel):
"Love finding my photos!" — Maria S.
"Easy checkout!" — João M.
"Best investment!" — Ana P.

Stats row:
500K+ Photos Shared | 50K+ Users | 1M+ Downloads
```

**CTA Section** (Bottom hero)
```
Large centered:
Ready to find your photos?
[Sign Up Free] [Learn More]
```

---

### 2. GUEST: GALLERY

**Header**
```
Event Title: "Casamento João & Maria"
47 photos · 12 people
Photographer: João Photography ★ 4.9 (24)
Share: [WhatsApp] [Facebook] [Copy Link]
```

**Filter Bar** (Optional)
```
All People | [Person Name 1] | [Person Name 2] | ...
Or: Status: All | Free | Paid
```

**Grid Layout**
```
Masonry: 3-4 columns (desktop)
Each item:
[Image 400x400]
Title (if exists)
Price badge (top right):
  - Green: FREE
  - Blue: R$ 50 (if paid)
Overlay on hover:
  ❤️ (add favorite)
  [Detalhes] [Comprar]
```

---

### 3. GUEST: PHOTO DETAIL

**Main Content** (50% width desktop, full mobile)
```
Large Photo (800x600+)
Photographer avatar + name + "★ 4.9"
Photo title (24px)
Description (14px gray)
Tags: #bride #smile #detail

Actions:
❤️ Add Favorite | [Add to Cart] | [Buy Now]
View on Google Drive (link)
```

**Side Panel** (50% width, collapse on mobile)
```
PRICE INFO:
R$ 50.00
[Add to Cart] [Buy Now]

ABOUT THIS PHOTO:
Taken: July 10, 2026
Location: -23.5505, -46.6333
Format: JPG 4000x3000

PHOTOGRAPHER:
Avatar + name
4 other events
★ 4.9 (24 reviews)
[Follow] [Contact]

SIMILAR PHOTOS:
Grid of 3 similar photos (carousel)
```

---

### 4. PHOTOGRAPHER: DASHBOARD

**Welcome Header**
```
Welcome back, João! 👋
Current plan: Professional | [Upgrade]
```

**KPI Cards** (2-4 columns)
```
┌──────────────┐ ┌──────────────┐
│ This Month   │ │ Orders       │
│              │ │              │
│ R$ 2.350 ↑24%│ │      47      │
│              │ │     ↑ 12%    │
└──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐
│ Site Views   │ │ Conversion   │
│              │ │              │
│   1.240  ↑8% │ │    3.8%  ↑1.2│
│              │ │              │
└──────────────┘ └──────────────┘
```

**Quick Actions** (Buttons grid)
```
[+ New Event]  [Upload Photos]  [View Site]  [Invite Team]
Each: Large button, icon + text
```

**Recent Sales Table**
```
Latest 5 sales in table format
(See Tables section above)
```

**Reviews Carousel**
```
3 reviews side-by-side (swipe mobile)
Each: Name, stars, quote, date
```

---

### 5. PHOTOGRAPHER: EVENTS

**Header + Filter**
```
[+ New Event] | [Filter ▼] | [Sort ▼]
```

**Event Grid** (2-3 columns)
```
Each card:
[Cover image with overlay]
"Event Name"
47 photos · ★4.9 (12 reviews)
R$ 2.350 sold
[Status] [Stats]

[Edit] [View Gallery] [Delete]
```

---

### 6. PHOTOGRAPHER: BRANDING

**Left Panel** (50% width)
```
Logo Upload Area
Primary Color Picker (box with color)
Secondary Color Picker
Social Links inputs (Instagram, Facebook, etc)
Site URL info (fotograxyz.face-lab.tech)
[Save Changes] (sticky bottom)
```

**Right Panel** (50% width)
```
LIVE PREVIEW:
Mobile device mockup (left)
Desktop mockup (right)
Showing customized site in real-time
Updates as user types/changes
```

---

### 7. PHOTOGRAPHER: PRICING

**Price Settings** (Card layout)
```
Price per Photo (BRL)
[50.00]

Price per Photo (USD)
[9.99]

Bundle Discounts (toggle sections)
☑ 5 photos: 10% off
☑ 10 photos: 15% off
☑ 20+ photos: 20% off

[Save]
```

**Promo Codes Section**
```
Existing codes (table):
SUMMER20 | 20% | Valid until Aug 31 | [Edit] [Delete]
...

[+ Create New Code]
Modal opens to add code
```

---

### 8. PHOTOGRAPHER: SALES ANALYTICS

**Timeframe Selector**
```
[This Month ▼] | [Export CSV]
```

**Charts** (2 columns on desktop)
```
Chart 1: Revenue Trend (Line chart)
Y-axis: R$, X-axis: Days of month
Blue line with dots, filled area below

Chart 2: Orders by Day (Bar chart)
Y-axis: Count, X-axis: Days
Blue bars

Chart 3: Top Photos (List)
1. Summer Dress — 12 sold — R$ 600
2. Beach Portrait — 8 sold — R$ 400
3. Group Shot — 5 sold — R$ 175

Chart 4: Conversion Funnel
Views: 1.240
↓ Add to Cart: 320 (25.8%)
↓ Checkout: 85 (26.6%)
Completed: 47 (55.3%)
```

---

## 🎬 Animations & Interactions

### Button Interactions
```
Hover: Scale 1.05, shadow deepens
Click: Scale 0.95 (tactile feedback)
Disabled: No hover effect, opacity 0.5
Transition: 150ms cubic-bezier(0.2, 0, 0.38, 0.9)
```

### Photo Grid
```
Load: Fade in stagger (50ms between each)
Hover: Overlay slides up, buttons appear
Click: Expand to lightbox (fade scale animation)
Transition: 200ms ease
```

### Modal
```
Open: Fade in + scale from center (1.1 to 1)
Close: Reverse animation
Backdrop: Semi-transparent dark fade in
Transition: 250ms ease
```

### Loading States
```
Skeleton screens: Placeholder gray boxes
Pulse animation: 1s infinite opacity blink
Spinner: Rotating circle, blue color
Progress bar: Bar fills left-to-right
```

### Success States
```
Checkmark animation: Scale + rotate in 400ms
Confetti: Optional (fun touch)
Toast notification: Slide in from bottom
Auto-dismiss after 4s
```

---

## 🎨 Visual Style Guide

### Photography & Images (Zentiq Treatment)

**Photo Display Philosophy**
- Photos displayed at LARGE scales (not thumbnails)
- No filters—keep authentic (but color-corrected)
- High quality mandatory (4K or near-4K preferred)
- Maintain natural colors (warm skin tones, whites clean)
- High contrast: Dark vs light areas clear
- Sharp focus on faces (eyes are windows)
- Composition: Centered or rule-of-thirds rule-of-thirds

**Gallery Grid Spacing (Key Zentiq Element)**
- Grid gap: 32-48px (generous, museum-like spacing)
- Aspect ratios: Vary naturally (not forced square)
- Images fill container width on mobile
- Desktop: 3-column max (not cramped)
- Object-fit: cover (centered on faces)
- Lazy loading: Show soft placeholder first

**Image Overlay Text** (Zentiq elegant treatment)
```
Dark overlay: rgba(0,0,0,0.6)
Text color: White (high contrast)
Position: Bottom or center
Font: Elegant serif or light sans-serif
Size: 18-24px (readable from distance, like museum labels)
Animation on hover: Slow fade (300ms+)
```

**Photo Sizes**
- Hero: 1600x900+ (full-width, minimal padding)
- Gallery cards: 400x400 to 800x600 (maintain aspect)
- Thumbnail: 200x200 (preview, not primary view)
- Mobile: Full-width - 32px (breathing room)

**Placeholder State** (Skeleton)
```
Background: #f5f5f5 with subtle gradient
Skeleton shape: Gray box (#d0d0d0)
When loading: Gentle pulse (1.5s animation, opacity 0.5-1.0)
Icon: Optional subtle camera icon (gray, minimal)
No busy patterns—just clean placeholder
```

### Icons

**Style**
- Outline style (2px stroke)
- 24x24px base size
- Blue color (#3b82f6) by default
- White on colored backgrounds
- Simple, recognizable shapes

**Common Icons**
```
Dashboard: 📊
Events: 📅
Photos: 🖼️
Branding/Site: 🌐
Sales: 💰
Payouts: 💸
Analytics: 📈
Account: 👤
Help: ❓
Settings: ⚙️
Heart: ❤️
Cart: 🛒
Menu: ☰ (hamburger)
Search: 🔍
```

### Spacing & Layout

**8px Grid System**
- 8px, 16px, 24px, 32px, 48px, 64px (multiples of 8)
- Margins: 24px or 32px (section spacing)
- Padding: 12px, 16px, 24px (component padding)
- Gaps: 8px (tight), 16px (normal), 24px (loose)

**Whitespace**
- Generous breathing room around content
- Section padding: 64px top/bottom (desktop)
- Section padding: 32px top/bottom (mobile)
- Content max-width: 1200px (desktop)

---

## 📐 Responsive Design

### Desktop (1200px+)
- Full sidebar navigation (280px)
- 3-4 column grids
- Multi-column dashboards
- Side-by-side content panels
- Hover states visible

### Tablet (640-1200px)
- Collapsible sidebar (toggle icon visible)
- 2 column grids
- Content stacks vertically where needed
- Touch-friendly (44px+ targets)
- Reduced padding (24px sections)

### Mobile (< 640px)
- Hamburger menu (sidebar becomes drawer)
- 1 column layouts
- Full-width content
- Bottom navigation (for main actions)
- Large touch targets (48x48px minimum)
- Simplified dashboards (1 KPI per row)

---

## 🎭 Dark Mode (Native Zentiq Aesthetic)

Face Lab's default dark theme already implements dark mode elegantly:
```
Primary Background: #1a1a1a (elegant black)
Secondary Surface: #2a2a2a (dark gray)
Text Primary: #ffffff (white)
Text Secondary: #a0a0a0 (medium gray)
Borders: #404040 (subtle divider)
Accent: #d4a574 (gold, pops on dark)
Link Blue: #7b9fc7 (lighter blue for contrast)

Note: Light mode is also supported but dark is PREFERRED
(museum websites are often dark + gold)
```

---

## ✨ Special Design Elements

### "Recognition Magic" Visual Language (Zentiq Elegant)

**Face Detection Animation** (Subtle, Premium Feel)
```
When face is detected:
- Soft glow around face (gold #d4a574 or muted blue #7b9fc7)
- NO confidence percentage (keep it invisible)
- Minimal corner animations (fade in, not snappy)
- Complete silently (no fanfare)
- Professional feeling (not playful or loud)
```

**Match Confidence** (Subtle Indicators)
```
Low (0.3-0.5): Muted gray badge "Similar match"
Medium (0.5-0.7): Muted blue badge "Likely match"
High (0.7-1.0): Gold badge "Strong match"
NO percentage numbers (keep it mysterious)
```

**Photo Recognition Feedback** (Respectful Tone)
```
"We found you in 5 photos"
or
"This photo includes you"
or
Simply show the photo matched without explanation
Keep language refined, not conversational
NO emoji, NO exclamation marks
```

---

## 📊 Pricing Display

### Free Photos
```
Badge (top right): "FREE"
Background: Light green #d1fae5
Text: Dark green #065f46
No price shown
```

### Paid Photos
```
Price: "R$ 50"
Large (24px bold)
Color: Dark gray #1f2937
Below image or in card footer
Optional: Strikethrough original price (discount)
```

### Flexible Pricing Callout
```
"Fotografo escolhe os preços — muitas fotos são grátis!"
Small text, under filters
Reassures guests that not everything is paid
```

---

## 🚀 CTA Hierarchy (Most Important First)

1. **Primary**: [Buy Now] — Blue, large
2. **Secondary**: [Add to Cart] — Blue outline
3. **Tertiary**: [Add Favorite] — Icon button
4. **Ghost**: View on Drive — Text link

---

## 🎯 Accessibility Considerations

- Minimum color contrast: WCAG AA (4.5:1)
- Touch targets: 44px minimum
- Font sizes: 14px minimum (body text)
- Line height: 1.5+ (readability)
- Alt text: Describe photos (for screen readers)
- Skip links: Jump to main content
- Focus states: Visible outlines on all interactive elements

---

## 📋 Brand Voice in UI (Zentiq Elegance)

**Messaging Tone**
- Refined (not familiar, not corporate)
- Clear (no jargon, no business-speak)
- Positive (focus on artistry, not commerce)
- Respectful (treat photos as art, not merchandise)

**Button Labels**
- ✅ "Adquirir fotos" (elegant, not "Buy")
- ✅ "Salvar ao carrinho" (curate, not "add")
- ✅ "Descobrir galeria" (explore, not "browse")
- ❌ "Comprar" (too salesy)
- ❌ "Processar" (too technical)

**Calls to Action**
- "Discover your moments in our gallery"
- "Explore photography from {photographer}"
- "Save to collection" (not "Buy")
- "Elevate your photography business"

**Language for Photographers**
- "Professional tools for serious photographers"
- "Showcase your artistry with custom branding"
- "Premium support for creative professionals"

---

## 🎨 Visual Inspiration References (Zentiq-Inspired)

**Aesthetic to Match**
- Museum-quality presentation (gallery websites)
- Photography-first (Unsplash, 500px)
- Minimalist luxury (Hermès, Cartier web presence)
- Clean, high-contrast (Stripe, but darker & more elegant)

**Design System DNA**
- Dark blacks + whites (high contrast = premium)
- Gold accents (luxury touch)
- Generous whitespace (museum-like)
- Large imagery (photos are the hero)
- Slow animations (elegant, not snappy)
- No emoji or playful elements (serious aesthetic)

**Competitor Positioning**
- NOT like Pixieset (too corporate)
- NOT like Fotoify (too colorful/casual)
- Like high-end gallery software (aesthetic-first)

---

## ✅ Design Checklist for LLM Generation (Zentiq-Aligned)

When generating designs, ensure:

**Zentiq Principles**
- [ ] Photos are LARGE and prominent (not thumbnails)
- [ ] Dark backgrounds (#1a1a1a) with white/light text
- [ ] Gold (#d4a574) accents for premium moments
- [ ] Generous whitespace (museum-like breathing room)
- [ ] NO gradients (solid colors only)
- [ ] NO emoji or playful graphics
- [ ] High contrast text (WCAG AAA target)
- [ ] Slow, elegant animations (>300ms transitions)

**Functional Design**
- [ ] All buttons have clear, respectful labels
- [ ] Photos are hero elements (prominent, large, full-width)
- [ ] Color hierarchy is clear (gold for primary, blue for secondary, green for success)
- [ ] Whitespace is generous (48px+ section padding)
- [ ] Typography scale is obvious (clear hierarchy, no clutter)
- [ ] Icons are minimalist and consistent (not emoji)
- [ ] Interactive states are visible (hover, active, disabled)
- [ ] Mobile layout works (1 column, hamburger menu, large touch targets)
- [ ] Price displays are elegant (free badges, prices below images)
- [ ] AI magic is subtle (soft glows, not neon)
- [ ] Photographer branding is customizable (within Zentiq aesthetic)
- [ ] Trust signals visible (ratings, reviews, photographer name, gold accents)

---

**Ready to generate! Use these guidelines to create UI mockups, wireframes, or high-fidelity designs via LLM. 🎨**


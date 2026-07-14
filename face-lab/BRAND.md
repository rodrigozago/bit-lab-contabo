# Face Lab — Brand Guide

**Version:** Gato-Veloz-v0.2  
**Sources:** `context/input-DESIGN.md` (authoritative Face Lab tokens) · Zentiq ThemeForest museum/gallery theme previews (visual reference) · `https://preview.themeforest.net/item/zentiq-museum-artgallery-wordpress-theme/full_screen_preview/63632974`

Use this document as the single prose guide for autonomous design agents. Prefer measured tokens in `brand.json` over memory.

---

## Positioning

Face Lab is a **gallery-first photo product** for event guests and professional photographers. Guests discover themselves in curated galleries via quiet facial recognition; photographers sell optionally with soft-sell commerce.

**Style:** Modern, clean, minimal + tech-forward  
**Mood:** Confidence, speed, joy (people reunited in photos)  
**Aesthetic DNA:** Museum / art-gallery elegance (Zentiq) × product utility (Face Lab)

---

## Color system (seven roles)

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| background | Off-White | `#fafaf9` | Main canvas |
| surface | Very Light | `#f5f5f5` | Cards, sections, skeletons |
| foreground | Preto Deep | `#1a1a1a` | Headlines & body |
| muted | Medium Gray | `#8a8a8a` | Captions, helpers |
| border | Light Border | `#d0d0d0` | Rules, inputs |
| accent | Ouro Sofisticado | `#d4a574` | Premium actions, badges, recognition glow |
| accent-secondary | Azul Sofisticado | `#4a6fa5` | Links, secondary actions |

### Supporting tokens (product)

- Success: `#2d5016` / light `#7cb342`
- Error: `#a94442`
- FREE badge: bg `#d1fae5` · fg `#065f46`
- Gold hover: `#8b7355` · gold light: `#e8d4c0`
- Dark museum: bg `#1a1a1a` · surface `#2a2a2a` · border `#404040` · text `#ffffff` · muted `#a0a0a0`
- Photo overlay: `rgba(0,0,0,0.7)`

**Restraint:** Ouro Sofisticado is high-signal — at most 1–2 accent moments per view. No purple gradients. No large gold washes.

---

## Typography

- **Display & body:** Inter 400 / 500 / 700  
  Google Fonts: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap`
- **Mono (prices, codes):** Fira Code 400 / 500  
  Google Fonts: `https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap`

### Scale (product)

| Level | Size | Weight | Line-height |
| --- | --- | --- | --- |
| Display / Hero | 48–64px | 700 | 1.2 |
| H1 | 36px | 700 | 1.2 |
| H2 | 28px | 700 | 1.3 |
| H3 | 24px | 700 | 1.4 |
| Body | 16px | 400 | 1.6 |
| Small | 14px | 400 | 1.5 |
| Caption | 12px | 400 | 1.4 |
| Button | 14px | 500 | — · letter-spacing 0.5px |

---

## Voice & tone

**Adjectives:** refined · gallery-first · minimal · confident · soft-sell · museum-elegant

**Tone:** Refined (not familiar, not corporate). Clear (no jargon). Positive (artistry over commerce). Respectful (photos are art).

### Messaging pillars

1. Gallery-first elegance — photos are art with museum spacing  
2. Quiet AI — “We found you in…” not “Matched 87%”  
3. Soft-sell commerce — free by default; selling is optional  
4. Trust through craft — premium type, sparse gold, high contrast  

### Vocabulary

**Use:** Adquirir fotos · Salvar ao carrinho · Descobrir galeria · Discover your moments · Save to collection · This photo is available  

**Avoid:** Comprar / Buy Now! · Processar · Match percentages · urgent CTAs · emoji marketing · Feature One/Two filler  

---

## Imagery

- Large hero photography; natural aspect ratios; color-corrected authenticity  
- Grid gaps 32–48px; max ~3–4 columns desktop  
- Text on photos: dark translucent overlay + white labels (museum labels)  
- Subjects: exhibitions, artworks, people reunited, curated grids  
- Avoid: neon detection boxes, emoji grids, cramped thumbnails, purple gradients  

Samples live under `imagery/` (Zentiq ThemeForest preview plates).

---

## Layout posture

- Radius **8px** (buttons may use 6px); border **1px**  
- 8px baseline: 8 / 16 / 24 / 32 / 48 / 64  
- Section padding 64px desktop / 32px mobile; content max-width ~1200px  
- Touch targets ≥44px  
- Motion: 150–300ms+, elegant ease — never snappy gimmicks  
- Dark museum heroes for marketing; light Off-White for product utilities  
- Solid colors only — no rainbow gradients on chrome  

### Components (summary)

- **Primary button:** gold `#d4a574` or blue `#4a6fa5`, white/dark text, 12×24 padding  
- **Secondary:** 2px dark outline, transparent fill  
- **Photo card:** image hero, 16px bold title, gray meta, optional price, hover scale 1.02  
- **FREE badge:** light green + dark green text  
- **Recognition:** soft gold/blue glow; no confidence percentages  

---

## Logo

- Primary: `logos/header.svg` (Face Lab lockup — constructed; no official mark in source DESIGN.md)  
- Alternates: `logos/mark.svg`, `logos/wordmark-light.svg`, `logos/favicon.ico`  
- Use light wordmark on dark museum canvases  

---

## Do / Don’t

**Do**

- Lead with photography  
- Use gold sparingly for premium moments  
- Keep AI magic invisible  
- Prefer honest placeholders over invented stats  

**Don’t**

- Invent metrics (“10× faster”)  
- Use aggressive purple gradients or emoji feature icons  
- Cram grids or shrink museum photos into thumbnails  
- Hard-sell with urgency patterns  

---

## Implementation decisions (web v0.1)

Applied to `apps/web` (Julho 2026):

- **Primary button = near-black `#1a1a1a`** (Zentiq posture — black buttons on light canvas). Gold is *not* the default action color; it ships as the `premium` button variant and as sparse accent moments (restraint rule).
- **Blue `#4a6fa5`** drives the `link` button variant and *pending* recognition boxes.
- **Recognition (quiet AI):** confirmed face box = gold border + soft `#e8d4c0` glow; pending = translucent blue. Green removed from recognition UI entirely.
- **`--success` `#2d5016`** (renamed from `--ok`) for confirmations; `--success-light` `#7cb342` for large celebratory icons.
- **FREE badge** shipped as badge variant `free`; `premium` badge variant uses gold-light bg.
- **Fira Code and PriceTag deferred to v0.2 commerce** — `--font-mono` token slot reserved in the theme, font not loaded (no prices render in v0.1).
- **Dark museum** implemented as scoped `.dark-museum` class (Landing hero); product screens stay light Off-White.
- PWA assets regenerated: solid `#1a1a1a` icons, off-white wordmark, single gold underline bar; `theme_color` `#fafaf9`.

---

## Provenance notes

- Programmatic pass initially mis-mapped greens and tagline prose into color roles.  
- Enrichment reconciles **input-DESIGN.md** as authoritative Face Lab product system and **Zentiq preview imagery** for gallery posture.  
- Live ThemeForest `full_screen_preview` is Envato chrome; design language measured from theme-preview JPGs + pasted guide.

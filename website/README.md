# bit-lab.tech

Site principal da bit-lab. Next.js 16 (App Router) + Storyblok (headless CMS,
region EU) + GSAP/Lenis pro motion. Conteúdo 100% editável no Storyblok —
nenhuma página é hardcoded, incluindo a home.

UI inspirada em [2xa.studio](https://2xa.studio) e
[madewithgsap.com](https://madewithgsap.com): grid de 12 colunas, nav com
`mix-blend-mode: difference`, seções que alternam tema claro/escuro, grain
overlay, headlines gigantes com reveal por linha (SplitText), scroll suave
(Lenis). Ver `src/app/globals.css` pros tokens e `src/components/motion/`
pras primitivas de animação.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com os tokens do space (região EU)
npm run dev
```

## Modelo de conteúdo no Storyblok

Crie estes content types no space (Settings → já existente, região EU):

### Root content types

- **`page`** — `title` (text), `body` (blocks), `visibility` (single-option:
  `public` | `unlisted` | `private`), `seo_title`, `seo_description`,
  `og_image` (asset).
- **`project`** — igual `page`, mais `client`, `year`, `roles`, `stack`
  (texts), `cover` (asset), `gallery` (multi-asset), `excerpt` (textarea).
  Stories desse tipo devem viver na pasta `projetos/` (ex.:
  `projetos/abr-festival`) — o índice de projetos filtra por
  `starts_with: "projetos/"`.
- **`config`** — global, **uma única story** com slug `config` na raiz:
  `main_nav`, `footer_nav`, `socials` (blocks de `nav_link`: `label` + `link`),
  `contact_email` (text).

### Bloks nestable (usados dentro de `body`)

Todos com um campo `theme` (single-option `dark` | `light`, default `dark`)
que controla a seção alternar claro/escuro no scroll:

| Blok | Campos |
|---|---|
| `hero` | `eyebrow`, `headline`, `subline`, `cta_label`, `cta_link` |
| `stacked_headline` | `headline` (aceita quebras de linha) |
| `project_index` | `heading` — busca os `project` publicados sozinho |
| `feature_grid` | `heading`, `features` (blocks de `feature`: `title` + `description`) |
| `rich_text` | `content` (richtext) |
| `data_table` | `heading`, `headers` (texto "Col 1,Col 2,Col 3"), `rows` (blocks de `data_table_row`: `col_1..col_4`) |
| `cta` | `headline`, `label`, `link` |
| `logo_marquee` | `heading`, `logos` (blocks de `logo_item`: `name` + `logo`) |

### Stories obrigatórias pro site funcionar

- `home` (content type `page`) — a home.
- `config` (content type `config`) — menu e rodapé.

Qualquer outra story `page`/`project` vira rota automaticamente
(`/[full_slug]`) — não precisa mexer em código. O menu, porém, **não** é
gerado a partir da árvore de páginas: só aparece o que foi listado
manualmente em `config.main_nav`.

### Visibilidade

Campo `visibility` em `page`/`project`:

- `public` — normal, indexado, entra no sitemap.
- `unlisted` — acessível por URL direta, mas `noindex` e fora do sitemap.
  Útil pra página que existe mas não deve ser "descoberta".
- `private` — 404. É só o ponto de costura pra quando a autenticação real
  (bit-lab-auth) for ligada — ver `src/lib/access.ts`.

## Preview / Visual Editor

Em Settings → Visual Editor no space, configure a preview URL:

```
https://bit-lab.tech/preview?secret=<STORYBLOK_PREVIEW_SECRET>&slug={story.full_slug}
```

`STORYBLOK_PREVIEW_SECRET` é o mesmo valor do `.env`. Isso liga o Next
Draft Mode e redireciona pra rota real, onde o bridge do Storyblok assume.

## Webhook de revalidação

Em Settings → Webhooks, crie um pra `story.published` e `story.unpublished`
apontando pra:

```
https://bit-lab.tech/revalidate?secret=<STORYBLOK_WEBHOOK_SECRET>
```

Publicar/despublicar qualquer story derruba o cache de conteúdo
(`revalidateTag('cms', { expire: 0 })`) sem precisar de rebuild.

> As rotas de preview/revalidação ficam fora de `/api/` de propósito —
> `/api/` no domínio apex já é do opencdj-api (porta 3001, ver
> `nginx/bit-lab.tech.conf`) e engoliria qualquer coisa que o Next
> tentasse servir ali.

## Deploy (VPS)

```bash
cp .env.example .env   # na VPS, com os tokens de produção
sudo ./scripts/install.sh
```

O script builda a imagem Docker, sobe o container em `127.0.0.1:3008` e
instala `nginx/bit-lab.tech.conf` (proxy do domínio apex pra esse container,
mantendo `/opencdj` e `/api/` como já eram). Idempotente — pode rodar de
novo pra atualizar (`git pull && sudo ./scripts/install.sh`).

`nginx/www/index.html` (a landing estática antiga) deixa de ser servida
depois desse deploy, mas não foi apagada — `/precos`, servido pelo bloco
`studio.bit-lab.tech`, mora na mesma pasta (`nginx/www/precos/`) e continua
funcionando normalmente.

## Comandos

```bash
npm run dev     # dev server
npm run build   # build de produção (precisa dos tokens reais — generateStaticParams
                 #   busca as stories publicadas no Storyblok em build time)
npm run start   # roda o build
npm run lint    # eslint
```

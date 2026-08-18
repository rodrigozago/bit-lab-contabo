# Bordado Digital — Backlog Alpha

Índice de features para o teste alpha. Consolida o que já está implementado, o
que precisa melhorar e o que falta.

> **Tracking no Jira:** [projeto PONTO — Bordado Digital DEV](https://bit-lab.atlassian.net/browse/PONTO).
> Toda linha das tabelas abaixo tem uma issue correspondente (Epic por seção,
> Task por item ID). Use o Jira para status/atribuição durante a execução;
> este arquivo continua sendo a fonte de verdade do escopo e das decisões.

## Legenda

| | Significado |
|---|---|
| ✅ | Implementado e validado |
| 🔧 | Implementado, precisa melhorar/ajustar |
| ❌ | Falta (não implementado) |
| 🗣️ | Requisito a definir/discutir antes de executar |

**Prioridade:** `P0` = bloqueia o alpha · `P1` = importante no alpha · `P2` = pós-alpha.

> **Atualização (2026-08-17):** este documento estava bem atrasado em
> relação ao código — auth, admin, persistência e o player de exportação já
> tinham sido implementados sem atualizar as tabelas abaixo. Revisão feita
> lendo o código atual (`ponto-studio/apps/api`, `ponto-studio/apps/web`,
> `auth/`) nesta sessão; ver `SEGURANCA-PRE-LANCAMENTO.md` pro estado de
> segurança em paralelo.

---

## EPIC-AUTH — Autenticação & Acesso

| ID | Status | Prio | Item |
|----|--------|------|------|
| AUTH-1 | ✅ | — | **SSO in-app (BFF OIDC).** Implementado em `apps/api/src/routes/auth.ts` + `services/oidcClient.ts` + `services/session.ts` (`requireSession`). Rotas `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, `/api/me` funcionando, sessão via cookie. |
| AUTH-2 | ✅ | — | `bordado-digital` registrado como client OIDC em `auth/src/oidc.js` (secret via `BORDADO_DIGITAL_OIDC_SECRET`), app semeado em `auth/src/bootstrapAdmin.js`. |
| AUTH-3 | ✅ | — | Gate de login no front (`apps/web/src/lib/auth.ts`) — editor só abre logado. |
| AUTH-4 | ✅ | — | Gate nginx simplificado: `nginx/bordado.digital.conf` não usa mais `auth_request` — comentário no próprio arquivo confirma que o SSO in-app assumiu o controle de acesso. |
| AUTH-5 | ✅ | — | Ownership de projeto por usuário — `owner_id` em `db/schema.sql` + checagem de dono em `projectsRepo.ts` (depende de DATA-1, também ✅). |

## EPIC-ADMIN — Aprovação de contas

> **O modelo mudou desde que este epic foi escrito.** A ideia original era
> uma fila de solicitações (`access_requests`) com aprovação manual do
> admin por conta. Isso foi **abandonado** no `auth/` em favor de dois
> mecanismos mais simples, já implementados e compartilhados por todos os
> apps do bit-lab (não só o bordado-digital):
>
> 1. **Convites** — `signup_tokens` + `signup_token_apps`
>    (`auth/db/schema.sql`): o superuser gera um link de convite com role e
>    apps concedidos; uso único, com expiração.
> 2. **Self-signup por app** — coluna `apps.allow_self_signup` (default
>    `false`), ligável por app pelo superuser em
>    `apps.bit-lab.tech/admin/apps` (`auth/web/src/pages/admin/Apps.tsx` →
>    `PATCH /admin/api/apps/:id/self-signup` → `auth/src/models/apps.js`
>    `setSelfSignup`). Com a flag ligada, `POST /signup?app=bordado-digital`
>    (`auth/src/routes/auth.js`) cria a conta e **já concede** `app_access`
>    (`end_user`) na hora — sem fila, sem aprovação manual.
>
> **Decisão pro alpha (2026-08-17): self-signup aberto.** Qualquer pessoa
> pode criar conta e usar o Bordado Digital direto — sem convite, sem
> aprovação. Ação operacional: ligar `allow_self_signup` pra
> `bordado-digital` no painel admin (não é mudança de código).

| ID | Status | Prio | Item |
|----|--------|------|------|
| ~~ADMIN-1~~ | ❌ obsoleto | — | Fila de solicitações (`access_requests`) — não foi implementada, substituída pelo modelo de convite + self-signup acima. |
| ~~ADMIN-2~~ | ✅ (outro caminho) | — | Substituído: não existe "signup sem auto-grant" — o self-signup por app, quando ligado, sempre concede acesso na hora (é a decisão consciente do alpha). |
| ~~ADMIN-3~~ | ✅ (outro caminho) | — | Painel admin de convites/self-signup já existe em `auth/web/src/pages/admin/` — não há fila de aprovação porque não há mais fila. |
| ~~ADMIN-4~~ | ❌ obsoleto | — | Tela "aguardando aprovação" não é necessária — com self-signup aberto, o acesso é imediato. |
| ~~ADMIN-5~~ | ❌ obsoleto | — | Notificação de solicitação pendente — sem objeto, não há fila. |

## EPIC-EDITOR — Canvas & Ferramentas

| ID | Status | Prio | Item |
|----|--------|------|------|
| EDIT-1 | 🔧 | P0 | **Canvas mostra só as áreas em camadas (sem preview de ponto).** Reverter: a camada de bordado volta a exibir a **área chapada por cor** (não as linhas de ponto). Remover o refresh de preview ao vivo do canvas (`refreshPreview`/`useEffect` no `Editor.tsx`). A simulação de ponto migra para o modal de exportar (EXPORT-2). A infra server-side de preview (worker `preview` job + `/api/preview`) é **reaproveitada** lá. |
| EDIT-2 | 🔧 | P0 | **Ocultar ferramentas desnecessárias do tldraw.** Hoje `hideUi={false}` (UI completa). Manter só o essencial (selecionar/mover, e o desenho de área quando aplicável); esconder shapes de texto/nota/frame, menus e barras que não usamos. Via `components`/`overrides`/`tools` do tldraw ou UI própria. |
| EDIT-3 | ✅ | — | Camadas: Referência (imagem) + Bordado, com toggle de visibilidade e lock. |
| EDIT-4 | ✅ | — | Seleção sincronizada canvas ↔ lista de áreas; mover/redimensionar/apagar shape reflete no projeto. |
| EDIT-5 | 🔧 | P1 | **Fundo/branco não deveria virar área de bordado.** Na análise, a cor de fundo (quase branca) vira uma camada bordável. Auto-detectar e marcar como "não bordar" (ou remover), deixando só os traços. |
| EDIT-6 | 🔧 | P2 | Estados de carregamento/erro no editor (análise, preview, export) mais claros. |
| EDIT-7 | ❌ | P2 | Responsivo/mobile (o tldraw funciona, mas a UI lateral precisa de ajuste). |

## EPIC-IMPORT — Importação & Análise

| ID | Status | Prio | Item |
|----|--------|------|------|
| IMP-1 | ✅ | — | **Análise local (sem IA):** k-means (Lab) → vtracer `cutout` → 1 camada por cor, hole-aware, determinística. Sliders de nº de cores e "ignorar detalhes". |
| IMP-2 | ✅ | — | **Análise com IA (OpenRouter)** como alternativa no modal. |
| IMP-3 | ✅ | — | Cores iguais (mesmo desconectadas) = uma única camada de bordado. |
| IMP-4 | ✅ | — | Cache de análises no localStorage (reusa sem re-analisar). |
| IMP-5 | 🔧 | P1 | Pipeline afinado para logos/line-art (halos de anti-alias já tratados); validar com imagens reais do alpha e ajustar defaults. |
| IMP-6 | ❌ | P2 | Recorte/ajuste da imagem antes de analisar (crop, girar). |
| IMP-7 | ❌ | P1 | **Opção no modal de importar: "não importar o fundo como cor".** Checkbox na hora de importar; quando ligado, a cor de fundo detectada (ex.: a que toca as bordas / mais frequente) é descartada e **não** vira camada de bordado — sobram só os traços. Complementa o EDIT-5 (auto-detecção): aqui é o controle explícito do usuário. |

## EPIC-STITCH — Configuração de ponto

| ID | Status | Prio | Item |
|----|--------|------|------|
| STI-1 | ✅ | — | Painel de propriedades: tipo (cetim/tatami/corrido), cor do fio, densidade, ângulo. |
| STI-2 | 🔧 | P1 | Rever nomes/efeito real de cada tipo de ponto no resultado do worker (cetim hoje cai em `contour_fill`; validar consistência preview↔DST). |
| STI-3 | ❌ | P2 | Underlay, pull compensation e travas (recursos "de verdade" de digitalização). Pós-alpha. |
| STI-4 | ❌ | P2 | Ordenar/sequenciar camadas de bordado (ordem de costura, minimizar trocas de linha). |

## EPIC-EXPORT — Exportação & Simulação

| ID | Status | Prio | Item |
|----|--------|------|------|
| EXP-1 | ✅ | — | Exportar DST/PES/JEF (worker) + SVG (síncrono), com download. |
| EXP-2 | ✅ | — | **Player de simulação no modal de exportar** — implementado em `apps/web/src/components/StitchPlayer.tsx` + `ExportModal.tsx`, player e exportação na mesma janela conforme decidido. |
| EXP-3 | ✅ | — | Fill hole-aware (par-ímpar) → miolo de letras fica vazio no DST. |
| EXP-4 | ❌ | P1 | Estimativas no export: nº de pontos, trocas de cor, tempo aproximado, dimensões (mm) — como no visualizador DST de referência. |
| EXP-5 | ❌ | P2 | Escolha de bastidor/limites e aviso se o desenho extrapola. (Tamanho de bastidor já é escolhido no início.) |

### EXP-2 detalhado (a refinar) 🗣️

Player de simulação, baseado na sequência ordenada de pontos:
- **Dado**: o worker já monta o `EmbPattern` (pyembroidery) com pontos ordenados
  (`pattern.stitches`: x, y, comando). Expor um endpoint que devolve essa
  sequência (JSON) ou frames, reusando a infra de `preview`.
- **Front**: canvas/SVG que desenha os pontos até a posição do slider; controles
  play/pause, velocidade, ir para início/fim; cores por linha; destaque do
  ponto atual.
- **A decidir**: granularidade do slider (por ponto vs por bloco de cor), se
  mostra o "cabeçote" se movendo, e se roda 100% no front (recebe a sequência
  uma vez) ou pede frames ao worker.

## EPIC-DATA — Persistência & Projetos

| ID | Status | Prio | Item |
|----|--------|------|------|
| DATA-1 | ✅ | — | **Persistência real de projetos em Postgres**, com ownership por usuário — `db/schema.sql` (tabela `projects`, `owner_id`), `apps/api/src/services/projectsRepo.ts`. |
| DATA-2 | ❌ | P1 | Lista de projetos do usuário (criar/abrir/renomear/excluir vários). Hoje é 1 projeto por vez via localStorage. |
| DATA-3 | ✅ | — | Cache de análise no localStorage (mantém entre sessões). |
| DATA-4 | ✅ | — | **Versionamento/histórico do projeto** — tabela `project_versions` em `db/schema.sql`, snapshot automático com coalescing de 10min (`projectsRepo.ts`). Não estava nem listado na revisão anterior deste doc. |

## EPIC-INFRA — Infra & Deploy

| ID | Status | Prio | Item |
|----|--------|------|------|
| INF-1 | ✅ | — | Docker compose (web/api/worker/redis/postgres), portas em loopback, nginx `bordado.digital`, `install.sh`. |
| INF-2 | ✅ | — | Deploy do alpha na VPS já rodando (`git pull` + rebuild via `install.sh`). |
| INF-3 | ✅ | — | Postgres do ponto-studio em produção (serviço `postgres` no `docker-compose.yml`, depende de DATA-1 ✅). |
| INF-4 | 🔧 | P2 | Volume/limpeza de `exports/` e `uploads/` (arquivos de análise/preview/export acumulam) — `EXPORTS_TTL_HOURS`/`UPLOADS_TTL_HOURS` existem, confirmar que o cleanup roda de fato na VPS. |
| INF-5 | ✅ | — | **Headers de segurança no nginx** (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) adicionados em `nginx/bordado.digital.conf` e no bloco `auth.bit-lab.tech` de `nginx/bit-lab.tech.conf` (2026-08-17, ver `SEGURANCA-PRE-LANCAMENTO.md` item 8). `helmet` também adicionado ao serviço `auth` (antes só a API do ponto-studio tinha). |
| INF-6 | ⏳ ops | P1 | **Backups** de Postgres (auth + ponto-studio) e do volume `jwks` do auth — ainda não existe rotina. Fica pra uma próxima sessão (precisa decidir onde guardar, retenção, teste de restore). |

## EPIC-PLANOS — Cobrança

| ID | Status | Prio | Item |
|----|--------|------|------|
| PLAN-1 | ✅ | — | **Sem cobrança no alpha.** Nunca existiu billing real (Stripe etc.) — a landing (`apps/web/src/components/landing/pricing.tsx`) tinha uma tabela cosmética de 3 planos (Grátis/Pro R$29/Ateliê R$79) sem nenhum CTA funcional de pagamento. Substituída (2026-08-17) por uma seção única "gratuito durante o alpha". FAQ e navbar ajustados junto (removida a pergunta sobre cancelamento de plano pago). |

---

## Roteiro sugerido para o alpha (P0 primeiro)

1. ~~EDIT-1 + EDIT-2~~ — canvas limpo e tldraw enxuto (ver EPIC-EDITOR, ainda 🔧, não revisado nesta rodada).
2. ~~AUTH-1..5~~ — ✅ todo o epic concluído.
3. ~~ADMIN~~ — ✅ resolvido por outro caminho (convite + self-signup, ver EPIC-ADMIN acima).
4. ~~DATA-1, DATA-4~~ — ✅ persistência + versionamento concluídos.
5. ~~EXP-2~~ — ✅ player de simulação concluído.
6. ~~INF-2~~ — ✅ deploy do alpha rodando.
7. **Restante pro go-live**: EPIC-EDITOR (EDIT-1, EDIT-2, EDIT-5 ainda 🔧/❌ — não auditados nesta rodada, conferir estado real antes de assumir pendentes), INF-6 (backups).

---

## Decisões tomadas

- **ADMIN — modelo de acesso:** ✅ substituído por **convite (`signup_tokens`) +
  self-signup por app**. Para `bordado-digital`: **self-signup aberto**
  (qualquer um cria conta e usa na hora, sem aprovação) — decidido
  2026-08-17.
- **EXP-2 — player:** ✅ player + exportar na mesma janela (fluxo único).
- **PLAN-1 — cobrança:** ✅ sem planos pagos no alpha — acesso gratuito para
  todos.
- **Ordem de execução:** ✅ Auth + Admin concluídos primeiro, como planejado.

## Ainda a confirmar

- **INF-6 — backups:** rotina de backup de Postgres (auth + ponto-studio) e
  do volume `jwks` ainda não existe — decidir onde/como antes do go-live
  "de verdade" (o alpha pode rodar sem, mas é risco real de perda de dados).

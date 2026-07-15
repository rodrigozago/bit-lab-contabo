# Ponto Studio — Backlog Alpha

Índice de features para o teste alpha. Consolida o que já está implementado, o
que precisa melhorar e o que falta.

> **Tracking no Jira:** [projeto PONTO — Ponto Studio DEV](https://bit-lab.atlassian.net/browse/PONTO).
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

---

## EPIC-AUTH — Autenticação & Acesso

O ponto-studio hoje **não tem login** — qualquer um usa e os projetos são
anônimos. Para o alpha precisamos de identidade por usuário (projetos ficam
atrelados à conta) e controle de quem pode entrar.

| ID | Status | Prio | Item |
|----|--------|------|------|
| AUTH-1 | ❌ | P0 | **SSO in-app (padrão face-lab / BFF OIDC).** API vira o client OIDC confidencial (`openid-client`), a SPA nunca vê tokens. Rotas `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, `/api/me`. Sessão via cookie + Redis. Espelha `is_admin` do auth. |
| AUTH-2 | ❌ | P0 | **Registrar `ponto-studio` como client OIDC no serviço `auth`** (`auth/src/oidc.js`): `client_id: 'ponto-studio'`, secret via env `PONTO_STUDIO_OIDC_SECRET`, `redirect_uris` de prod + local. O app `ponto-studio` já está semeado em `bootstrapAdmin.js`. |
| AUTH-3 | ❌ | P0 | **Gate de login no front.** `AuthContext` + `useAuth` (igual `face-lab/apps/web/src/lib/auth.ts`), tela de login/redirect, e proteção do Editor (só entra logado). |
| AUTH-4 | 🔧 | P1 | **Ajustar o gate nginx de `ponto.bit-lab.tech`.** Hoje há `auth_request` no nginx (gate grosso de página). Com o SSO in-app, isso duplicaria o login → remover/relaxar o `auth_request` e deixar o app controlar (para conseguir mostrar telas de "aguardando aprovação"). |
| AUTH-5 | ❌ | P1 | **Ownership de projeto por usuário** (ver DATA-1). Sem isso, login não protege nada — qualquer logado veria qualquer projeto. |

## EPIC-ADMIN — Aprovação de contas 🗣️

Requisito citado: *"o admin deve permitir o uso da aplicação; o usuário pode
criar a conta, mas deve esperar o admin aprovar a solicitação"*.

Hoje o `auth` tem `ALLOW_SELF_SIGNUP` que **auto-concede** acesso (usado no
face-lab). Para o ponto-studio queremos o oposto: signup cria a conta mas
**NÃO** concede acesso; o admin aprova depois.

| ID | Status | Prio | Item |
|----|--------|------|------|
| ADMIN-1 | ✅🗣️ | P0 | **Modelo de "solicitação pendente" — DECIDIDO: fila de solicitações.** Tabela nova `access_requests(user_id, app_id, status, requested_at, decided_at, decided_by)`. O admin vê a fila explícita de pendentes com data e aprova/recusa. |
| ADMIN-2 | ❌ | P0 | **Signup sem auto-grant para ponto-studio.** Ajustar o fluxo de signup do `auth` para NÃO conceder `app_access` de ponto-studio automaticamente (diferente do face-lab). |
| ADMIN-3 | 🔧 | P0 | **Painel admin: fila de aprovação.** Estender `auth/src/routes/admin.js` para listar solicitações pendentes e aprovar/recusar (aprovar = `appAccess.grant`). O painel de usuários/apps/acessos já existe. |
| ADMIN-4 | ❌ | P1 | **Tela "aguardando aprovação" no app.** `/api/me` retorna se o usuário tem acesso a ponto-studio; se não, o front mostra "conta em análise" em vez do editor. |
| ADMIN-5 | ❌ | P2 | **Notificação ao admin** (e-mail/Slack) quando entra uma solicitação. Pós-alpha. |

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
| EXP-2 | 🔧🗣️ | P0 | **Modal de exportar vira um "player" de simulação.** Ao clicar em "Exportar bordado", abre uma janela com **pré-visualização interativa** + **slider avançar/retroceder** (estilo Cura/Creality) + play/pause/velocidade. **DECIDIDO:** o player e a escolha de formato/botão exportar convivem na **mesma janela** (fluxo único: visualiza e baixa ali). Detalhe abaixo. |
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
| DATA-1 | 🔧 | P0 | **Persistência real de projetos (hoje em memória).** A API guarda projetos num `Map` — some ao reiniciar o container. Migrar para Postgres, com **ownership por usuário** (depende de AUTH-1). |
| DATA-2 | ❌ | P1 | Lista de projetos do usuário (criar/abrir/renomear/excluir vários). Hoje é 1 projeto por vez via localStorage. |
| DATA-3 | ✅ | — | Cache de análise no localStorage (mantém entre sessões). |
| DATA-4 | ❌ | P2 | Versionamento/histórico do projeto. Pós-alpha. |

## EPIC-INFRA — Infra & Deploy

| ID | Status | Prio | Item |
|----|--------|------|------|
| INF-1 | ✅ | — | Docker compose (web/api/worker/redis), portas em loopback, nginx `ponto.bit-lab.tech`, `install.sh`. |
| INF-2 | 🔧 | P0 | **Deploy do alpha na VPS**: `git pull` + rebuild de `worker/api/web` (o erro `KeyError: 'svgFile'` era imagem worker desatualizada). Documentar o passo no `install.sh`. |
| INF-3 | ❌ | P1 | Postgres para o ponto-studio (depende de DATA-1). Pode reusar o padrão do `auth`/`face-lab`. |
| INF-4 | 🔧 | P2 | Volume/limpeza de `exports/` e `uploads/` (arquivos de análise/preview/export acumulam). |

---

## Roteiro sugerido para o alpha (P0 primeiro)

1. **EDIT-1 + EDIT-2** — canvas limpo (só áreas) e tldraw enxuto. _Rápido, alto impacto visual._
2. **AUTH-1..3 + AUTH-2** — SSO in-app (padrão face-lab) + registrar client no `auth`.
3. **ADMIN-1..3** — modelo de aprovação + signup sem auto-grant + fila no painel admin.
4. **DATA-1** — persistência + ownership por usuário (destrava AUTH-5 e ADMIN-4).
5. **EXP-2** — player de simulação no modal de exportar.
6. **INF-2** — deploy do alpha.

---

## Decisões tomadas

- **ADMIN-1 — modelo de aprovação:** ✅ **(A) Fila de solicitações** — tabela
  `access_requests` com a fila explícita de pendentes.
- **EXP-2 — player:** ✅ **player + exportar na mesma janela** (fluxo único).
  _A refinar durante a execução:_ granularidade do slider (ponto vs bloco de
  cor) e se a simulação roda no front (recebe a sequência uma vez) ou pede
  frames ao worker.
- **Ordem de execução:** ✅ começar por **Auth + Admin**.

## Ainda a confirmar

- **AUTH-4 — gate nginx:** remover o `auth_request` de `ponto.bit-lab.tech`
  quando o SSO in-app entrar (senão login duplo). Confirmar no deploy.

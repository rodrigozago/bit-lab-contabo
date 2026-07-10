# Face Lab — Mapa de Features

Documento vivo do que **existe hoje** na aplicação.

**Status**: 🔴 **CONGELADO PARA ALPHA** `Gato-Veloz-v0.1` (Julho 2026)

Atualize esta lista conforme features são adicionadas/mudam na próxima fase — é a fonte de verdade de escopo, não o README (que é setup/deploy).

📖 **Ver também**:
- [ALPHA_RELEASE.md](ALPHA_RELEASE.md) — escopo congelado, gaps conhecidos, critérios de aceitação
- [ALPHA_TESTERS.md](ALPHA_TESTERS.md) — guia de uso para testers
- [ALPHA_FLOW.md](ALPHA_FLOW.md) — diagramas visuais de fluxos

Última consolidação: com base no código em `face-lab/` nesta sessão (Julho 2026).

---

## 1. Atores e papéis

| Papel | Como se torna | Pode |
|---|---|---|
| **Guest** (convidado) | Padrão de qualquer conta nova | Cadastrar rosto, ver suas fotos, confirmar/rejeitar matches |
| **Producer** | Promovido por um admin (`/admin`) | Tudo do guest + conectar Google Drive, criar/escanear álbuns |
| **Admin** | `is_admin = true` no **bit-lab-auth** (não gerenciável no face-lab) | Tudo do producer + gerenciar papéis guest/producer, rematch, recluster, ver stats/uso |

Identidade vem 100% do SSO (`auth.bit-lab.tech`); `users.oidc_sub` referencia o `id` de lá. Não há senha própria no face-lab.

---

## 2. Autenticação & SSO

- **OIDC completo** (Authorization Code + PKCE) contra o `bit-lab-auth`, com o face-lab como client registrado (`auth/src/oidc.js`).
- Padrão **BFF**: a API troca o code por tokens; a SPA nunca vê tokens. Sessão própria via cookie **host-only** `fl_session` (Redis), separado do `bl_session` do auth.
- **SSO de verdade**: se o usuário já tem `bl_session` válida em qualquer app `*.bit-lab.tech`, o login no face-lab não mostra tela nenhuma (rota `/interaction/:uid` do auth reconhece a sessão).
- **Signup self-service** (`ALLOW_SELF_SIGNUP` no auth) — guest cria a própria conta.
- **Espelhamento de admin**: `is_admin` do auth é copiado pro `role` do face-lab a cada login (ganhou lá → vira admin aqui; perdeu → volta a guest). Admin nunca é editável na UI do face-lab.
- **Logout SSO real**: desloga do face-lab **e** do auth (`bl_session` + sessão do oidc-provider), evitando re-login silencioso.
- Endpoints: `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/logout`, `GET /api/me`.

## 3. Enrollment (cadastro de rosto do guest)

- Wizard em `/enroll` com captura guiada por **webcam** (`getUserMedia`) em 4 passos (frente/esquerda/direita/sorriso) **ou** upload manual de 3–8 fotos como fallback.
- Envio multipart → job assíncrono no worker → gera **1 embedding médio** (ArcFace 512-d, re-normalizado) a partir dos frames válidos (exige exatamente 1 rosto detectado por frame).
- Enrollment novo desativa o anterior (`active=false`); só 1 ativo por usuário.
- Ao concluir, casa automaticamente contra **todas as faces já indexadas** em todos os álbuns (`matchEnrollment`).
- Estados: `pending → done | error`, com feedback de qualidade (ex: "nenhum rosto encontrado", "mais de um rosto no quadro").
- `DELETE /api/enrollment/:id` — remove o embedding e os matches automáticos associados (privacidade).
- Rate limit dedicado (`RATE_LIMIT_ENROLL_PER_MIN`, default 10/min).

## 4. Producer — Google Drive & Álbuns

- **OAuth do producer com o Google** (`drive.readonly`, `access_type=offline`, refresh token persistido **criptografado** AES-256-GCM). Fotos originais nunca saem do Drive do producer.
- Fluxo: `GET /api/google/connect` → consentimento Google → `GET /api/google/callback` salva credencial → `GET /api/google/status` / `DELETE /api/google` (desconectar).
- ⚠️ **Gap conhecido**: a UI (`Producer.tsx`) espera `googlePicture` no status, mas a API (`getGoogleStatus`) não retorna esse campo hoje — o avatar cai no fallback (inicial do e-mail). Não requisitamos o scope `profile`.
- **Criar álbum**: nome + link de pasta do Drive (`POST /api/albums`). Valida a pasta via Drive API e **avisa** se ela não está compartilhada como "qualquer pessoa com o link" (necessário pros downloads dos guests) — não bloqueia a criação.
- CRUD: `GET/PATCH/DELETE /api/albums/:id`, listagem `GET /api/albums`.
- **Scan** (`POST /api/albums/:id/scan`): orquestrador lista os arquivos de imagem da pasta (paginado), faz upsert incremental (`UNIQUE(album_id, drive_file_id)` — rescans só pegam arquivos novos), baixa cada foto pra `/media/incoming`, enfileira job de processamento, **apaga o original após processar**.
- Scan é **assíncrono e enfileirado com rate limit** — não falha sob carga, só desacelera (`waitForPhotoSlot`, `RATE_LIMIT_PRODUCER_PER_MIN` / `RATE_LIMIT_GLOBAL_PER_MIN`).
- Progresso em tempo real: `GET /api/albums/:id/scan-status` (pending/processing/done/errors), pollado pela UI a cada 2.5s até o álbum ficar `ready`.
- **Gatilho é manual** — não há worker vigiando a pasta do Drive; fotos novas só entram quando o producer clica em "Re-escanear" (ver seção Gaps/Backlog).
- Listagem de fotos do álbum com filtro por pessoa: `GET /api/albums/:id/photos?personId=`.

## 5. Pipeline de reconhecimento facial (worker Python, CPU-only)

- **InsightFace `buffalo_l`** (detector SCRFD + embeddings ArcFace 512-d) em `onnxruntime` CPU — sem dependência de GPU (VPS não tem).
- Modelo carregado **uma vez** no boot do worker (~600MB), fila Redis (`facelab:jobs` → `facelab:results`), mesmo padrão pub/sub do worker do ponto-studio.
- Por foto: EXIF-transpose, downscale pra detecção em fotos grandes (bbox reescalado de volta), descarta detecções com `det_score < DET_SCORE_MIN` (default 0.5, configurável), gera **thumb 1024px** webp + **crop por rosto** (bbox+25% margem) webp.
- Job `process_photo`: 1 foto → N faces com bbox, score, crop, embedding.
- Job `enroll`: N frames de webcam → 1 embedding médio.
- Originais (`/media/incoming`) e frames de enrollment são **sempre apagados** após o processamento — nunca persistem.

## 6. Pessoas (clustering) — agrupamento automático

- Cada face nova é comparada com os **centroides das pessoas já existentes no álbum** (pgvector, distância de cosseno); se ≤ `CLUSTER_DISTANCE_THRESHOLD` (default 0.45) entra no cluster e o centroide é recalculado (média L2-normalizada); senão vira pessoa nova. Acontece **automaticamente** a cada foto processada, antes do matching.
- `GET /api/albums/:id/people` — lista pessoas do álbum com foto de capa (`cover_face_id`) e contagens; UI mostra como faixa de avatares clicáveis que filtram o grid.
- `AlbumSummary.peopleCount` — o card do álbum mostra "N fotos · **M pessoas** · P rostos" (resolve o problema de contar ocorrências em vez de pessoas).
- **Recluster** (`POST /api/admin/recluster[?albumId=]`, admin): reagrupa do zero — usado tanto pra *backfill* de álbuns escaneados antes de existir clustering quanto pra re-tunar o threshold.

## 7. Matching (foto ↔ usuário) e "treino"

- Matches são **pré-computados** (não calculados em toda leitura de galeria): inseridos no momento em que a foto é processada ou o enrollment/confirmação acontece.
- **Conjunto de referência de cada usuário** = embedding do enrollment ativo **+ até 10 faces confirmadas** mais recentes ("sou eu"). Ou seja, cada confirmação melhora a cobertura de matches futuros — é o "treino" sem retreinar modelo nenhum.
- Threshold `MATCH_DISTANCE_THRESHOLD` (default 0.4, cosseno) — ajustável por env.
- **"Sou eu"** (`POST /api/my/matches/:faceId/confirm`): marca o match como `confirmed` e expande em duas frentes:
  1. propaga pra todas as faces da mesma **pessoa** no álbum (ganho imediato);
  2. roda a face confirmada como probe **global** contra todos os álbuns (acha fotos noutros eventos).
- **"Não sou eu"** (`POST /api/my/matches/:faceId/reject`): rejeita a **pessoa inteira**, não só a foto — registra em `rejected_people` (por usuário+pessoa), então faces futuras daquele cluster nunca mais casam com esse usuário, nem após rematch.
- `POST /api/admin/rematch` (admin) — recalcula todos os matches `auto` (preserva `confirmed`/`rejected`), útil após mudar o threshold.

## 8. Galeria do guest

- `GET /api/my/albums` — álbuns onde o usuário tem ≥1 match não-rejeitado, com **capa** (thumb de uma foto recente em que ele aparece) e contagem.
- `GET /api/my/albums/:id/photos` — grid **masonry** com bbox do rosto sobreposto na foto (quadrado preto = auto, verde = confirmado), distância exibida, ações "Sou eu" / "Não sou eu" / Baixar / Ver no Drive.
- Dialog de detalhe (`PhotoDialog`) ao clicar na foto: imagem grande + mesmas ações.
- Links de download/visualização apontam direto pro Google Drive do producer (`webContentLink` / `webViewLink`) — o face-lab nunca hospeda a foto original.

## 9. Mídia — acesso controlado

- `/api/media/thumbs/:file` e `/api/media/crops/:file` exigem sessão e checam autorização: dono do álbum, admin, **ou** usuário com match (não-rejeitado) naquela foto/face. Ninguém acessa thumb/crop de terceiros por URL direta.

## 10. Admin

- `GET /api/admin/users` + `PATCH /api/admin/users/:id/role` (só guest↔producer; admin é somente-leitura aqui, gerenciado no auth).
- `GET /api/admin/stats` — contagens globais (usuários, álbuns, fotos, rostos, matches, enrollments, uso 24h/total) + limites/thresholds atuais.
- `GET /api/admin/usage?producerId=&days=` — série de uso por producer/dia (base pra billing futuro).
- Botões de **Rematch** e **Recluster** com feedback (toast) do resultado.

## 11. Rate limiting & uso (base para planos futuros)

- Janelas fixas de 1 min no Redis: `RATE_LIMIT_PRODUCER_PER_MIN` (30), `RATE_LIMIT_GLOBAL_PER_MIN` (60), `RATE_LIMIT_ENROLL_PER_MIN` (10) — hoje só pra conter testes, não há billing real.
- `usage_events` — 1 linha por foto processada / enrollment concluído, com `user_id` (dono/producer) e `album_id`. Não é consumido por nada além do `/api/admin/usage` ainda.

## 12. UI / Design system

- **Tailwind v4** + componentes **shadcn** vendorados (`button`, `card`, `badge`, `input`, `label`, `select`, `sheet`, `dialog`, `table`, `progress`, `avatar`, `skeleton`, `sonner`).
- Tema **light único**, minimalista (preto/branco, fonte Inter self-hosted), inspirado nas refs em `image-refs/`.
- **Layout com sidebar fixa** (desktop) que vira **drawer via hamburger** (mobile) — nav filtrada por papel (guest vê Minhas Fotos/Meu Rosto; producer ganha Álbuns; admin ganha Admin).
- Grid **masonry** nas galerias, skeletons de loading, toasts (sonner) para feedback de ações.
- Sem dark mode (decisão consciente — pedido era light).

---

## 13. Modelo de dados (tabelas)

`users` · `google_credentials` · `albums` · `photos` · `faces` (+ `person_id`) · `people` · `rejected_people` · `enrollments` · `matches` · `usage_events`. Ver [db/schema.sql](db/schema.sql) — comentado e é a fonte de verdade (aplicado idempotentemente a cada boot da API).

---

## 14. Gaps conhecidos (não implementado ainda)

Coisas que já discutimos e ficaram como decisão consciente de adiar, ou bugs pequenos pendentes:

- **Sem notificação de match novo.** O match é automático e silencioso — o usuário só descobre fotos novas abrindo o app. Nada de badge "N fotos novas", nem e-mail.
- **Sem re-scan periódico.** O scan só roda quando o producer clica; fotos novas na pasta do Drive não entram sozinhas.
- **`googlePicture` quebrado.** UI espera o campo, API não retorna (nem pedimos o scope `profile` no Google OAuth). Avatar cai pro fallback.
- **Sem verificação de índice vetorial.** `faces.embedding` não tem índice HNSW/IVFFlat — ok até ~100k faces (scan exato), mas vai precisar antes de escalar.
- **Sem paginação** nas listagens de fotos/álbuns/usuários — tudo carrega de uma vez (ok pro volume de alpha, não pra produção com muitos álbuns grandes).
- **Refresh token do Google expira em 7 dias** enquanto o app OAuth estiver em modo "Testing" no Google Cloud Console — precisa publicar o app (ou aceitar reconexões periódicas) antes do alpha com producers reais.
- **Sem testes automatizados** (unit/integration/e2e) em nenhuma camada.

---

## 15. Backlog / candidatos para a próxima fase

*(espaço para você preencher com o que quer adicionar — meta é revisar isso junto e priorizar antes do alpha)*

- [ ]
- [ ]
- [ ]

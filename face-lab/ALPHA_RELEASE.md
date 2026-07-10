# Face Lab — Alpha Release 🐱 "Gato-Veloz-v0.1"

**Data de Release**: Julho 2026  
**Versão**: `Gato-Veloz-v0.1`  
**Status**: 🔴 ALPHA — fase inicial, apenas para testers selecionados  
**URL**: https://face.bit-lab.tech

---

## O que é Face Lab?

Face Lab é uma plataforma de **indexação e compartilhamento de fotos por reconhecimento facial**.

- **Producers** conectam seu Google Drive, criam álbuns a partir de pastas e disparam scans de fotos
- **Guests** cadastram seu rosto pela webcam e recebem automaticamente todas as fotos em que aparecem
- As fotos originais **nunca são armazenadas aqui** — apenas miniaturas, recortes de rosto, embeddings vetoriais e links do Drive

---

## 📋 Escopo Congelado para o Alpha "Gato-Veloz"

### ✅ Funcionalidades Implementadas

#### 1. **Autenticação & Papéis**
- Login SSO completo via OIDC (`auth.bit-lab.tech`)
- Três papéis: **Guest**, **Producer**, **Admin**
- Self-signup para guests (contas novas entram como convidado)
- Logout SSO real (desconecta aqui + no auth central)

#### 2. **Enrollment — Cadastro de Rosto**
- Wizard em 4 passos guiado por webcam: frente → esquerda → direita → sorriso
- **Fallback**: upload manual de 3–8 fotos para quem não quer usar câmera
- Validação de qualidade: rejeita frames sem exatamente 1 rosto
- Matching automático contra todas as faces já indexadas
- Rate limit: max 10 enrollments por usuário por minuto
- **Privacidade**: frames de webcam são descartados após o processamento

#### 3. **Producer — Google Drive & Álbuns**
- Conectar conta Google (OAuth, `drive.readonly`)
- Criar álbuns a partir de pastas do Drive por link
- Scan manual de fotos com botão "Re-escanear"
- Progresso em tempo real do scan (polling a cada 2.5s)
- CRUD completo de álbuns
- Rate limit: max 30 fotos/min por producer, 60 globais

#### 4. **Reconhecimento Facial**
- Model: **InsightFace Buffalo-L** (detector SCRFD + embeddings ArcFace 512-d)
- CPU-only (sem GPU), via onnxruntime
- Por foto: threshold de confiança (det_score ≥ 0.5), gera thumb 1024px + crop por rosto
- **Privacidade**: fotos originais são apagadas após processamento

#### 5. **Clustering — Agrupamento de Pessoas**
- Novo rosto → comparado com centroides de pessoas existentes (pgvector, cosseno)
- Se distância ≤ 0.45, entra no cluster; senão vira pessoa nova
- Centroide recalculado a cada nova face
- Endpoint: `GET /api/albums/:id/people` com fotos de capa

#### 6. **Matching & "Treino"**
- Matches pré-computados, não em tempo real
- **Referência do usuário** = embedding do enrollment ativo + até 10 faces confirmadas
- Confirmações ("Sou eu") expandem para toda a pessoa no álbum + buscam em outros álbuns
- Rejeições ("Não sou eu") descartam a pessoa inteira (futuros matches ignoram)
- Threshold de match: distância cosseno ≤ 0.4 (ajustável)
- Admin pode forçar rematch global

#### 7. **Galeria do Guest**
- Listagem de álbuns onde tem matches
- Grid masonry com bbox de rosto sobreposto
- Cores: quadrado preto = match automático, verde = confirmado
- Ações por foto: "Sou eu" / "Não sou eu" / Baixar / Ver no Drive
- Links apontam direto pro Google Drive (face-lab não hospeda originais)

#### 8. **Admin**
- Promoção guest ↔ producer (admin é somente-leitura, gerenciado no auth)
- Stats globais: usuários, álbuns, fotos, rostos, matches, enrollments
- Série de uso por producer/dia (base para billing futuro)
- Botões: Rematch global, Recluster por álbum

#### 9. **Design & UX**
- Tailwind v4 + componentes shadcn vendorados
- Tema light único, minimalista (preto/branco)
- Sidebar fixa (desktop) → drawer hamburger (mobile)
- Masonry grids, skeletons, toasts (sonner)

#### 10. **PWA (Progressive Web App)** ✨ *novo*
- Installável como app nativo em desktop e mobile
- Service Worker para funcionamento offline
- Cache inteligente (static-first, network fallback)
- Manifest com logos customizados "FACE LAB"
- Meta tags de mobilidade (iOS/Android)

---

## ⚠️ Gaps Conhecidos — Não entram no Alpha

Conscientemente adiados para fases futuras:

| Gap | Por que não agora | Impacto |
|---|---|---|
| **Notificação de match novo** | Requer infra de push (Firebase, etc). Hoje usuário descobre abrindo app | Baixo (workflow é assíncrono) |
| **Re-scan periódico automático** | Scan só roda com clique manual | Aceitável (producer controla quando) |
| **Avatar Google** (`googlePicture`) | OAuth scope `profile` não solicitado; UI cai no fallback (inicial do e-mail) | Cosméticco |
| **Índice vetorial (HNSW/IVFFlat)** | Scan exato ok até ~100k faces; não necessário pro volume alpha | Escalabilidade futura |
| **Paginação** | Tudo carrega de uma vez (ok pro alpha) | Escalabilidade futura |
| **Refresh token Google** | Expira em 7 dias (modo Testing); requer publicação do app ou reconexões periódicas | Aceito pro alpha (reconexão manual) |
| **Testes automatizados** | Cobertura zero (unit/integration/e2e) | Risco técnico, aceitável para alpha |

---

## 🎯 Critérios de Aceitação para o Alpha

**Este release é considerado completo quando:**

- ✅ SSO está funcionando (login via auth.bit-lab.tech)
- ✅ Guest consegue fazer enrollment de rosto com webcam OU upload manual
- ✅ Producer consegue conectar Google Drive e criar álbum
- ✅ Scan encontra e processa fotos (cria thumbs + crops + embeddings)
- ✅ Matching automático funciona (faces se casam após scan)
- ✅ Guest vê suas fotos na galeria e consegue confirmar/rejeitar
- ✅ Admin consegue promover users e forçar rematch
- ✅ PWA está instalável em desktop e mobile
- ✅ Performance aceitável (scan < 1min para 50 fotos)
- ✅ Erros são capturados e logados (Rollbar)

---

## 📦 Stack Técnico (Congelado)

| Camada | Tecnologia | Versão | Porta |
|---|---|---|---|
| **Frontend** | React 18 + Vite | LTS | 5173 (dev) / :3004 (prod) |
| **Backend** | Fastify 4 + TypeScript | LTS | 4003 |
| **Banco** | PostgreSQL 16 + pgvector | — | interno |
| **Cache** | Redis | — | interno |
| **IA** | InsightFace (buffalo_l) + onnxruntime | CPU | worker async |
| **Autenticação** | OIDC (bit-lab-auth) | — | externo |
| **SSO** | bit-lab-auth | — | externo |

---

## 📝 Checklist para Testers

- [ ] Consigo fazer login com minha conta do bit-lab-auth
- [ ] Consigo registrar meu rosto pela webcam (ou upload de fotos)
- [ ] Vejo "Seus dados foram salvos" após enrollment
- [ ] Meu álbum aparece na seção "Minhas Fotos" após haver matches
- [ ] Consigo confirmar/rejeitar fotos individualmente
- [ ] Links de download/visualização apontam para o Google Drive
- [ ] Admin: consigo promover users na tela de Admin
- [ ] Admin: botões de Rematch e Recluster funcionam
- [ ] PWA: consigo instalar o app no meu desktop/mobile
- [ ] PWA: app funciona offline (pelo menos browse de cached)

---

## 🚀 Próximos Passos (Pós-Alpha)

- Notificações de match novo (push web ou e-mail)
- Re-scan automático periódico
- Índice vetorial para escalabilidade
- Paginação em listas grandes
- Cobertura de testes (unit/integration/e2e)
- Publicar app Google OAuth (fim do modo Testing)
- Analytics (Plausible, Mixpanel)
- Planos e quotas de uso

---

## 📞 Suporte & Feedback

**Encontrou um bug?**  
Abra uma issue em [bit-lab-agents/issues](https://github.com/bit-lab/bit-lab-agents/issues) com label `[face-lab-alpha]`.

**Tem feedback sobre UX/features?**  
Comente na issue ou envie direto para rodrigo@bit-lab.tech.

**Versão do cliente/browser?**  
Por favor, inclua no bug report:
- Browser + versão (Chrome 127, Safari 18, etc)
- OS (Windows, macOS, iOS, Android)
- Screenshots/videos se aplicável

---

## 📄 Documentação Relacionada

- [README.md](README.md) — setup e deploy
- [FEATURES.md](FEATURES.md) — detalhe completo por feature
- [ALPHA_TESTERS.md](ALPHA_TESTERS.md) — guia de uso para testers
- [PWA.md](apps/web/PWA.md) — como instalar/usar o app

---

**Enjoy the Gato! 🐱⚡**

# ✅ Checklist de QA — Face Lab Alpha "Gato-Veloz-v0.1"

Ferramenta de validação para garantir que todas as funcionalidades estão operacionais antes de expandir o alpha.

---

## 📋 Como Usar Este Checklist

1. **Tester responsável**: Seu nome aqui: ___________________
2. **Data de teste**: ___________________
3. **Browser + Versão**: Chrome 127 / Safari 18 / Firefox 130 / etc
4. **Dispositivo**: Desktop / Mobile (qual modelo?)
5. **Marque ✓ quando passar**, ✗ quando falhar, N/A quando não aplicável

**Ao final**: Reporte todos os ✗ como issues no GitHub com label `[face-lab-alpha]`.

---

## 🔐 Autenticação & Setup

### Login SSO

- [ ] Consigo acessar https://face.bit-lab.tech sem estar logado
- [ ] Botão "Entrar" redireciona pra auth.bit-lab.tech
- [ ] Posso fazer login com minhas credenciais
- [ ] Após login, redirecionado de volta pro face-lab
- [ ] Página mostra meu email após login
- [ ] Logout funciona (volta pra página inicial)
- [ ] Logout do face-lab também desconecta do auth (testa em outra aba)
- [ ] Re-entrada sem login (SSO silencioso) funciona

**Notas/bugs**: ___________________________

---

### Sessão & Cookies

- [ ] `fl_session` cookie é criado após login (DevTools → Application → Cookies)
- [ ] Cookie é `host-only` (não é enviado pra domínios terceiros)
- [ ] Cookie expira quando necessário (logout, inatividade)
- [ ] Limpando cookies força re-login

**Notas/bugs**: ___________________________

---

## 👤 Guest — Enrollment (Cadastro de Rosto)

### Acesso à Tela "Meu Rosto"

- [ ] Menu tem item "Meu Rosto" (visible)
- [ ] Clicando abre `/enroll`
- [ ] Página mostra título "Cadastre seu rosto"
- [ ] Dois botões: "Usar webcam" e "Upload de fotos"

**Notas/bugs**: ___________________________

---

### Enrollment por Webcam

- [ ] Clicando "Usar webcam" abre câmera (browser pede permissão)
- [ ] Câmera ativa mostra preview em tempo real
- [ ] Instrução aparece: "Olhe para a câmera (Frente)"
- [ ] **Passo 1 (Frente)**:
  - [ ] Rosto no quadro → detecção ativa (borda verde ou feedback)
  - [ ] Após 1-2 segundos sem movimento → foto tirada automaticamente
  - [ ] Feedback: "✓ Frente capturada"
- [ ] **Passo 2 (Esquerda)**:
  - [ ] Instrução muda: "Vire cabeça para esquerda (~45°)"
  - [ ] Mesmo processo
- [ ] **Passo 3 (Direita)**:
  - [ ] Instrução: "Vire cabeça para direita"
  - [ ] Mesmo processo
- [ ] **Passo 4 (Sorriso)**:
  - [ ] Instrução: "Sorria naturalmente"
  - [ ] Mesmo processo
- [ ] Após 4 passos: botão "Concluir cadastro" ativo
- [ ] Clicando "Concluir": webcam fecha

**Erros esperados** (validar mensagens):
- [ ] Sem rosto detectado → "Nenhum rosto encontrado, tente novamente"
- [ ] 2+ rostos → "Mais de um rosto detectado, tente sozinho"

**Notas/bugs**: ___________________________

---

### Enrollment por Upload

- [ ] Clicando "Upload de fotos" mostra file picker
- [ ] Consigo selecionar 1-8 fotos (.jpg, .png)
- [ ] Fotos aparecem como preview (thumbnails)
- [ ] Botão "Enviar" fica ativo com 3+ fotos
- [ ] Botão "Enviar" fica inativo com < 3 fotos (mensagem: "Mínimo 3 fotos")
- [ ] Clicando "Enviar": upload inicia, progress bar aparece

**Notas/bugs**: ___________________________

---

### Status de Enrollment

- [ ] Após "Concluir cadastro" (webcam) ou "Enviar" (upload):
  - Status mostra: **"Enviando..."** (spinner)
  - [ ] Barra de progresso do upload
  - [ ] Após upload terminar: **"Processando..."** (worker processando)
- [ ] Após ~10-30s (depende quantidade frames):
  - [ ] Status muda pra **"Pronto!"** (sucesso) OU
  - [ ] Status muda pra **"Erro: ..."** (falha)
- [ ] Ao atingir "Pronto!":
  - [ ] Botão "Entrar na galeria" aparece
  - [ ] Clicando leva pra `/my/albums` (Minhas Fotos)

**Notas/bugs**: ___________________________

---

## 📸 Guest — Galeria ("Minhas Fotos")

### Listagem de Álbuns

- [ ] Página `/my/albums` mostra lista de álbuns com matches
- [ ] Cada álbum tem:
  - [ ] Capa (thumbnail de uma foto onde o guest aparece)
  - [ ] Nome do álbum
  - [ ] Contagem: "X fotos · Y pessoas"
- [ ] Só aparecem álbuns com ≥1 match (não-rejeitado)
- [ ] Se nenhum match ainda: mensagem "Nenhuma foto sua foi encontrada"
- [ ] Clicando em álbum: abre galeria (`/my/albums/:id`)

**Notas/bugs**: ___________________________

---

### Grid de Fotos

- [ ] Galeria (`/my/albums/:id`) mostra grid masonry de fotos
- [ ] Cada foto tem:
  - [ ] Thumbnail 1024px (webp, rápido carregar)
  - [ ] Bbox sobreposto de rosto (quadrado com borda)
    - [ ] Preto = match automático
    - [ ] Verde = confirmado pelo guest
  - [ ] Distância no canto (ex: "0.35")
  - [ ] Informações do álbum em header: nome, contagem

### Interações com Foto (Hover/Mobile)

- [ ] No desktop (hover), botões aparecem:
  - [ ] ❤️ "Sou eu!" (confirmação)
  - [ ] ❌ "Não sou eu!" (rejeição)
  - [ ] ⬇️ "Baixar" (download do Google Drive)
  - [ ] 🔗 "Ver no Drive" (weblink pro Drive)
- [ ] No mobile (tap): mesmos botões em tela de detalhe

### Dialog de Foto (Clique)

- [ ] Clicando na foto → dialog abre com imagem grande
- [ ] Mesmos botões disponíveis: Sou eu, Não sou eu, Baixar, Ver
- [ ] Fechar dialog: X ou click fora

**Notas/bugs**: ___________________________

---

### Confirmação ("Sou eu!")

- [ ] Clicando "Sou eu!":
  - [ ] Toast aparece: "Confirmando..." (spinner)
  - [ ] Após ~2-5s: "Foto confirmada!"
  - [ ] Bbox vira verde (confirmado)
- [ ] Comportamento esperado:
  - [ ] Todas as fotos da mesma **pessoa** (cluster) viram verdes também
  - [ ] Novos matches podem aparecer (search global em outros álbuns)

**Notas/bugs**: ___________________________

---

### Rejeição ("Não sou eu!")

- [ ] Clicando "Não sou eu!":
  - [ ] Confirmação: "Tem certeza? Essa pessoa não será mais mostrada."
  - [ ] Botões: "Cancelar" e "Rejeitar"
- [ ] Clicando "Rejeitar":
  - [ ] Toast: "Pessoa rejeitada"
  - [ ] Aquela foto desaparece do grid
  - [ ] **Todas as fotos dessa pessoa** também desaparecem
  - [ ] Futuras fotos dessa pessoa nunca aparecem

**Notas/bugs**: ___________________________

---

### Links (Baixar / Ver no Drive)

- [ ] "Baixar": clicando abre `webContentLink` do Google Drive em nova aba
  - [ ] Se logado no Google: download automático
  - [ ] Se não logado: pede login
  - [ ] Arquivo baixado tem nome correto
- [ ] "Ver no Drive": abre `webViewLink` em nova aba
  - [ ] Mostra foto no Google Drive
  - [ ] Informações (tamanho, data) visíveis

**Notas/bugs**: ___________________________

---

## 👨‍💼 Producer — Álbuns

### Menu Producer

- [ ] Se promovido a producer:
  - [ ] Menu tem item "Álbuns" (novo)
  - [ ] Menu ainda tem "Minhas Fotos" e "Meu Rosto"
- [ ] Página `GET /producer` mostra seção de álbuns

**Notas/bugs**: ___________________________

---

### Conectar Google Drive

- [ ] Botão "Conectar Google Drive" visível
- [ ] Clicando: pop-up Google (OAuth) abre
- [ ] Oauto aparece opção pra selecionar conta Google
- [ ] Após permitir:
  - [ ] Pop-up fecha
  - [ ] Status muda pra "Conectado"
  - [ ] Email do Google aparece

**Desconexão**:
- [ ] Botão "Desconectar"
- [ ] Clicando: status volta pra "Conectado?"

**Erros**:
- [ ] Se bloquear pop-up: erro claro
- [ ] Se negar permissão: volta ao estado "Desconectado"

**Notas/bugs**: ___________________________

---

### Criar Álbum

- [ ] Botão "Novo álbum" disponível (após conectar Google Drive)
- [ ] Dialog abre com campos:
  - [ ] "Nome do álbum" (input text)
  - [ ] "Link da pasta do Google Drive" (input text)
- [ ] Exemplo de link: `https://drive.google.com/drive/folders/1ABC...`
- [ ] Clicando "Criar":
  - [ ] Validação do link (face lab testa se acessível)
  - [ ] Se não compartilhável: aviso "Pasta não está compartilhável"
    - [ ] Mas **não bloqueia** — opção pra compartilhar e tentar novamente
  - [ ] Se válido: álbum é criado
  - [ ] Toast: "Álbum criado com sucesso"
  - [ ] Álbum aparece em lista

**Notas/bugs**: ___________________________

---

### Listagem de Álbuns do Producer

- [ ] Página mostra todos os álbuns criados por esse producer
- [ ] Por álbum:
  - [ ] Nome
  - [ ] Contagem: "X fotos · Y pessoas · Z rostos"
  - [ ] Status: (Pronto | Processando | Vazio)
  - [ ] Botões: "Abrir", "Editar", "Deletar"

**Notas/bugs**: ___________________________

---

### Escanear Álbum

- [ ] Abrindo um álbum (clicando "Abrir"):
  - [ ] Mostra informações: nome, pasta, status
  - [ ] Botão "Re-escanear" (ou "Escanear" se primeira vez)
- [ ] Clicando "Re-escanear":
  - [ ] Dialog de confirmação: "Processar X fotos novas?"
  - [ ] Clicando "Confirmar":
    - [ ] Barra de progresso aparece: "Processando 0 de 47..."
    - [ ] Atualiza a cada 2-3s conforme fotos são processadas
    - [ ] Ao terminar: "Escanear concluído! 47 fotos processadas"

**Rate Limiting**:
- [ ] Scan respeita rate limit (não trava a API)
- [ ] Se muitas fotos: scan fica "fila" progressivamente

**Erros durante Scan**:
- [ ] Se pasta foi deletada: erro claro ("Pasta não encontrada")
- [ ] Se desconectado do Google: erro ("Reconecte sua conta Google")
- [ ] Se arquivo corrompido: skipa e continua (log de erro backend)

**Notas/bugs**: ___________________________

---

### Editar / Deletar Álbum

- [ ] Botão "Editar": pode mudar nome
- [ ] Botão "Deletar": 
  - [ ] Confirmação: "Deletar este álbum? Fotos não serão mais visíveis."
  - [ ] Apaga thumbnails e crops do disco
  - [ ] Matches cascata-deletados
  - [ ] Toast: "Álbum deletado"

**Notas/bugs**: ___________________________

---

## 👨‍⚖️ Admin

### Acesso Admin

- [ ] Se `is_admin = true` no auth:
  - [ ] Menu tem item "Admin" (novo)
  - [ ] Página `/admin` mostra dashboards

### Users Management

- [ ] Tabela de usuários:
  - [ ] Coluna: Email, Role (guest/producer/admin), Ações
- [ ] Botão "Promover a Producer":
  - [ ] Guest → producer
  - [ ] Reload tabelaActualiza
- [ ] Admin é read-only (não pode mudar aqui — controlado no auth)

**Notas/bugs**: ___________________________

---

### Stats

- [ ] Dashboard mostra contadores:
  - [ ] Usuários totais
  - [ ] Álbuns totais
  - [ ] Fotos processadas (total + últimas 24h)
  - [ ] Rostos detectados
  - [ ] Matches criados
  - [ ] Enrollments completos
- [ ] Thresholds atuais exibidos:
  - [ ] `CLUSTER_DISTANCE_THRESHOLD` (ex: 0.45)
  - [ ] `MATCH_DISTANCE_THRESHOLD` (ex: 0.4)

**Notas/bugs**: ___________________________

---

### Rematch Global

- [ ] Botão "Rematch Global"
- [ ] Dialog: "Recalcular todos os matches automáticos?"
- [ ] Clicando "Executar":
  - [ ] Toast: "Rematch iniciado, pode levar alguns minutos..."
  - [ ] Backend job rodando em background
  - [ ] UI não trava
  - [ ] Após terminar: "Rematch concluído! X matches recalculados"

**Notas/bugs**: ___________________________

---

### Recluster

- [ ] Botão "Recluster por Álbum"
- [ ] Select: escolher álbum
- [ ] Clicando "Executar":
  - [ ] Toast: "Recluster iniciado..."
  - [ ] Pessoas são reagrupadas do zero
  - [ ] Centroide recalculado por cluster
  - [ ] Toast: "Recluster concluído!"

**Notas/bugs**: ___________________________

---

### Uso por Producer

- [ ] Gráfico ou tabela de série temporal
- [ ] Eixo X: datas (hoje, últimos 7 dias)
- [ ] Eixo Y: fotos processadas
- [ ] Filtro por producer (dropdown)
- [ ] Dados servem para billing futuro

**Notas/bugs**: ___________________________

---

## 📱 Responsividade & Mobile

### Desktop (1920x1080)

- [ ] Layout com sidebar fixa à esquerda
- [ ] Conteúdo flui pra direita
- [ ] Grid de fotos ajusta: 3-4 colunas
- [ ] Botões acessíveis com hover
- [ ] Sem scroll horizontal

**Notas/bugs**: ___________________________

---

### Tablet (768x1024)

- [ ] Sidebar vira drawer (hamburger menu ☰)
- [ ] Menu abre/fecha com clique
- [ ] Grid de fotos: 2 colunas
- [ ] Touch-friendly buttons

**Notas/bugs**: ___________________________

---

### Mobile (375x812)

- [ ] Drawer hamburger menu
- [ ] Grid: 1 coluna
- [ ] Botões overlay em foto: tappable sem precise hover
- [ ] Dialog de foto: full-screen ou modal
- [ ] Sem scroll horizontal

**Notas/bugs**: ___________________________

---

## 🎨 UI & Design

### Temas & Cores

- [ ] Background branco/light (light mode)
- [ ] Texto preto/dark
- [ ] Links azuis (#3b82f6)
- [ ] Botões primários azuis, secundários cinzas
- [ ] Erro: vermelho, sucesso: verde

### Fontes & Tipografia

- [ ] Inter (source Google Fonts)
- [ ] Headings: bold, maior
- [ ] Body: regular, 14-16px

### Componentes

- [ ] Buttons: shadcn com tailwind
- [ ] Cards: border, shadow subtle
- [ ] Inputs: border, focus azul
- [ ] Modals/Dialogs: overlay escuro
- [ ] Toasts (sonner): no canto inferior direito

**Notas/bugs**: ___________________________

---

## 🚀 PWA (Progressive Web App)

### Installability

- [ ] Manifest.json válido (DevTools → Application → Manifest)
  - [ ] name: "Face Lab"
  - [ ] icons: 192x192, 512x512
  - [ ] start_url: "/"
  - [ ] display: "standalone"
  - [ ] theme_color: "#3b82f6"
- [ ] Service Worker registrado (DevTools → Application → Service Workers)
  - [ ] Status: "activated"
  - [ ] Cache storage: mostra arquivos cacheados

### Desktop Install

- [ ] Chrome/Edge: ícone de instalação na barra de endereço
- [ ] Clicando: instala como app nativo
- [ ] App abre em janela separada (modo standalone)

### Mobile Install

- [ ] Android Chrome: Menu (⋮) → "Instalar app" (ou banner no topo)
- [ ] iOS Safari: Share → "Adicionar à Tela Inicial"
- [ ] App aparece em tela inicial
- [ ] Abrindo app: fullscreen, sem barra de endereço

### Offline Functionality

- [ ] Com Internet: tudo funciona normal
- [ ] Offline (DevTools → Network → Offline):
  - [ ] Páginas já visitadas: carregam do cache
  - [ ] Novas URLs: service worker retorna fallback apropriado
  - [ ] API calls: falham gracefully (toast: "Offline")

**Notas/bugs**: ___________________________

---

## ⚡ Performance

### Load Times

- [ ] Página inicial: < 3s
- [ ] Galeria de fotos: < 5s (com 50+ fotos)
- [ ] Dialog de foto: < 1s (já cacheada)
- [ ] Enrollment: < 2s
- [ ] Scan inicia: < 1s

### Memory & CPU

- [ ] Webcam: não trava o navegador
- [ ] Ao processar 50+ fotos: CPU sobe mas UI responsiva
- [ ] Scroll masonry: suave (60fps se possível)

### Network

- [ ] Requisições GET: Content-Encoding gzip
- [ ] Imagens: webp (smaller than jpg/png)
- [ ] JavaScript bundles: ~ 400KB gzip (verificar)

**Notas/bugs**: ___________________________

---

## 🔒 Segurança

### Autenticação & Autorização

- [ ] Guest não consegue acessar `/admin` ou `/producer` se não promovido
- [ ] Producer não consegue ver álbuns de outro producer
- [ ] Guest não consegue acessar thumbs/crops de outro guest (403)
- [ ] Sessão expira ~após inatividade (testa 30+ min de inatividade)

### Mídia

- [ ] `/api/media/thumbs/:file` requer sessão
- [ ] Sem match naquela foto: 403 Forbidden
- [ ] Admin: consegue acessar qualquer mídia

### CORS & CSP

- [ ] Requisições pra `/api/` funcionam (same-origin)
- [ ] XHR cross-origin bloqueado (exceto `/api/`)
- [ ] Console (F12) sem CSP warnings críticos

**Notas/bugs**: ___________________________

---

## 🐛 Tratamento de Erros

### Validação de Input

- [ ] Nome de álbum vazio: erro "Campo obrigatório"
- [ ] Link de folder inválido: erro "Link inválido"
- [ ] < 3 fotos no upload: botão "Enviar" desabilitado

### Erros de Backend

- [ ] API lenta/offline: toast "Erro ao carregar"
- [ ] 500 do backend: toast "Erro interno, tente novamente"
- [ ] Rate limit atingido: toast "Muitas requisições, aguarde..."

### Graceful Degradation

- [ ] Sem webcam disponível: upload fallback funciona
- [ ] Sem Google Drive acesso: error message clara
- [ ] Sem matches: "Nenhuma foto foi encontrada" em vez de tela branca

**Notas/bugs**: ___________________________

---

## 📊 Logging & Monitoring

### Frontend Logs

- [ ] Console (F12) sem erros críticos de JavaScript
- [ ] Warnings de React (deprecated props, etc): OK se poucos

### Backend Logs

- [ ] API logs requests / responses
- [ ] Worker logs jobs + resultados
- [ ] Erros: capturados em Rollbar (se configurado)

### Rollbar Integration

- [ ] Erros não capturados vão pro Rollbar
- [ ] Stack traces visíveis
- [ ] User ID associado ao erro

**Notas/bugs**: ___________________________

---

## 📝 Documentação

- [ ] [ALPHA_RELEASE.md](ALPHA_RELEASE.md): escopo congelado ✓
- [ ] [ALPHA_TESTERS.md](ALPHA_TESTERS.md): guia de uso ✓
- [ ] [ALPHA_FLOW.md](ALPHA_FLOW.md): diagramas de fluxo ✓
- [ ] [FEATURES.md](FEATURES.md): mapa detalhado ✓
- [ ] [README.md](README.md): setup/deploy ✓
- [ ] [PWA.md](apps/web/PWA.md): instalação PWA ✓

---

## 🎯 Resumo Final

**Total de checks**: _____ / _____  
**Passes (✓)**: _____ (__%)  
**Failures (✗)**: _____ (__%)  
**N/A**: _____

### Bloqueadores Encontrados?

- [ ] Nenhum (release ready) ✅
- [ ] Sim, listar aqui:
  1. ___________________________________________
  2. ___________________________________________
  3. ___________________________________________

### Recomendação Final

- [ ] **APROVADO** — pronto pra expandir alpha
- [ ] **CONDICIONAL** — aprovar após corrigir bloqueadores
- [ ] **REJEITADO** — muitos issues, aguardar fix

---

**Tester Signature**: _________________ | **Data**: ___________

**Lead Approval**: _________________ | **Data**: ___________

---

*Template v1 — Julho 2026 — Gato-Veloz-v0.1*

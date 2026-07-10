# 📘 Guia do Alpha Tester — Face Lab "Gato-Veloz-v0.1"

Bem-vindo ao Face Lab! Este guia vai te orientar pelo app passo a passo.

---

## ⚡ Resumo Rápido

Face Lab permite que **producers** (você, se tiver permissão) conectem seu Google Drive, criem álbuns a partir de pastas de fotos, e façam scan automático. **Guests** (convidados) cadastram seu rosto e automaticamente recebem todas as fotos em que aparecem. A ideia é transformar pastas de eventos de fotos em galerias personalizadas — sem compartilhar a foto original, só mostrando onde você aparece.

**Privacidade**: as fotos originais ficam no Google Drive. O Face Lab guarda apenas miniaturas, recortes de rosto e embeddings vetoriais (um "fingerprint" numérico do seu rosto).

---

## 🎯 Fluxo Principal

```
┌─────────────────────────────────────────────────────────────┐
│                    VOCÊ (Guest)                              │
│                    ↓                                           │
│            Login com SSO (auth.bit-lab.tech)                 │
│                    ↓                                           │
│    1. Ir para "Meu Rosto" → Cadastrar rosto                 │
│       └─ Webcam (frente/esquerda/direita/sorriso)           │
│          OU upload de 3-8 fotos                              │
│                    ↓                                           │
│    2. Aguardar processamento (status "Enviando...")          │
│       └─ Embedding do seu rosto é calculado                 │
│                    ↓                                           │
│    3. Ir para "Minhas Fotos"                                 │
│       └─ Ver álbuns onde você aparece                        │
│       └─ Confirmar/rejeitar fotos                            │
│                                                               │
│  ────────────────────────────────────────────────────────    │
│                  PRODUCER (opcional)                          │
│                    ↓                                           │
│  Admin promove você a Producer                               │
│                    ↓                                           │
│  1. Ir para "Álbuns" → "Conectar Google Drive"              │
│     └─ Autoriza a leitura de Drive (não toca nos arquivos) │
│                    ↓                                           │
│  2. Criar álbum: nome + link de pasta do Drive              │
│     └─ Face Lab valida que a pasta está compartilhável      │
│                    ↓                                           │
│  3. Clicar "Re-escanear"                                     │
│     └─ Face Lab baixa, processa e depois apaga as fotos     │
│     └─ Barra de progresso mostra quantas foram processadas  │
│                    ↓                                           │
│  4. Processo automático: cada foto → detecta rostos →       │
│     → encontra no seu embedding do enrollment →              │
│     → mostra pro guest em "Minhas Fotos"                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Passo-a-Passo Detalhado

### 1️⃣ Login

```
Clique em "Entrar" na página inicial
→ Você é redirecionado para auth.bit-lab.tech
→ Se já tem sessão SSO lá, log in silencioso (sem tela de login)
→ Senão, faça login ou crie uma conta
→ Retorna para face.bit-lab.tech logado
```

**Nota**: Se você aparecer deslogado mesmo após tentar login, verifique:
- Cookies habilitados
- Se o auth.bit-lab.tech está acessível
- Console do navegador (F12 → Console) por erros

---

### 2️⃣ Cadastrar o Rosto ("Meu Rosto")

#### Opção A: Webcam (Recomendado)

```
1. Clique em "Meu Rosto" no menu
2. Clique em "Iniciar cadastro"
3. Permita acesso à webcam (pop-up do navegador)
4. Siga os 4 passos:
   - Frente: olhe para a câmera
   - Esquerda: vire cabeça para a esquerda (~45°)
   - Direita: vire para a direita
   - Sorriso: sorria naturalmente
5. Após cada step, face lab detecta se achou exatamente 1 rosto
   - ✓ Verde = detectado, próximo
   - ✗ Vermelho = sem rosto ou múltiplos rostos, repita
6. Clique "Concluir cadastro"
```

**Dicas**:
- Rosto ocupando ~30-50% da câmera é ideal
- Iluminação clara de frente (não contra luz)
- Sem óculos escuros ou máscaras
- Fundo sem entulho ajuda

#### Opção B: Upload Manual

Se a webcam não funcionar:

```
1. Clique em "Usar upload de fotos" na tela de enrollment
2. Selecione 3-8 fotos do seu rosto em .jpg ou .png
3. Face Lab processa tudo de uma vez
4. Status "Enviando..." aparece durante o envio
```

---

### 3️⃣ Aguardar Processamento

```
Após submeter seu rosto:
→ Status "Enviando..." (upload em progresso)
→ Status "Processando..." (worker calculando embedding)
→ Status "Pronto!" (sucesso) OU "Erro: nenhum rosto..." (falha)
```

**Se der erro**:
- "Nenhum rosto encontrado": tente fotos mais claras ou de frente
- "Mais de um rosto": use fotos onde você é o único
- Erro genérico: volte e tente novamente (pode ser falha temporária)

---

### 4️⃣ Ver "Minhas Fotos"

```
1. Após enrollment pronto, clique em "Minhas Fotos" no menu
2. Você vê álbuns onde você aparece (capa + contagem de fotos)
3. Clique em um álbum para abrir a galeria
```

**Grid de fotos**:
- **Quadrado preto no rosto** = match automático (encontrado pela IA)
- **Quadrado verde no rosto** = você confirmou que é você
- **Distância** = precisão da IA (quanto menor, melhor; ~0.3-0.5 é bom)

---

### 5️⃣ Confirmar/Rejeitar Fotos

#### Opção A: Dentro da Galeria

```
Na grid, passe o mouse sobre a foto → botões aparecem:
  • "Sou eu!" (coração verde) → confirma foto
  • "Não sou eu!" (X vermelho) → rejeita pessoa inteira
  • Ícone de download → baixar do Google Drive
  • Ícone de link → ver no Google Drive
```

#### Opção B: Dialog de Detalhe

```
Clique na foto → abre grande com os mesmos botões
→ Veja a imagem em alta resolução
→ Mesmas ações disponíveis
```

**O que acontece**:
- **Sou eu!**: Face Lab expande a busca — procura essa face em *outros álbuns* também, conectando seus aparecimentos entre eventos
- **Não sou eu!**: A pessoa toda é marcada como rejeitada — futuras fotos desse rosto nunca mais aparecem pra você

---

### 6️⃣ Se Você For Producer

#### A. Conectar Google Drive

```
1. Menu → "Álbuns" (só aparece se você for producer)
2. Clique em "Conectar Google Drive"
3. Pop-up Google: selecione sua conta e clique "Permitir"
   └─ Face Lab só lê, nunca modifica seu Drive
4. Status muda pra "Conectado"
```

**Se a autenticação falhar**:
- Tente em outra aba anônima (incógnito)
- Limpe cookies do Google
- Tente em outro browser

#### B. Criar Álbum

```
1. Menu "Álbuns" → "Novo álbum"
2. Nome: algo como "Festinha Junho 2026"
3. Link da pasta do Drive:
   └─ Abra a pasta no Google Drive
   └─ Copie o ID da URL: https://drive.google.com/drive/folders/[ID AQUI]
   └─ Cole em "Link da pasta"
4. Clique "Criar"
```

**Validação**:
- Face Lab testa se a pasta é acessível
- Avisa se não estiver compartilhável ("qualquer pessoa com o link")
  └─ Se não estiver, compartilhe e tente novamente
- Não bloqueia criação, só adverte

#### C. Fazer Scan

```
1. Abra um álbum (Menu "Álbuns" → clique no álbum)
2. Clique em "Re-escanear"
3. Barra de progresso aparece: "Processando 5 de 47..."
4. Ao terminar: "Scan concluído!" + contagem final
```

**O que acontece internamente**:
- Face Lab lista todas as imagens da pasta
- Baixa cada uma → detecta rostos → cria thumb + crop
- Compara cada rosto com o embedding de cada guest
- **Apaga** a foto original do disco (privacidade)
- Deixa link do Google Drive para download

**Progresso**:
- Não feche a aba durante o scan (continua em background, mas UI não atualiza)
- Verifique a barra a cada 2-3 segundos
- Scans grandes podem levar vários minutos

---

### 7️⃣ Relatório de Uso (Admin)

Se você tiver permissão de Admin:

```
Menu → Admin → "Stats"
  • Usuários cadastrados
  • Álbuns criados
  • Total de fotos processadas
  • Total de rostos detectados
  • Total de matches

Menu → Admin → "Uso por Producer"
  • Série temporal de uso (hoje, últimos 7 dias, etc)
  • Base para cobranças futuras
```

---

## 🔗 Links Úteis

| Recurso | URL | Descrição |
|---|---|---|
| **Face Lab** | https://face.bit-lab.tech | App principal |
| **SSO/Login** | https://auth.bit-lab.tech | Central de autenticação |
| **Google Drive** | https://drive.google.com | Suas pastas de fotos |
| **Bugs/Feedback** | [GitHub Issues](https://github.com/bit-lab/bit-lab-agents/issues?q=label%3Aface-lab-alpha) | Reporte problemas |
| **Documentação** | [FEATURES.md](../FEATURES.md) | Detalhe técnico de tudo |
| **Release Notes** | [ALPHA_RELEASE.md](../ALPHA_RELEASE.md) | O que está congelado |

---

## 🐛 Troubleshooting

### "Erro ao conectar Google Drive"

**Solução**:
1. Desconecte: Menu → Admin → Google Drive → "Desconectar"
2. Feche abas e cookies do Google
3. Reconecte em aba anônima (Incógnito)
4. Se persistir, seu Gmail pode estar em modo Testing — reconecte manualmente sempre que pedir

### "Enrollment pronto, mas não vejo minhas fotos"

**Verificar**:
- [ ] Scan do álbum terminou com sucesso (verificar barra de progresso)
- [ ] Álbum tem pelo menos uma foto com rosto
- [ ] Rol a página (às vezes cache)
- [ ] Abra em aba anônima (elimina cache)

### "Fotos aparecem com distância muito alta (~0.8)"

**Isso significa**: Match fraco. A IA acha que é você, mas com pouca confiança.
- **Confirmar assim mesmo**: "Sou eu!" → Face Lab aprende com isso (treino)
- **Rejeitar**: "Não sou eu!" → nunca mais essa pessoa aparece

### "Botão de download não funciona"

**Esperado**: Link abre o Google Drive. Se recusar acesso:
- Você não é membro do álbum ou
- A pasta foi deletada / descompartilhada

---

## 📋 Checklist de Teste Completo

Use este checklist para verificar se você testou tudo:

### Guest (convidado)

- [ ] Consigo fazer login
- [ ] Consigo ver "Meu Rosto" no menu
- [ ] Consigo registrar rosto com webcam (4 passos)
- [ ] Consigo registrar rosto com upload de fotos
- [ ] Status muda pra "Pronto!" ou "Erro"
- [ ] Após enrollment bem-sucedido, álbuns aparecem em "Minhas Fotos"
- [ ] Grid de fotos carrega e mostra bbox de rosto
- [ ] Consigo clicar em foto e abrir dialog grande
- [ ] Consigo confirmar foto ("Sou eu!")
- [ ] Consigo rejeitar foto ("Não sou eu!")
- [ ] Consigo fazer download (link abre Drive)
- [ ] Consigo ver link "Visualizar no Drive"

### Producer (opcional, se promovido)

- [ ] Consigo ver "Álbuns" no menu
- [ ] Consigo conectar Google Drive
- [ ] Consigo criar novo álbum (nome + link de pasta)
- [ ] Consigo abrir álbum criado
- [ ] Consigo clicar "Re-escanear"
- [ ] Barra de progresso aparece durante scan
- [ ] Scan termina com "Concluído!"
- [ ] Minhas fotos aparecem após scan terminar
- [ ] Consigo editar nome do álbum
- [ ] Consigo deletar álbum

### Admin (opcional, se promovido)

- [ ] Consigo acessar menu Admin
- [ ] Consigo ver stats globais (usuários, fotos, etc)
- [ ] Consigo promover usuário de guest → producer
- [ ] Consigo ver uso por producer (série temporal)
- [ ] Botão "Rematch global" não trava a UI

### Mobile & PWA

- [ ] Abro em celular e vejo drawer hamburger
- [ ] Instalo app (menu celular → "Instalar app")
- [ ] App funciona offline (pelo menos browse)
- [ ] App reabre em tela cheia (modo standalone)

---

## 🎤 Como Dar Feedback

### Encontrou um bug?

1. Abra uma issue no [GitHub](https://github.com/bit-lab/bit-lab-agents/issues)
2. Título: `[face-lab-alpha] Descrição breve`
3. Incluir:
   - O que tentou fazer
   - O que aconteceu (erro, comportamento inesperado)
   - O que deveria aconterir
   - Browser + versão + OS
   - Screenshots/console errors (F12)

### Sugestão de feature?

Comente em issue existente ou crie:
- Título: `[face-lab-alpha] Feature: Nome da ideia`
- Descreva o case de uso

### Performance ruim?

Abra issue + envie:
- Tempo que levou (ex: "scan demorou 8 min")
- Quantidade de fotos
- Tamanho médio de arquivo
- Seu hardware (CPU/RAM aproximado)

---

## 📞 Contato

- **Suporte técnico**: [GitHub Issues](https://github.com/bit-lab/bit-lab-agents/issues?q=label%3Aface-lab-alpha)
- **Email**: rodrigo@bit-lab.tech
- **Slack**: [bit-lab workspace](https://bit-lab.slack.com) #face-lab

---

## 🎉 Você está pronto!

1. ✅ Faça login em https://face.bit-lab.tech
2. ✅ Cadastre seu rosto em "Meu Rosto"
3. ✅ Aguarde processamento
4. ✅ Explore "Minhas Fotos"
5. ✅ Confirme/rejeite algumas fotos
6. ✅ (Opcional) Crie um álbum e faça scan como producer

**Divirta-se descobrindo suas fotos! 🐱⚡**

---

*Última atualização: Julho 2026*  
*Versão do guia: Gato-Veloz-v0.1*

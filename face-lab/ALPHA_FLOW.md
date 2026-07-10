# 🗺️ Guia Visual de Fluxos — Face Lab "Gato-Veloz-v0.1"

Diagramas e explicações dos 3 fluxos principais do app.

---

## 1️⃣ Fluxo de Enrollment (Cadastro de Rosto)

```
┌──────────────────────────────────────────────────────────────┐
│ GUEST                                                         │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 1. Clica "Meu Rosto" no menu                          │   │
│ │    ↓                                                    │   │
│ │ 2. Escolhe: Webcam (recomendado) ou Upload            │   │
│ │    ↓                                                    │   │
│ │ 3. Webcam: 4 passos guiados (frente/esq/dir/sorriso) │   │
│ │    Upload: seleciona 3-8 fotos                         │   │
│ │    ↓                                                    │   │
│ │ 4. Clica "Enviar" ou "Concluir"                       │   │
│ └────────────────────────────────────────────────────────┘   │
│                      ↓                                         │
│                  BACKEND (API)                                │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 1. Recebe frames/fotos do frontend                    │   │
│ │    ↓                                                    │   │
│ │ 2. Enfileira job "enroll" no Redis                    │   │
│ │    ↓                                                    │   │
│ │ 3. Responde com status "Processando..."               │   │
│ └────────────────────────────────────────────────────────┘   │
│                      ↓                                         │
│                  WORKER (Python)                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 1. Recebe job "enroll" da fila                        │   │
│ │    ↓                                                    │   │
│ │ 2. Para cada frame:                                    │   │
│ │    a) Detecta rostos (SCRFD)                          │   │
│ │    b) Valida: exatamente 1 rosto? Sim → continua     │   │
│ │                                  Não → marca como inválido│
│ │    c) Gera embedding (ArcFace 512-d)                 │   │
│ │    ↓                                                    │   │
│ │ 3. Calcula embedding MÉDIO de todos os frames válidos│   │
│ │    ↓                                                    │   │
│ │ 4. **Apaga todos os frames** (privacidade)            │   │
│ │    ↓                                                    │   │
│ │ 5. Publica resultado em Redis "facelab:results"      │   │
│ └────────────────────────────────────────────────────────┘   │
│                      ↓                                         │
│                  BACKEND (API)                                │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 1. Recebe resultado do worker                         │   │
│ │    ↓                                                    │   │
│ │ 2. Salva embedding no banco (enrollments table)       │   │
│ │    ↓                                                    │   │
│ │ 3. MATCHING AUTOMÁTICO:                               │   │
│ │    Para cada face em todos os álbuns:                │   │
│ │    • Calcula distância cosseno vs embedding novo      │   │
│ │    • Se distância ≤ 0.4: cria match "auto"          │   │
│ │    ↓                                                    │   │
│ │ 4. Atualiza status pra "Pronto!" ou "Erro"           │   │
│ └────────────────────────────────────────────────────────┘   │
│                      ↓                                         │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ GUEST vê: Status "Pronto!" em "Meu Rosto"           │   │
│ │           Álbuns aparecem em "Minhas Fotos"           │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Dados Salvos**:
- ✅ `enrollments`: embedding (vector), user_id, status
- ✅ `matches`: enrollment_id, face_id, distance, confirmed/auto
- ❌ Frames de webcam: APAGADOS

---

## 2️⃣ Fluxo de Scan (Producer → Álbum → Fotos)

```
┌──────────────────────────────────────────────────────────────┐
│ PRODUCER                                                      │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 1. Clica "Álbuns" → "Novo álbum"                      │   │
│ │    ↓                                                    │   │
│ │ 2. Preenche: Nome + Link de pasta do Google Drive    │   │
│ │    └─ Ex: https://drive.google.com/drive/folders/..  │   │
│ │    ↓                                                    │   │
│ │ 3. Clica "Criar álbum"                               │   │
│ │ ┌────────────────────────────────────────────────────┐ │   │
│ │ │ Backend testa:                                   │ │   │
│ │ │ • Pasta acessível? ✓ ou ✗                       │ │   │
│ │ │ • Compartilhável? (avisa se não, mas não bloqueia)│ │   │
│ │ └────────────────────────────────────────────────────┘ │   │
│ │    ↓                                                    │   │
│ │ 4. Álbum aparece em "Álbuns"                         │   │
│ │    ↓                                                    │   │
│ │ 5. Clica "Re-escanear"                               │   │
│ └────────────────────────────────────────────────────────┘   │
│                      ↓                                         │
│                  BACKEND (API)                                │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 1. Chama Google Drive API: lista arquivos na pasta    │   │
│ │    └─ Filtra por tipo: jpg, png, webp                │   │
│ │    ↓                                                    │   │
│ │ 2. Para cada arquivo (com rate limit):               │   │
│ │    a) Arquivo já processado? Skip                     │   │
│ │    b) Novo? Faz upsert em "photos" table             │   │
│ │    c) Enfileira job "process_photo" no Redis         │   │
│ │    ↓                                                    │   │
│ │ 3. Frontend: pooling a cada 2.5s → GET /scan-status  │   │
│ │    └─ Mostra: "Processando 5 de 47..."               │   │
│ │    ↓                                                    │   │
│ │ 4. Scan termina quando tudo enfileirado              │   │
│ │    └─ Status: "Pronto para processar 47 fotos"       │   │
│ └────────────────────────────────────────────────────────┘   │
│                      ↓                                         │
│                  WORKER (Python)                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 1. Recebe cada job "process_photo" da fila           │   │
│ │    ↓                                                    │   │
│ │ 2. Para cada foto:                                    │   │
│ │    a) Baixa do Google Drive → /media/incoming/       │   │
│ │    b) EXIF-transpose (orienta certo)                 │   │
│ │    c) Detecta rostos (SCRFD):                        │   │
│ │       • Obtém N bboxes com scores                    │   │
│ │       • Descarta scores < 0.5                        │   │
│ │    d) Para cada rosto válido:                        │   │
│ │       • Gera embedding (ArcFace 512-d)              │   │
│ │       • Cria thumb 1024px (webp)                     │   │
│ │       • Cria crop (bbox + 25% margem, webp)         │   │
│ │    e) **Apaga original** do disco (/media/incoming) │   │
│ │    ↓                                                    │   │
│ │ 3. Publica resultado: (photo_id, [faces com embeds])│   │
│ └────────────────────────────────────────────────────────┘   │
│                      ↓                                         │
│                  BACKEND (API)                                │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 1. Recebe resultado do worker                         │   │
│ │    ↓                                                    │   │
│ │ 2. Salva no banco:                                    │   │
│ │    a) faces table: photo_id, embedding, bbox, crop  │   │
│ │    b) people table: clustering automático             │   │
│ │       └─ Nova face vs centroides → novo cluster?    │   │
│ │    ↓                                                    │   │
│ │ 3. MATCHING AUTOMÁTICO:                               │   │
│ │    Para cada novo rosto (face):                      │   │
│ │    • Para cada enrollment ativo:                      │   │
│ │      - Calcula distância cosseno                      │   │
│ │      - Se ≤ 0.4: cria match "auto"                  │   │
│ │    ↓                                                    │   │
│ │ 4. Atualiza scan status                               │   │
│ └────────────────────────────────────────────────────────┘   │
│                      ↓                                         │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ PRODUCER vê: Status "Concluído! 47 fotos processadas"│   │
│ │              Álbum mostra "47 fotos · 12 pessoas"    │   │
│ │                                                        │   │
│ │ GUEST vê: Álbum aparece em "Minhas Fotos"            │   │
│ │           Grid com suas fotos do evento              │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Dados Salvos**:
- ✅ `photos`: album_id, drive_file_id, drive_weblink, thumb_file, created_at
- ✅ `faces`: photo_id, person_id, embedding (vector), bbox, crop_file
- ✅ `people`: album_id, centroid (vector), cover_face_id (foto de capa)
- ✅ `matches`: enrollment_id, face_id, distance, status (auto/confirmed/rejected)
- ❌ Original do Drive: APAGADO após processar

---

## 3️⃣ Fluxo de Galeria (Guest vê seus Fotos)

```
┌──────────────────────────────────────────────────────────────┐
│ GUEST acessa "Minhas Fotos"                                   │
│                    ↓                                           │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Backend: GET /api/my/albums                           │   │
│ │ • Lista albums onde guest tem ≥ 1 match não-rejeitado│   │
│ │ • Calcula capa: thumb de 1 foto recente onde aparece│   │
│ │ • Conta: "47 fotos · 12 pessoas"                     │   │
│ │ ↓                                                      │   │
│ │ Frontend mostra cards de álbuns                       │   │
│ └────────────────────────────────────────────────────────┘   │
│                    ↓                                           │
│ Guest clica em 1 álbum                                         │
│                    ↓                                           │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Backend: GET /api/my/albums/:id/photos                │   │
│ │ • Retorna fotos onde guest tem matches                │   │
│ │ • Por foto: thumb_url, face bbox, distância, status  │   │
│ │ • Status: "auto" (black box) vs "confirmed" (green)  │   │
│ │ ↓                                                      │   │
│ │ Frontend mostra grid masonry                          │   │
│ │ • Thumb de 1024px                                     │   │
│ │ • Bbox sobreposto (quadrado preto ou verde)          │   │
│ │ • Distância em canto (ex: "0.35")                    │   │
│ └────────────────────────────────────────────────────────┘   │
│                    ↓                                           │
│ Guest interage com foto: passa mouse                          │
│                    ↓                                           │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Botões aparecem:                                      │   │
│ │ • ❤️ "Sou eu!" → POST /api/my/matches/:faceId/confirm│   │
│ │ • ❌ "Não sou eu!" → POST /api/my/matches/:id/reject│   │
│ │ • ⬇️ "Baixar" → link direto Google Drive              │   │
│ │ • 🔗 "Ver no Drive" → abre webViewLink               │   │
│ └────────────────────────────────────────────────────────┘   │
│                    ↓                                           │
│ Guest clica "Sou eu!"                                         │
│                    ↓                                           │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Backend: POST /confirm (match_id)                     │   │
│ │                                                        │   │
│ │ 1. Marca match como "confirmed"                       │   │
│ │    └─ Bbox vira verde                                │   │
│ │                                                        │   │
│ │ 2. Propaga para a mesma pessoa (person_id) no álbum│   │
│ │    └─ Todas as faces dessa pessoa viram "confirmed" │   │
│ │                                                        │   │
│ │ 3. SEARCH GLOBAL:                                     │   │
│ │    Roda esse embedding como probe:                   │   │
│ │    • Busca em TODOS os outros álbuns                 │   │
│ │    • Se encontra matches, cria "auto"                │   │
│ │    └─ Guest vê novas fotos de outros eventos!       │   │
│ │                                                        │   │
│ │ 4. Toast: "Foto confirmada! Buscando em outros..."  │   │
│ └────────────────────────────────────────────────────────┘   │
│                    ↓                                           │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Frontend atualiza                                     │   │
│ │ • Bbox vira verde nessa foto                          │   │
│ │ • Grid recarrega (pode mostrar novas fotos de outros│   │
│ │   álbuns se a busca global encontrou)                │   │
│ └────────────────────────────────────────────────────────┘   │
│                    ↓                                           │
│ Guest clica "Não sou eu!"                                     │
│                    ↓                                           │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Backend: POST /reject (match_id)                      │   │
│ │                                                        │   │
│ │ 1. Marca no `rejected_people`:                        │   │
│ │    • usuario_id + person_id = rejeitado              │   │
│ │                                                        │   │
│ │ 2. A PESSOA INTEIRA é descartada                     │   │
│ │    └─ Todas as faces dessa pessoa somem do grid     │   │
│ │    └─ Futuras fotos dessa pessoa nunca aparecem     │   │
│ │                                                        │   │
│ │ 3. Toast: "Pessoa rejeitada. Não vamos mais mostrar."│   │
│ └────────────────────────────────────────────────────────┘   │
│                    ↓                                           │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Frontend atualiza                                     │   │
│ │ • Aquela foto desaparece do grid                      │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Estados de Match**:
- 🟤 `auto`: Match automático (encontrado pela IA)
- 🟢 `confirmed`: Guest confirmou que é ele
- 🚫 `rejected`: Guest negou (pessoa não será mostrada novamente)

---

## 4️⃣ Interações Admin

```
┌──────────────────────────────────────────────────────────────┐
│ ADMIN                                                         │
│                                                               │
│ 1. Promover Guest → Producer                                 │
│    ┌──────────────────────────────────────────────────────┐  │
│    │ GET /api/admin/users                                │  │
│    │ • Lista todos os usuários                           │  │
│    │ • Mostra role (guest, producer, admin)             │  │
│    │                                                      │  │
│    │ PATCH /api/admin/users/:id/role                     │  │
│    │ • Alterna guest ↔ producer                         │  │
│    │ • Admin é read-only (controlado no auth central)   │  │
│    └──────────────────────────────────────────────────────┘  │
│                                                               │
│ 2. Ver Stats                                                 │
│    ┌──────────────────────────────────────────────────────┐  │
│    │ GET /api/admin/stats                                │  │
│    │ • Total: usuários, álbuns, fotos, rostos, matches  │  │
│    │ • Últimas 24h de uso                               │  │
│    │ • Thresholds atuais (cluster, match)               │  │
│    └──────────────────────────────────────────────────────┘  │
│                                                               │
│ 3. Série de Uso por Producer                                 │
│    ┌──────────────────────────────────────────────────────┐  │
│    │ GET /api/admin/usage?producerId=&days=             │  │
│    │ • Mostra fotos processadas por dia                 │  │
│    │ • Base para cobranças/planos futuros               │  │
│    └──────────────────────────────────────────────────────┘  │
│                                                               │
│ 4. Rematch Global                                            │
│    ┌──────────────────────────────────────────────────────┐  │
│    │ POST /api/admin/rematch                             │  │
│    │ • Recalcula TODOS os matches "auto"                 │  │
│    │ • Preserva matches "confirmed" e "rejected"        │  │
│    │ • Útil se ajustou threshold de match               │  │
│    │ • Toast: "Rematch iniciado, pode levar..."         │  │
│    └──────────────────────────────────────────────────────┘  │
│                                                               │
│ 5. Recluster (por álbum)                                     │
│    ┌──────────────────────────────────────────────────────┐  │
│    │ POST /api/admin/recluster?albumId=                  │  │
│    │ • Reagrupa faces do zero                           │  │
│    │ • Útil se ajustou threshold de clustering          │  │
│    │ • Útil para backfill de álbuns antigos             │  │
│    │ • Toast: "Recluster iniciado..."                   │  │
│    └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Ciclo de Vida de um Match

```
Nova foto entra (scan):
   ↓
[Detecta rosto X, embedding E1]
   ↓
[Para cada enrollment ativo: calcula distância vs E1]
   ↓
   ├─ Distância ≤ 0.4?
   │  └─ SIM: Cria match com status "auto"
   │  └─ NÃO: sem match
   ↓
Guest vê a foto em "Minhas Fotos" (status: auto = quadrado preto)
   ↓
Guest clica "Sou eu!"
   ├─ Status muda pra "confirmed" (quadrado verde)
   ├─ Propaga pra pessoa inteira no álbum
   └─ Search global: busca rosto em TODOS os outros álbuns
      └─ Cria novos matches "auto" se encontrar
   ↓
Futuras fotos dessa pessoa nesse álbum aparecem como "confirmed"
Futuras fotos dessa pessoa em OUTROS álbuns aparecem como "auto"
   ↓
Guest clica "Não sou eu!" (em uma foto anterior):
   ├─ Pessoa inteira marcada como "rejected"
   └─ Todas as faces dessa pessoa somem de "Minhas Fotos"
      (mas dados não são deletados — admin pode reverter)
   ↓
Admin clica "Rematch global":
   ├─ Recalcula todos os "auto" matches
   └─ Preserva "confirmed" e "rejected" (aqueles não mudam)
```

---

## 📊 Banco de Dados — Tabelas Principais

```
users
├─ id (PK)
├─ oidc_sub (FK do auth.bit-lab.tech)
├─ email
├─ role (guest | producer | admin)
└─ created_at

enrollments
├─ id (PK)
├─ user_id (FK users)
├─ embedding (pgvector 512-d) ← face lab
├─ active (boolean)
└─ created_at

albums
├─ id (PK)
├─ user_id (FK users) ← producer que criou
├─ name
├─ drive_folder_id
├─ drive_folder_name
└─ created_at

photos
├─ id (PK)
├─ album_id (FK albums)
├─ drive_file_id (permanece lá)
├─ drive_file_name
├─ drive_weblink (link pra download)
├─ thumb_file (URL local do thumb)
└─ created_at

faces ← um rosto detectado em uma foto
├─ id (PK)
├─ photo_id (FK photos)
├─ person_id (FK people) ← qual pessoa (cluster)
├─ embedding (pgvector 512-d) ← face lab
├─ bbox (json: {x, y, w, h})
├─ crop_file (URL local do crop)
└─ created_at

people ← cluster de rostos semelhantes
├─ id (PK)
├─ album_id (FK albums)
├─ centroid (pgvector 512-d) ← média dos embeddings
├─ cover_face_id (FK faces) ← foto de capa
└─ created_at

matches ← rosto encontrado em um enrollment
├─ id (PK)
├─ enrollment_id (FK enrollments)
├─ face_id (FK faces)
├─ distance (float: 0-1)
├─ status (auto | confirmed | rejected)
└─ created_at

rejected_people ← pessoas que guest rejeitou
├─ user_id (FK users)
├─ person_id (FK people)
└─ created_at
```

---

## 🔐 Segurança de Mídia

```
Guest tenta acessar /api/media/thumbs/xyz.webp
   ↓
Backend verifica:
├─ Guest está logado? (sessão válida)
├─ Tem match naquela foto?
   ├─ Match não-rejeitado (status ≠ rejected)?
   └─ SIM: Serve arquivo
   └─ NÃO: 403 Forbidden

Outros acessos permitidos:
├─ Producer (dono do álbum)
├─ Admin (qualquer mídia)
```

---

## 🎯 Resumo: O que Acontece em Cada Página

| Página | Ator | O que vê | Backend chama |
|---|---|---|---|
| **Meu Rosto** | Guest | Wizard de enrollment + status | POST /enrollment, GET /enrollment/status |
| **Minhas Fotos** | Guest | Álbuns onde tem matches | GET /my/albums |
| **Álbum do Guest** | Guest | Grid de fotos onde aparece | GET /my/albums/:id/photos, POST /confirm, /reject |
| **Álbuns** | Producer | Lista de álbuns do producer | GET /albums, POST /albums |
| **Álbum do Producer** | Producer | Detalhes + botão "Re-escanear" | GET /albums/:id, POST /albums/:id/scan, GET /scan-status |
| **Admin** | Admin | Users, stats, botões rematch/recluster | GET /admin/users, /stats, /usage, POST /rematch, /recluster |

---

*Última atualização: Julho 2026*  
*Versão: Gato-Veloz-v0.1*

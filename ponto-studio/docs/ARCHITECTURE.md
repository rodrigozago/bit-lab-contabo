# Arquitetura do Sistema — Bordado Digital

## Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React App (Vite)                                    │   │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │  tldraw    │  │  Properties  │  │   Export    │  │   │
│  │  │  Canvas    │  │  Panel       │  │   Modal     │  │   │
│  │  └────────────┘  └──────────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP REST (/api/*)
┌─────────────────────▼───────────────────────────────────────┐
│  Node.js API (Fastify)                    :3001              │
│                                                             │
│  Routes:                                                    │
│    POST /api/projects          → CRUD projetos              │
│    PUT  /api/projects/:id                                   │
│    POST /api/export            → cria job de exportação     │
│    GET  /api/export/:jobId     → status do job              │
│    POST /api/upload            → upload de imagem           │
│    POST /api/analyze           → análise IA (OpenRouter)    │
│                                                             │
│  Services:                                                  │
│    svgConverter  → JSON → SVG com atributos inkstitch:*     │
│    jobQueue      → publica jobs no Redis, escuta resultados │
│                                                             │
│  Static:                                                    │
│    /exports/:file → serve arquivos gerados                  │
│    /uploads/:file → serve imagens enviadas                  │
└──────────┬──────────────────────────────────────────────────┘
           │ RPUSH embroidery:jobs
           │ SUBSCRIBE embroidery:results
┌──────────▼──────────────────────────────────────────────────┐
│  Redis 7                           :6379                    │
│                                                             │
│  LIST   embroidery:jobs     ← API publica, worker consome   │
│  CHANNEL embroidery:results ← worker publica, API escuta   │
└──────────┬──────────────────────────────────────────────────┘
           │ BLPOP embroidery:jobs
           │ PUBLISH embroidery:results
┌──────────▼──────────────────────────────────────────────────┐
│  Python Worker (pyembroidery)                               │
│                                                             │
│    Lê: /exports/<jobId>.svg                                 │
│    Converte: SVG paths → pontos de bordado                  │
│    Gera: /exports/<jobId>.dst|pes|jef                       │
│    Publica resultado no canal Redis                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Exportação (Detalhado)

```
1. Usuário clica "Exportar"
2. Modal abre → usuário escolhe formato (DST/PES/JEF)
3. POST /api/export { projectId, format }
4. API:
   a. Busca projeto (GET /api/projects/:id)
   b. Chama svgConverter → gera SVG com anotações inkstitch:*
   c. Salva SVG em /exports/<jobId>.svg
   d. Cria ExportJob { status: "pending" }
   e. RPUSH embroidery:jobs { jobId, svgFile, format, projectId }
   f. Retorna { jobId, status: "pending" }
5. Frontend faz polling GET /api/export/:jobId a cada 1.5s
6. Worker (Python):
   a. BLPOP embroidery:jobs → recebe payload
   b. Lê /exports/<jobId>.svg com svgpathtools
   c. Converte paths SVG → pontos de bordado via pyembroidery
   d. Grava /exports/<jobId>.<ext>
   e. PUBLISH embroidery:results { jobId, status: "done", outputFile }
7. API (subscriber Redis) → atualiza job { status: "done", downloadUrl }
8. Polling detecta "done" → modal exibe botão de download
9. Usuário baixa arquivo diretamente de /exports/<jobId>.<ext>
```

---

## Fluxo de Análise por IA

```
1. Usuário importa imagem
2. POST /api/analyze (multipart, imagem em base64)
3. API → OpenRouter (modelo visão) → retorna SVG vetorial
4. Frontend exibe preview lado a lado (original vs vetorial)
5. Usuário confirma → SVG adicionado como EmbroideryElement
```

---

## Modelo de Dados

```typescript
EmbroideryProject {
  id: string (UUID)
  name: string
  canvas: { widthMm: number, heightMm: number }
  elements: EmbroideryElement[]
  createdAt: ISO8601
  updatedAt: ISO8601
}

EmbroideryElement {
  id: string (UUID)
  svgPath: string        // SVG path "d" attribute
  color: string          // hex "#RRGGBB"
  stitch: {
    type: "satin" | "tatami" | "running"
    density: number      // 0.0–1.0
    angle: number        // 0–180 graus
  }
}

ExportJob {
  jobId: string
  projectId: string
  format: "DST" | "PES" | "JEF"
  status: "pending" | "processing" | "done" | "error"
  downloadUrl?: string
  errorMessage?: string
  createdAt: ISO8601
  updatedAt: ISO8601
}
```

---

## SVG Gerado (exemplo)

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkstitch="http://inkstitch.org/namespace"
     width="100mm" height="100mm">
  <path
    d="M 10 10 L 90 10 L 90 90 L 10 90 Z"
    fill="#FF5733"
    inkstitch:angle="45"
    inkstitch:fill_method="tatami_fill"
    inkstitch:line_distance="1.5mm"
  />
</svg>
```

---

## Persistência

O POC usa um `Map<string, EmbroideryProject>` em memória na API.
Dados são perdidos ao reiniciar. Para produção:
- **Upgrade path:** SQLite com Drizzle ORM — a interface dos routes permanece idêntica.
- Redis armazena apenas jobs transitórios (fila + resultados).

---

## Infraestrutura (Docker)

```
docker-compose.yml
  ├── redis   (redis:7-alpine)                — fila de jobs
  ├── api     (node:20-alpine)        :3001   — REST API
  ├── worker  (python:3.12-slim)              — processamento de bordado
  └── web     (nginx:1.27 + React build) :3000
```

Volumes compartilhados:
- `exports` — arquivos de bordado gerados (compartilhado entre api e worker)
- `uploads` — imagens enviadas pelos usuários

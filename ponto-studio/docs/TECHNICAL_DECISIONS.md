# Decisões Técnicas — Bordado Digital

---

## ADR-01 — tldraw como base do editor

**Decisão:** Usar tldraw v2 como canvas interativo.

**Por quê:**
- Editor de canvas completo (pan, zoom, seleção, formas, imagens) já pronto
- API de extensão bem documentada — podemos adicionar shapes customizadas
- Open source (MIT), tamanho de bundle razoável
- Alternativa (Fabric.js, Konva) exigiria construir toda a UI de ferramentas do zero

**Trade-off:** tldraw carrega ~500KB; aceitável para uma ferramenta desktop.

---

## ADR-02 — pyembroidery para geração de arquivos de bordado

**Decisão:** Usar pyembroidery diretamente para gerar DST/PES/JEF, com svgpathtools
para leitura e amostragem dos paths SVG.

**Por quê:**
- pyembroidery suporta os três formatos (DST, PES, JEF) sem dependências externas
- Roda em Python puro (sem Inkscape, sem GUI, sem X11) — imagem Docker < 200 MB
- svgpathtools provê leitura e amostragem precisa de Bézier curves
- Instalação simples via pip — sem extensões de terceiros

**Trade-off:** A geração de pontos é feita com algoritmo próprio (fill por varredura);
qualidade inferior ao Ink/Stitch para designs complexos, mas suficiente para POC.

**Upgrade path (v2):** Substituir o algoritmo de fill por uma implementação mais
sofisticada (ex: algoritmo de Tatami real, satin column) dentro do mesmo worker.py
sem mudar a interface Redis.

---

## ADR-03 — Redis como fila de jobs

**Decisão:** API publica jobs em uma LIST Redis (`RPUSH embroidery:jobs`).
Worker consome via `BLPOP` e publica resultado em um canal Pub/Sub
(`PUBLISH embroidery:results`). A API escuta o canal e atualiza o job em memória.

**Por quê:**
- Desacoplamento real entre API e worker — sem subprocess, sem dependência de path de arquivo de script
- Worker pode escalar horizontalmente (múltiplos containers lendo a mesma fila)
- Redis é leve e não requer schema; adequado para POC
- `BLPOP` é bloqueante no worker — zero CPU idle

**Trade-off:** Jobs perdidos se a API reiniciar antes de receber o resultado
(estado de jobs é in-memory na API). Aceitável para POC.

**Upgrade path (v2):** Substituir por BullMQ (usa Redis internamente) para
persistência de jobs, retry automático e dashboard de monitoramento.

---

## ADR-04 — In-memory store (sem banco de dados)

**Decisão:** Projetos armazenados em `Map<string, EmbroideryProject>` em memória.

**Por quê:**
- POC — validar UX antes de comprometer com um banco
- Evita complexidade de migrations, ORM, etc.

**Trade-off:** Dados perdidos no restart.

**Upgrade path (v2):** Substituir por SQLite (Drizzle ORM) — interface dos routes
permanece idêntica.

---

## ADR-05 — Fastify (não Express)

**Decisão:** Fastify como HTTP framework da API.

**Por quê:**
- TypeScript first-class com inferência de tipos nos handlers
- ~2x mais rápido que Express em benchmarks simples
- Plugin ecosystem maduro (@fastify/cors, @fastify/multipart)

---

## ADR-06 — pnpm workspaces (não Turborepo/Nx)

**Decisão:** pnpm workspaces simples, sem orquestrador de build.

**Por quê:**
- Repo pequeno (3 packages) — overhead de Turborepo não se justifica
- pnpm workspace: resolvido nativamente com `workspace:*`

**Upgrade path:** Adicionar `turbo.json` quando o número de packages crescer.

---

## ADR-07 — Polling (não WebSockets) para status de job

**Decisão:** Frontend faz polling `GET /api/export/:jobId` a cada 1.5s.

**Por quê:**
- Jobs duram < 30s → no máximo 20 requests por export
- Evita complexidade de WebSocket/SSE para POC
- Funciona atrás de qualquer proxy HTTP

**Upgrade path (v2):** Server-Sent Events (SSE) — mudança somente no `jobQueue.ts` e
no `pollUntilDone` do cliente.

---

## ADR-08 — OpenRouter para análise de imagem por IA

**Decisão:** Rota `/api/analyze` usa OpenRouter (modelo de visão) para converter
imagem em SVG vetorial com anotações para bordado.

**Por quê:**
- Abstrai a escolha do modelo — OpenRouter roteia para o melhor disponível
- Não requer GPU local nem infra dedicada de IA
- Simples de substituir por outro provider mudando apenas a URL e o header

**Trade-off:** Depende de chave de API externa; sem a chave a feature de IA fica
indisponível (mas o restante do fluxo funciona normalmente).

---

## Stack Summary

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + tldraw | 18 + 2.x |
| Build | Vite | 5.x |
| API | Fastify + TypeScript | 4.x |
| Fila | Redis | 7.x |
| Worker | Python + pyembroidery | 3.12 + 1.4+ |
| Infra | Docker + docker-compose | 3.9 |
| Package manager | pnpm workspaces | 9.x |

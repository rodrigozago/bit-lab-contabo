# 🪡 Bordado Digital

> Plataforma web para criação e exportação de designs de bordado

## O que é

Bordado Digital é uma ferramenta web simples onde qualquer pessoa pode:

1. **Importar** uma imagem (PNG/JPG) como referência
2. **Analisar** a imagem — 100% local, sem IA: k-means (OpenCV) separa as
   cores → limpeza morfológica → VTracer vetoriza → **uma camada de bordado
   por cor** (regiões desconectadas da mesma cor ficam na mesma camada).
   Determinístico, rápido e grátis. Slider "Nº de cores" também aceita 1, que
   exclui o fundo automaticamente e deixa só o desenho.
3. **Configurar** o tipo de ponto, cor e densidade de cada camada/cor
4. **Exportar** o design em formato compatível com sua máquina de bordado (DST, PES, JEF)

## Estrutura do Projeto

```
ponto-studio/
├── apps/
│   ├── web/          # React + tldraw (editor visual)
│   └── api/          # Node.js + Fastify (REST API)
├── workers/
│   └── embroidery/   # Python + pyembroidery (geração de arquivos)
├── packages/
│   └── shared/       # Tipos TypeScript compartilhados
├── infra/            # nginx.conf
├── docs/             # FRD, PRD, Arquitetura, Decisões Técnicas
├── scripts/          # setup.sh
└── docker-compose.yml
```

## Início Rápido (Desenvolvimento)

```bash
# Instala dependências e builda shared
./scripts/setup.sh

# Sobe Redis localmente (necessário para a API e o worker)
docker run -d -p 6379:6379 redis:7-alpine

# Roda web (port 3000) e api (port 3001) em paralelo
pnpm dev

# Em outro terminal, sobe o worker Python
cd workers/embroidery
pip install -r requirements.txt
REDIS_URL=redis://localhost:6379 EXPORTS_DIR=../../apps/api/exports python3 worker.py
```

## Início Rápido (Docker)

```bash
# Sobe toda a stack: Web, API, Worker Python e Redis
docker-compose up --build

# Web:    http://127.0.0.1:3003  (proxied publicamente via bordado.digital)
# API:    http://127.0.0.1:4001  (uso interno/debug — não exposta publicamente)
# Redis:  redis://redis:6379    (interno, sem porta publicada)
```

> Esta cópia roda na VPS bit-lab (`bit-lab-agents/ponto-studio`) atrás do nginx
> compartilhado — ver [`../nginx/bit-lab.tech.conf`](../nginx/bit-lab.tech.conf)
> e [`install.sh`](scripts/install.sh). As portas 3001/6379/3000 do modo dev
> puro já estavam em uso por outros serviços da VPS (opencdj-api e afins).

## Tecnologias

| Camada | Stack |
|--------|-------|
| Frontend | React 18, TypeScript, tldraw v2, Vite |
| API | Node.js 20, Fastify 4, TypeScript |
| Fila | Redis 7 |
| Worker | Python 3.12, pyembroidery, svgpathtools |
| Infra | Docker, docker-compose, pnpm workspaces |

## Documentação

- [FRD — Requisitos Funcionais](docs/FRD.md)
- [PRD — Product Requirements](docs/PRD.md)
- [Arquitetura do Sistema](docs/ARCHITECTURE.md)
- [Decisões Técnicas (ADRs)](docs/TECHNICAL_DECISIONS.md)

## Formatos de Exportação

| Formato | Compatibilidade |
|---------|----------------|
| `.DST` | Tajima — universal, compatível com a maioria das máquinas |
| `.PES` | Brother, Babylock |
| `.JEF` | Janome, Elna |

## Testes

```bash
pnpm test                                                    # api + web (vitest)
docker compose run --rm worker python -m unittest test_analyze -v   # pipeline de análise (Python)
```

## Fluxo da Análise (100% local, sem IA)

```
Imagem (PNG/JPG) → POST /api/analyze/local → uploads/ → RPUSH embroidery:jobs {type:"analyze"}
                                                            ↓
                                    Worker Python — analyze.py (k-means → limpeza → VTracer)
                                                            ↓
                                    exports/{jobId}.svg (um <g> por cor) → PUBLISH results
                                                            ↓
                          Frontend (polling GET /api/analyze/local/:jobId) → camadas por cor
```

## Fluxo de Exportação

```
Projeto (JSON) → API → Salva SVG → RPUSH embroidery:jobs (Redis)
                                            ↓
                            Worker Python — BLPOP embroidery:jobs
                                            ↓
                              pyembroidery → .DST / .PES / .JEF
                                            ↓
                            PUBLISH embroidery:results (Redis)
                                            ↓
                         API (subscriber) → atualiza status do job
                                            ↓
                         Frontend (polling) → exibe download 🎉
```

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `REDIS_URL` | URL de conexão ao Redis | `redis://localhost:6379` |
| `PORT` | Porta da API | `3001` |
| `PUBLIC_URL` | URL base pública da API (para URLs de download) | `http://localhost:3001` (`https://bordado.digital` nesta VPS) |
| `EXPORTS_DIR` | Diretório de saída do worker | `/exports` |
| `ROLLBAR_SERVER_TOKEN` | Token servidor (secreto) do Rollbar — **erros** da API e do worker. Sem ele, vira no-op. | *(vazio = desligado)* |
| `SLACK_METRICS_WEBHOOK` | Incoming Webhook do Slack — **feed de métricas** por job (worker). Sem ele, o worker não posta nada. | *(vazio = desligado)* |
| `QUEUE_DEPTH_WARN` | Acima deste tamanho de fila, o worker posta um alerta de backlog no Slack. | `20` |
| `ROLLBAR_ENV` | Rótulo do ambiente nas mensagens do Slack e no Rollbar. | `production` |

### Observabilidade

Divisão de responsabilidades: **Rollbar = erros** (exceptions, com stack trace/agrupamento);
**Slack = métricas e operacional** (feed por job).

O worker posta **1 mensagem no Slack por job** (análise/export/preview/stitch_data) com
`tempo`, `inkstitch_ms` (tempo só do subprocess do Ink/Stitch), nº de `pontos`/`áreas`,
`tamanho` e profundidade da `fila`. As mesmas métricas também vão nas linhas de `log.info`
(visíveis no `docker logs`, sem depender de nada externo). Quando a fila passa de
`QUEUE_DEPTH_WARN`, sai um alerta `⚠️ Fila acumulando`.

Para configurar: Slack → **Apps → Incoming Webhooks** → escolha o canal (ex.: `#ponto-metrics`)
→ copie a URL pra `SLACK_METRICS_WEBHOOK`. Como é webhook direto, não consome cota do Rollbar.

> Isso é um feed, não um sistema de métricas: agregações (p50/p95, gráficos de latência)
> não existem aqui. Se um dia precisar disso, o passo natural é somar Loki/Prometheus
> (Grafana Cloud) só pra métricas — o feed do Slack e os erros no Rollbar continuam válidos.

## Banco de Dados

O POC usa um `Map` em memória para projetos — sem banco de dados. Os dados são perdidos
ao reiniciar a API. Para produção, a interface dos routes permanece idêntica e o store
pode ser substituído por SQLite/Postgres com alteração mínima.

---

*POC v0.1 — foco em funcionamento ponta a ponta*

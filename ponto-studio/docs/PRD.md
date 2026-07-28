# PRD — Product Requirements Document
## Bordado Digital v0.1 — POC

---

## Problema

Usuários domésticos de máquinas de bordado precisam de software especializado (Wilcom, Hatch,
Brother PE-Design) para criar designs. Esses softwares são caros (USD 500–2000), complexos,
e focados em usuários profissionais. Não existe uma alternativa simples, web-based e acessível.

## Solução

Uma ferramenta web simples que abstrai a complexidade técnica do bordado. O usuário cria
visualmente e o sistema cuida da conversão técnica para máquina.

---

## Personas

### Maria, 52 anos — Bordadeira doméstica
- Tem uma Brother Innov-is em casa
- Usa o computador para e-mail e Facebook
- Compra designs prontos online (Etsy, sites especializados)
- Quer criar designs personalizados para presentear a família
- Frustra-se com softwares complexos e caros

---

## Métricas de Sucesso (POC)

| Métrica | Meta POC |
|---------|----------|
| Tempo para primeira exportação | < 5 minutos desde a abertura |
| Taxa de sucesso de exportação | > 90% dos arquivos abrem na máquina |
| Satisfação qualitativa | Usuário consegue sem tutorial escrito |

---

## Jornada do Usuário (Happy Path)

```
Abre o site
    → Cria projeto ("Floral Primavera", 100×100mm)
    → Importa foto de flor como referência
    → Cria 3 áreas de bordado sobre a flor
    → Configura cada área: tipo de ponto + cor
    → Clica "Exportar bordado"
    → Escolhe PES (tem Brother)
    → Baixa arquivo
    → Transfere para máquina via USB
    → Borda! 🌸
```

---

## MVP Feature Set

### Must Have (v0.1)
- [ ] Tela de criação de projeto com nome e tamanho
- [ ] Editor visual com canvas (tldraw)
- [ ] Importação de PNG/SVG
- [ ] Criação de áreas de bordado (formas básicas)
- [ ] Painel de propriedades: tipo, cor, densidade, ângulo
- [ ] Exportação DST/PES/JEF
- [ ] Download do arquivo

### Should Have (v0.2)
- [ ] Preview visual do bordado (renderização simulada)
- [ ] Formas livres (desenho à mão)
- [ ] Múltiplos projetos salvos
- [ ] Undo/redo

### Could Have (v0.3)
- [ ] Galeria de designs
- [ ] Login básico
- [ ] Compartilhamento de projeto

### Won't Have (POC)
- Billing, IA, colaboração em tempo real

---

## Arquitetura de Produto

```
Browser (React + tldraw)
    ↕ REST
Node.js API (Fastify)
    ↕ Redis (fila de jobs)
Python Worker (pyembroidery)
    → Arquivo .dst/.pes/.jef
```

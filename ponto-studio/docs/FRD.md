# FRD — Functional Requirements Document
## Bordado Digital v0.1

---

## 1. Visão Geral

Bordado Digital é uma aplicação web que permite a usuários domésticos de máquinas de bordado
criar designs visuais simples e exportá-los em formatos compatíveis com suas máquinas
(DST, PES, JEF), sem necessidade de conhecimento técnico em software de bordado.

**Princípio central:** o usuário pensa em criação visual, não em bordado técnico.

---

## 2. Atores

| Ator | Descrição |
|------|-----------|
| Usuário doméstico | Dona de máquina de bordado em casa, pouca familiaridade técnica |

---

## 3. Casos de Uso

### UC-01 — Criar Projeto

**Ator:** Usuário
**Pré-condição:** Nenhuma
**Fluxo principal:**
1. Usuário acessa a aplicação
2. Informa nome do projeto
3. Seleciona tamanho do bastidor (preset em mm)
4. Sistema cria projeto e abre editor

**Resultado:** Projeto criado e editor aberto com canvas vazio.

---

### UC-02 — Importar Imagem com Análise IA

**Ator:** Usuário
**Pré-condição:** Projeto criado
**Fluxo principal:**
1. Usuário clica em "Importar imagem"
2. Seleciona arquivo PNG, JPG ou SVG (até 10 MB)
3. Sistema envia imagem para análise via IA (OpenRouter)
4. Preview lado a lado: imagem original + SVG vetorial gerado
5. Usuário confirma → imagem original e SVG aparecem no canvas
6. SVG gerado vira um EmbroideryElement configurável

**Regras de negócio:**
- Formatos aceitos: PNG, JPG, SVG
- Tamanho máximo: 10 MB
- A análise IA requer `OPENROUTER_API_KEY` configurada
- Sem a chave, a feature de IA fica indisponível (demais features funcionam normalmente)

---

### UC-03 — Criar Área de Bordado

**Ator:** Usuário
**Pré-condição:** Projeto aberto
**Fluxo principal:**
1. Usuário clica em "+ Área de bordado"
2. Forma geométrica (retângulo) aparece no canvas
3. Usuário redimensiona e posiciona a área

**Resultado:** Nova EmbroideryElement criada no projeto.

---

### UC-04 — Configurar Ponto da Área

**Ator:** Usuário
**Pré-condição:** Área selecionada no canvas
**Fluxo principal:**
1. Painel lateral exibe propriedades da área
2. Usuário seleciona tipo de ponto: Cetim / Tatami / Corrido
3. Usuário ajusta cor do fio (color picker)
4. Usuário ajusta densidade (slider 0–100%)
5. Usuário ajusta ângulo (slider 0°–180°)

---

### UC-05 — Exportar Bordado

**Ator:** Usuário
**Pré-condição:** Projeto com pelo menos uma área configurada
**Fluxo principal:**
1. Usuário clica em "Exportar bordado"
2. Seleciona formato: DST / PES / JEF
3. Sistema converte projeto → SVG → publica na fila Redis
4. Worker Python lê a fila, converte SVG → arquivo de bordado via pyembroidery
5. Resultado publicado no canal Redis → API atualiza status do job
6. Usuário baixa o arquivo

**Fluxos alternativos:**
- 4a. Se conversão falhar: sistema exibe mensagem de erro
- 4b. Processamento pode levar até 30 segundos: sistema exibe indicador de progresso

**Resultado:** Arquivo .dst / .pes / .jef disponível para download.

---

## 4. Requisitos Funcionais

### RF-01 — Editor Visual
- RF-01.1: Canvas interativo com zoom e pan
- RF-01.2: Criação de formas geométricas (retângulo)
- RF-01.3: Seleção, redimensionamento e rotação de formas
- RF-01.4: Importação de PNG, JPG e SVG com análise IA
- RF-01.5: Lista de elementos no painel lateral

### RF-02 — Configuração de Bordado
- RF-02.1: Tipo de ponto por área (satin, tatami, running)
- RF-02.2: Cor do fio por área (hex color picker)
- RF-02.3: Densidade de pontos (0–100%)
- RF-02.4: Ângulo dos pontos (0°–180°)

### RF-03 — Exportação
- RF-03.1: Exportação para DST (Tajima)
- RF-03.2: Exportação para PES (Brother)
- RF-03.3: Exportação para JEF (Janome)
- RF-03.4: Feedback de progresso durante exportação (polling a cada 1.5s)
- RF-03.5: Download direto do arquivo gerado

### RF-04 — Persistência
- RF-04.1: Projeto salvo como JSON (estrutura EmbroideryProject) em memória
- RF-04.2: API REST para CRUD de projetos

---

## 5. Requisitos Não-Funcionais

| ID | Requisito | Critério |
|----|-----------|----------|
| RNF-01 | Performance do editor | Canvas responsivo a 60fps em hardware comum |
| RNF-02 | Tempo de exportação | < 30s para projetos com até 20 elementos |
| RNF-03 | Tamanho de upload | Até 10 MB por arquivo |
| RNF-04 | Compatibilidade | Chrome, Firefox, Edge (últimas 2 versões) |
| RNF-05 | Simplicidade de UX | Nenhum jargão técnico de bordado visível ao usuário |
| RNF-06 | Imagem Docker worker | < 200 MB (sem Inkscape) |

---

## 6. Fora de Escopo (v0.1)

- Autenticação / login
- Cobrança / planos
- Colaboração em tempo real
- Histórico de versões
- Marketplace de designs
- Banco de dados persistente (in-memory store é suficiente para POC)
- Suporte a múltiplos bastidores por projeto

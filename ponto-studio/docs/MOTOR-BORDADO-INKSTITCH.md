# Motor de bordado — migração para o Ink/Stitch (subprocess)

> **Documento de execução autossuficiente.** Se a sessão de IA acabar, qualquer pessoa (ou outra IA)
> consegue continuar só lendo este arquivo — toda a pesquisa necessária está embutida aqui.
> Marque os checkpoints `[ ]` → `[x]` conforme for implementando.

**Última atualização:** 2026-07-20
**Status geral:** 🟢 Fase 0 CONCLUÍDA — export/preview/stitch_data já rodam pelo binário real do Ink/Stitch. Próximo passo: Fase 1.

---

## 0. TL;DR / Estado atual

- **Problema:** o bordado exportado "parece impressora, não agulha ponto a ponto". Nosso motor caseiro
  (`workers/embroidery/worker.py`) fazia preenchimento em **serpentina de raster** com JUMPs por distância —
  não o **caminho contínuo** (grafo Euleriano + travel pela borda) que bordado real exige.
- **Decisão:** parar de reimplementar. **Rodar o próprio Ink/Stitch** (GPLv3, open source) como
  **subprocess** no worker, alimentando o SVG que já geramos (com atributos `inkstitch:*`).
- **Escopo inicial:** **fills primeiro** (Tatami, Contour, Meander, Circular). Stroke e Satin depois, um a um.
- **Divisão de trabalho:** nosso app cuida da **geometria + params + sugestão de ponto**;
  o Ink/Stitch faz toda a **matemática do ponto**.
- **Fase 0 concluída em 2026-07-20**: o motor caseiro foi REMOVIDO (não só desativado) — `worker.py`
  hoje só chama `run_inkstitch` (subprocess) e lê o resultado de volta com pyembroidery. Ver Seção 3.1
  pros **5 problemas não-óbvios** encontrados e corrigidos (leitura obrigatória antes de mexer na Fase 1+).

### Checklist de alto nível
- [x] **Fase 0** — Runner do Ink/Stitch no worker (fundação; validado headless) ✅ 2026-07-20
- [ ] **Fase 1** — Schema de params + Fills (Tatami, Contour, Meander, Circular) + UI + heurística
- [ ] **Fase 2** — Stroke (running/bean/zigzag/ripple)
- [ ] **Fase 3** — Satin Column (extração de trilhos)
- [ ] **Fase 4** — Demais fills (Guided, Linear Gradient, Tartan, Cross Stitch)

---

## 1. Por que a abordagem mudou (histórico)

Já houve **3 tentativas** de consertar o motor caseiro, todas insuficientes:
1. Fix de rotação no export.
2. Reescrita do motor "estilo Ink/Stitch" (grating shapely + stagger + underlay + center-walk).
3. Correção de underlay crosshatch ("duas agulhas") + separação de espaçamento/ comprimento de ponto.

**Por que nada resolveu:** o motor caseiro nunca teve o **caminho contínuo**. Ele costura linha-a-linha de
cima pra baixo (raster de impressora) e "pula" (JUMP) quando a próxima linha fica longe — em formas
côncavas/ com buracos isso vira dezenas de JUMPs e o simulador mostra **linhas flutuantes desconectadas**
(o "pontilhado de impressora"). Faltava o algoritmo profissional de digitalização.

**Conclusão:** o Ink/Stitch já faz isso perfeitamente e é open source. Em vez de replicar, **rodamos ele**.

---

## 2. Pesquisa embutida — como o Ink/Stitch realmente funciona

### 2.1 O algoritmo de fill (por que fica "como agulha")
Fonte: `lib/stitches/tatami_fill.py`, `lib/stitches/fill.py`, `lib/stitches/running_stitch.py` no
[repo do Ink/Stitch](https://github.com/inkstitch/inkstitch).

O `tatami_fill` NÃO é serpentina crua. Ele:
1. `intersect_region_with_grating(shape, angle, row_spacing)` — linhas de varredura ∩ shape → segmentos.
2. `build_fill_stitch_graph` — monta um **MultiGraph (networkx)**: cada segmento de preenchimento é uma
   aresta `key="segment"` (obrigatória de percorrer); os nós são projetados no contorno e ligados por
   arestas `key="outline"` ao longo da borda (`duplicate_every_other=True`).
3. `graph_make_valid` — `networkx.eulerize()` torna todo nó de grau par.
4. `find_stitch_path` — **algoritmo de Hierholzer** (caminho Euleriano); `pick_edge` **prefere** arestas
   `segment` → gera o vai-e-volta contínuo tipo "cortador de grama".
5. `path_to_stitches` — aresta `segment` → pontos da linha com **stagger**; aresta `outline` → `travel()`:
   caminho mais curto **acompanhando/por baixo da borda**, recortado dentro do polígono
   (`clamp_path_to_polygon`), convertido em ponto corrido por `even_running_stitch` (que quebra em cantos
   >45° e distribui pontos de comprimento uniforme).

Resultado: **um único fio contínuo** que preenche e viaja pela borda. É isso que faz "parecer agulha".
Replicar isso à mão é o que falhou 3x → por isso **usamos o Ink/Stitch pronto**.

### 2.2 Rodar o Ink/Stitch sem GUI (CLI)
Fonte: [command-line docs](https://inkstitch.org/docs/command-line/).

```bash
# Exporta pra zip com um ou mais formatos:
inkstitch --extension=zip --format-dst=True --format-pes=True --format-threadlist=True input.svg > out.zip
```
- O binário é **self-contained** (traz Python + inkex + deps embutidos); **não precisa da GUI do Inkscape**.
- Params de cada ponto vêm de **atributos `inkstitch:*`** no SVG (que **já emitimos** hoje).
- Precisa de **xvfb** (wxPython/inkex tocam X mesmo em CLI) → `xvfb-run -a inkstitch ...`.
- O Ink/Stitch respeita o **tamanho real** do documento: nosso `width="Xmm" height="Ymm" viewBox="0 0 X Y"`
  → 1 user unit = 1mm (conferir na Fase 0).

### 2.3 Binário Linux (para o Docker)
Release **v3.2.2** (confirmar a mais recente ao implementar) em
[releases](https://github.com/inkstitch/inkstitch/releases). Asset Linux x86_64:

```
inkstitch-3.2.2-linux-x86_64.tar.xz
```
(há também aarch64 e i386; escolher conforme a arquitetura da imagem Docker.)

### 2.4 Dependências do Ink/Stitch (só relevante se um dia optar por importar `lib.stitches`)
`inkex` (git da Inkscape), `wxPython`, `networkx`, `shapely>=2.0`, `lxml`, `numpy==2.2.6`, `flask`,
`fonttools`, `trimesh`, `colormath2`, `platformdirs`, `diskcache`, `jinja2`, `tomli`.
> **Não vamos importar** — vamos rodar o binário (não precisamos instalar nada disso via pip).

### 2.5 Catálogo completo de tipos de ponto (v3.2.2)
Fonte: [Stitch Library](https://inkstitch.org/docs/stitch-library/).

| Categoria | Tipos |
|-----------|-------|
| **Fill** (formas fechadas) | Tatami, Contour, Circular, Guided, Meander, Linear Gradient, Tartan, Cross Stitch, Legacy |
| **Stroke** (linhas/contorno) | Running, Bean, Ripple, Zig-Zag, Manual |
| **Satin** (colunas, 2 trilhos) | Satin Column, E-Stitch, S-Stitch, Zigzag |

- **Fills** funcionam a partir de um path com `fill` (temos). MVP: **Tatami, Contour, Meander, Circular**.
  - *Guided* exige uma linha-guia; *Circular* exige um ponto-alvo (usar centro por default).
- **Stroke** exige path com `stroke` (nossas partes são fill → aplicar no contorno/centerline).
- **Satin** exige geometria de coluna (2 trilhos + rungs) — extração de rails a partir da forma.

### 2.6 Licença
Ink/Stitch é **GPLv3**. Rodar como **processo separado (subprocess)** é "mera agregação / à distância" —
**não** torna o nosso código derivado. Por isso escolhemos subprocess em vez de importar os módulos
(importar `lib.stitches` tornaria o worker GPLv3). **Não vendorizar/importar código GPL no nosso processo.**

### 2.7 Correção de máquina (bom saber)
- Comprimento máximo de ponto em DST ≈ **12.1mm**; acima disso a máquina faz jump/trim sozinha.
  O Ink/Stitch já cuida disso — mais um motivo pra usá-lo.

---

## 3. Estado atual do código (pós Fase 0 — 2026-07-20)

- **`workers/embroidery/worker.py`** — REESCRITO do zero, motor caseiro 100% REMOVIDO (não só desligado).
  Hoje só tem: `pattern_to_preview_svg`, `pattern_to_stitch_json`, `_svg_viewbox`, `_pattern_from_bytes`
  (novo — escreve bytes num arquivo temp com a extensão certa e lê via `pyembroidery.read`, porque o
  parser é escolhido pela extensão do nome do arquivo, não dá pra ler de `BytesIO`), e o dispatch de jobs
  (`process_job`/`process_analyze_job`/`process_preview_job`/`process_stitch_data_job`/`main`).
  `export` e `stitch_data`/`preview` chamam `run_inkstitch(svg_text, formats=(...))` de
  `inkstitch_runner.py` e leem o resultado de volta. **`export` grava os bytes ORIGINAIS do Ink/Stitch**
  (não reserializa via pyembroidery — preserva fidelidade); `preview`/`stitch_data` pedem **PES** (não DST
  — ver Seção 3.1.4) e leem via `_pattern_from_bytes` pra alimentar `pattern_to_stitch_json`/`pattern_to_preview_svg`.
- **`workers/embroidery/inkstitch_runner.py`** (NOVO) — `run_inkstitch(svg, formats) -> dict[str, bytes]`.
  Injeta automaticamente `<inkstitch_svg_version>3</inkstitch_svg_version>` no SVG (ver 3.1.2 — SEM isso
  o binário TRAVA PRA SEMPRE, sem erro nenhum). Roda `xvfb-run -a $INKSTITCH_BIN --extension=zip
  --format-<fmt>=True <svg> > stdout` (o zip sai direto no stdout), descompacta em memória, devolve
  `{fmt: bytes}`. `InkstitchError` pra falhas do processo/timeout/zip vazio.
- **`workers/embroidery/requirements.txt`** — `shapely` e `svgpathtools` REMOVIDOS (só o motor caseiro
  usava). Ficaram: `pyembroidery`, `redis`, `opencv-python-headless`, `numpy`, `vtracer`.
- **`workers/embroidery/Dockerfile`** — baixa `inkstitch-3.2.2-linux-x86_64.tar.xz`, extrai em
  `/opt/inkstitch` (`--strip-components=1`), `ENV INKSTITCH_BIN=/opt/inkstitch/bin/inkstitch`. Pacotes apt
  necessários (todos confirmados por tentativa-e-erro, ver 3.1.1): `xvfb xauth libgl1 fonts-dejavu-core
  libwayland-client0 libwayland-cursor0 libwayland-egl1` (+ `curl xz-utils` só de build, purgados depois).
- **`workers/embroidery/analyze.py`** — inalterado, ainda usado por `process_analyze_job`
  (`analyze_image_with_metrics`, `_layer_metrics`). ⚠️ **vtracer segfaulta no Python 3.14/Windows local**
  (pré-existente, confirmado não-relacionado à migração) → análise só roda no **Docker (Linux)**.
- **`apps/api/src/services/svgConverter.ts`** — `buildStitchAttributes` **corrigida** pros nomes/formato
  REAIS do Ink/Stitch (ver 3.1.3 — os nomes antigos eram TODOS ignorados silenciosamente):
  `inkstitch:row_spacing_mm` (não `line_distance`), `inkstitch:fill_underlay="true"/"false"` sempre
  explícito (não `underlay`, e o default do Ink/Stitch é `true` — omitir não desliga nada),
  `inkstitch:max_stitch_length_mm` (não `max_stitch_length`), `inkstitch:running_stitch_length_mm` (só
  faltava o `_mm`). **Valores são sempre número puro, SEM sufixo "mm"** — `pull_compensation_mm` e
  `angle` já estavam certos. Rotação continua saindo como `ponto:rotation*` (ignorado pelo Ink/Stitch —
  rotação está SILENCIOSAMENTE QUEBRADA hoje; é o item 1.3 da Fase 1, não adiar mais).
  ⚠️ **`satin` hoje mapeia pra `contour_fill`**, que no Ink/Stitch real é um FILL genuíno (anéis
  concêntricos), **não** uma coluna de cetim de verdade (isso é `SatinColumn`, elemento/geometria
  diferente — 2 trilhos, ver Fase 3). Escolha antiga era só o nome mais parecido disponível; manter até
  a Fase 3 implementar cetim de verdade.
- **`packages/shared/src/index.ts`** — inalterado nesta fase: `EmbroideryElement`/`StitchParams`
  (`{ type: "satin"|"tatami"|"running", density, angle, underlay?, pullCompensationMm? }`), mais
  `name/hidden/groupId/groupName/rotation/stitchSuggested` e `AnalyzeMetrics`/`AnalyzeLayerMetrics`.
  Vira união discriminada na Fase 1 (checkpoint 1.1).
- **`apps/web/src/components/PropertiesPanel.tsx`** — inalterado, UI dos params por parte (3 tipos hoje).
- **`apps/web/src/utils/stitchHeuristics.ts`** — inalterado, sugere tipo/densidade/ângulo a partir das métricas.
- **`apps/web/src/store/projectStore.ts`** — inalterado, `addElement` (default stitch tatami 0.6/45).
- **`apps/web/src/utils/svgLayers.ts`** — inalterado, `splitSvgByColor` (separa o SVG da análise por cor).

### 3.1 Achados críticos da Fase 0 (leitura obrigatória — nada disso está documentado em lugar nenhum do Ink/Stitch)

Encontrados por tentativa empírica (build → rodar → travou/errou → investigar → corrigir → repetir),
não por documentação — o Ink/Stitch não documenta nada disso publicamente.

**1. Dependências de sistema do binário (Dockerfile).** O binário PyInstaller já traz quase tudo
   embutido (GTK3, wx, X11 client libs, ICU, etc. — dezenas de `.so` em `bin/`), mas **NÃO** traz:
   `xauth` (o `xvfb-run` precisa dele pra gerenciar `.Xauthority` — sem isso, erro imediato
   `xauth command not found`), `libgl1` (não bundlado), e as libs Wayland
   `libwayland-client0`/`libwayland-cursor0`/`libwayland-egl1` (o GTK3 do binário tenta carregar o backend
   Wayland mesmo forçando X11 via Xvfb — sem essas libs, crash na importação do `wx.core` com
   `ImportError: libwayland-cursor.so.0: cannot open shared object file`).

**2. O binário TRAVA PARA SEMPRE (sem erro) se o SVG não tiver a marca de versão.** Esse foi o bug mais
   difícil de diagnosticar — o processo simplesmente ficava rodando indefinidamente (confirmado até 8+
   minutos), 0% CPU, sem nada no stderr. Diagnosticado com `py-spy dump --pid <pid>` (precisa
   `--cap-add SYS_PTRACE` no `docker run`), que mostrou o stack real:
   ```
   MainLoop (core.py:2262)
   __init__ (request_update_svg_version.py:79)
   automatic_version_update (update.py:68)
   update_inkstitch_document (update.py:59)
   ```
   O Ink/Stitch procura um elemento `<inkstitch_svg_version>` em qualquer lugar do documento
   (`//*[local-name()='inkstitch_svg_version']//text()`); sem ele, acha que o SVG pode ser de uma versão
   desconhecida e **mostra um diálogo modal (wx) pedindo confirmação** — que nunca aparece/fecha em modo
   headless, travando o processo pra sempre. **Fix**: `inkstitch_runner.py` injeta automaticamente
   `<metadata><inkstitch_svg_version>3</inkstitch_svg_version></metadata>` logo após a tag `<svg>` raiz
   (a constante `INKSTITCH_SVG_VERSION = 3` é a versão exata da tag `v3.2.2` — **ajustar esse número se
   trocar a versão do Ink/Stitch no Dockerfile**; o branch `main` do GitHub já está na versão 4, não usar
   esse valor sem checar a tag exata baixada).

**3. Nomes de atributo `inkstitch:*` que usávamos estavam ERRADOS** (silenciosamente ignorados — Inkscape
   não dá erro em atributo desconhecido, só cai no default). Confirmado gerando pontos com valores bem
   diferentes e comparando a contagem/geometria resultante (script Python direto, ver histórico de sessão
   se precisar repetir a metodologia):
   | Usávamos (errado) | Real (Ink/Stitch) | Nota |
   |---|---|---|
   | `inkstitch:line_distance="0.4mm"` | `inkstitch:row_spacing_mm="0.4"` | nome errado E sufixo "mm" quebra o parse |
   | `inkstitch:underlay="true"` | `inkstitch:fill_underlay="true"` ou `"false"` | nome errado; default é `true` — **tem que emitir `false` explícito pra desligar** |
   | `inkstitch:max_stitch_length="3mm"` | `inkstitch:max_stitch_length_mm="3"` | nome errado + sufixo |
   | `inkstitch:running_stitch_length="2.5mm"` | `inkstitch:running_stitch_length_mm="2.5"` | só faltava o `_mm` |
   | `inkstitch:pull_compensation_mm="1.0"` | ✅ já estava certo (nome e formato) | |
   | `inkstitch:angle="45"` | ✅ já estava certo | |
   **Regra geral confirmada**: todo valor `_mm` é **número puro, sem sufixo "mm"** — o Ink/Stitch faz
   `float(attr)` direto; com sufixo, o parse falha silenciosamente e ele usa o default dele.

**4. DST não guarda cor da linha; PES guarda.** `pyembroidery`'s `DstReader` só preenche `thread.color`
   a partir de um arquivo de paleta companheiro (que não geramos) — ler um `.dst` puro de volta dá cores
   de fallback/placeholder, não as cores reais. `PesReader` lê `thread.color` embutido de verdade
   (`0xFF000000 | read_int_24be(f)`). **Por isso `preview`/`stitch_data` pedem sempre `pes` ao
   `run_inkstitch`**, nunca `dst`, mesmo que o formato final de export seja outro.

**5. `pyembroidery.COLOR_BREAK` (226) ≠ o que aparece ao ler um arquivo real de volta.** `COLOR_BREAK`
   é um comando de ALTO NÍVEL (só existe ao montar um `EmbPattern` em memória, do jeito que o motor
   caseiro antigo fazia). Ao **ler** um DST/PES real (gerado pelo Ink/Stitch e salvo em disco), a troca de
   cor vem como o comando de BAIXO NÍVEL `pyembroidery.COLOR_CHANGE` (5) — confirmado empiricamente lendo
   um PES de verdade de volta (não documentado). Sem isso, `pattern_to_preview_svg`/`pattern_to_stitch_json`
   não detectavam NENHUMA troca de cor em arquivos reais (todas as cores viravam uma polyline só).
   **Fix**: `_BREAK_COMMANDS` e `_STITCH_CMD_CODE` em `worker.py` agora tratam `COLOR_BREAK` e
   `COLOR_CHANGE` como equivalentes (`_COLOR_CHANGE_COMMANDS = {COLOR_BREAK, COLOR_CHANGE}`).

### 3.2 Verificação end-to-end já feita (2026-07-20)
Rodado com SVG real gerado por `convertProjectToSvg` (2 elementos: tatami roxo + running laranja, canvas
30×30mm), processado via `worker.process_job` de verdade (Redis fake) dentro do container:
- Export DST: 889 pontos, bbox ≈ 24×27mm (bate com o desenho), sem erro.
- Export PES: 891 pontos, 2 threads (`#915fac`, `#ff9900` — cores levemente diferentes das pedidas porque
  o PES quantiza pra paleta de fios do fabricante embutida no Ink/Stitch; **comportamento esperado do
  formato**, não bug), 1 `COLOR_CHANGE` detectado corretamente, `pattern_to_stitch_json`→`colorCount=2`,
  `pattern_to_preview_svg`→2 polylines (uma por cor). Tudo bate.

---

## 4. Fase 0 — Runner do Ink/Stitch no worker (FUNDAÇÃO) — ✅ CONCLUÍDA 2026-07-20

> Objetivo: rodar o binário do Ink/Stitch headless no container e gerar um DST correto a partir do
> nosso SVG. **Validar cedo** — era o maior risco (xvfb/headless) e realmente foi (ver Seção 3.1).

### Checkpoints
- [x] **0.1** Dockerfile do worker — baixa `inkstitch-3.2.2-linux-x86_64.tar.xz` em `/opt/inkstitch/`;
      apt: `xvfb xauth libgl1 fonts-dejavu-core libwayland-client0 libwayland-cursor0 libwayland-egl1`
      (lista final depois de 2 rodadas de erro, ver Seção 3.1.1). `ENV INKSTITCH_BIN=/opt/inkstitch/bin/inkstitch`.
- [x] **0.2** Smoke test manual — `xvfb-run -a $INKSTITCH_BIN --extension=zip --format-dst=True` com SVG de
      quadrado. Travou 8+ min na primeira tentativa (Seção 3.1.2 — marca de versão do SVG); com a marca,
      2 segundos, DST não-vazio, 742 pontos válidos.
- [x] **0.3** `workers/embroidery/inkstitch_runner.py` criado — `run_inkstitch(svg, formats) -> dict[str, bytes]`,
      injeta a marca de versão automaticamente, roda via `subprocess.run` com timeout, descompacta o zip
      do stdout, `InkstitchError` em falha. 7 testes em `test_inkstitch_runner.py` (3 de validação de args
      sem depender do binário, 4 end-to-end que só rodam no container).
- [x] **0.4** `worker.py`: job `export` usa `run_inkstitch`, grava bytes ORIGINAIS (não reserializa).
- [x] **0.5** `worker.py`: `preview`/`stitch_data` pedem **PES** (não DST — Seção 3.1.4, cor embutida) e
      leem via `_pattern_from_bytes` (novo helper), reusando `pattern_to_stitch_json`/`pattern_to_preview_svg`.
- [x] **0.6** Compatibilidade validada e CORRIGIDA — os nomes de atributo que usávamos estavam quase todos
      errados (Seção 3.1.3); `svgConverter.ts::buildStitchAttributes` corrigida e testada (`svgConverter.test.ts`,
      17 testes). Também achado e corrigido: `COLOR_BREAK` vs `COLOR_CHANGE` na leitura de volta (Seção 3.1.5).
- [x] **0.7** Motor caseiro REMOVIDO por completo de `worker.py` (não só desligado) — `fill_path_with_stitches`,
      `satin_path_with_stitches`, `satin_centerwalk_underlay`, `path_to_polygon`, `_grating_segments`,
      `_merge_intervals`, `_segments_from_intersection`, `path_to_running_stitches`, `_add_lock_stitches`,
      `hex_to_rgb`, `svg_to_embroidery`, `path_to_polyline` — todos deletados (eram só usados entre si).
      `test_fill.py` deletado (testava só código morto); `test_worker.py` reescrito do zero (só
      `TestPatternToStitchJson` sobreviveu + novo `TestPatternFromBytes`). `shapely`/`svgpathtools`
      removidos de `requirements.txt` (não usados mais por nada).

### Riscos que realmente aconteceram (não hipotéticos — ver Seção 3.1 pros detalhes completos)
- ✅ **Headless precisou de mais pacotes que o esperado** (`xauth` + 3 libs Wayland) — 2 rodadas de
  build-erro-fix até funcionar.
- ✅ **O binário trava pra sempre sem erro** se faltar a marca de versão do SVG — o bug mais caro de
  diagnosticar (precisou `py-spy` com `--cap-add SYS_PTRACE`).
- ✅ **Quase todos os nomes de atributo estavam errados** — só descobrimos rodando e comparando
  contagem de pontos com valores bem diferentes; nenhum erro visível, tudo "funcionava" silenciosamente errado.
- **Tamanho da imagem**: aceitável (build ~30-40s depois do cache do binário).
- **Latência**: ~2-3s por export/preview via subprocess — ok, jobs são assíncronos via Redis.

### Verificação da Fase 0 — ✅ feita
- `docker compose build worker` ok. `docker run --rm ponto-studio-worker python3 -m unittest test_worker
  test_inkstitch_runner -v` → 15 testes OK. `test_analyze -v` → 39 testes OK (todos, incluindo os que usam
  vtracer — confirma que o segfault é só do ambiente Windows local, não do código).
- **End-to-end real**: SVG gerado pelo `convertProjectToSvg` de produção → `worker.process_job` de
  verdade (Redis fake) dentro do container → DST/PES válidos, cores corretas, 1 troca de cor detectada.
  Ver Seção 3.2 pros números exatos.
- **Ainda não testado nesta sessão**: fluxo completo via `docker compose up` (api+web+worker+redis reais,
  clicando "Exportar" na UI) e abrir o resultado num simulador de bordado externo de verdade. Recomendado
  antes de considerar a Fase 0 "pronta pra produção", mas o pipeline Python↔Ink/Stitch em si está validado.

---

## 5. Fase 1 — Schema de params + Fills (Tatami, Contour, Meander, Circular)

### Checkpoints
- [ ] **1.1** `packages/shared/src/index.ts`: transformar `StitchParams` numa **união discriminada por
      `type`**, cada fill com seus campos espelhando os `inkstitch:*` do Ink/Stitch:
  - `tatami`: `angle`, `rowSpacing` (derivado do `density`), `maxStitchLength`, `staggers`, `skipLast`,
    `underlay`, `expand`, `pullCompensation`.
  - `contour`: `contourStrategy` (`inner_to_outer` etc.), `avoidSelfCrossing`, `spacing`, `maxStitchLength`, `underlay`.
  - `meander`: `meanderScale`/densidade, `maxStitchLength`.
  - `circular`: `targetPoint` (default = centro do bbox da parte), `spacing`, `maxStitchLength`.
  - Manter defaults seguros + **retrocompat** (partes antigas = tatami).
- [ ] **1.2** `apps/api/src/services/svgConverter.ts`: `buildStitchAttributes` emite os `inkstitch:*`
      corretos por tipo de fill. Circular: emitir o marcador/param de target (centro por default).
      Manter `densityToMm` por tipo.
- [ ] **1.3** **Rotação:** trocar `ponto:rotation*` por **bake da rotação na matriz do `d`** (aplicar a
      transformação de rotação nas coordenadas do path no `svgConverter.ts`), porque o Ink/Stitch ignora
      atributos custom. Remover a leitura de `ponto:rotation` do worker (não é mais usado no export).
- [ ] **1.4** `apps/web/src/components/PropertiesPanel.tsx`: seletor de tipo de ponto com os fills
      suportados + params por tipo (avançados atrás de accordion). Rótulos amigáveis pra leigos.
- [ ] **1.5** `apps/web/src/utils/stitchHeuristics.ts` + métricas de `analyze.py`: estender
      `suggestStitchParams` pra escolher entre os fills (área grande → tatami; forma redonda/anelar →
      circular; textura leve/decorativa → meander), com **tatami como fallback**. Badge "sugerido" já existe.
- [ ] **1.6** `apps/web/src/store/projectStore.ts`: default e migração de partes antigas.

### Verificação da Fase 1
- Trocar o tipo de ponto de uma parte nas Propriedades e reexportar → o simulador reflete o método
  (tatami vs contour vs meander vs circular).
- Testes vitest: `svgConverter` emite os `inkstitch:*` certos por tipo; tipos `shared` compilam; UI.
- `stitchHeuristics.test.ts` estendido pros novos tipos.

---

## 6. Fase 2+ (fast-follow, um a um)

- [ ] **Fase 2 — Stroke** (running/bean/zigzag/ripple): emitir o path com `stroke` +
      `inkstitch:stroke_method` e params; pra uma parte preenchida, aplicar no contorno/centerline.
- [ ] **Fase 3 — Satin Column**: gerar geometria de coluna (2 trilhos + rungs) a partir da forma estreita
      (extração de rails via retângulo de área mínima / eixo médio — **geometria**, não algoritmo de ponto)
      e entregar ao Ink/Stitch; **fallback pra tatami** quando a extração falhar.
- [ ] **Fase 4 — Demais fills**: Guided (com linha-guia), Linear Gradient, Tartan, Cross Stitch.

---

## 7. Arquivos-chave (resumo)

**Criados na Fase 0 (prontos):**
- `workers/embroidery/inkstitch_runner.py` (+ `test_inkstitch_runner.py`) ✅

**A criar na Fase 1+:**
- Nenhum arquivo novo previsto — só edições nos existentes abaixo.

**Modificar na Fase 1:**
- `apps/api/src/services/svgConverter.ts` — params `inkstitch:*` por tipo de fill (contour/meander/circular
  além do tatami já corrigido); **bake de rotação no `d`** (rotação está quebrada hoje, ver 3.1/checkpoint 1.3)
- `packages/shared/src/index.ts` — `StitchParams` união discriminada
- `apps/web/src/components/PropertiesPanel.tsx` — UI por tipo
- `apps/web/src/utils/stitchHeuristics.ts` — sugestão entre os fills
- `apps/web/src/store/projectStore.ts` — default/migração

**Já prontos, reusar sem mexer:**
- `workers/embroidery/inkstitch_runner.py` (`run_inkstitch`), `worker.py` (`pattern_to_stitch_json`,
  `pattern_to_preview_svg`, `_svg_viewbox`, `_pattern_from_bytes`), `analyze.py` (cores + métricas),
  `splitSvgByColor`.

---

## 8. Workflow-alvo (visão do produto)

1. Importar imagem → motor gera SVG por cor, **fundindo cores semelhantes** (já existe:
   `analyze.py` + `splitSvgByColor`).
2. **Analisar cada path** pra sugerir o melhor ponto (heurística já existe em `stitchHeuristics.ts` +
   métricas de `analyze.py`; estender pra todos os tipos). *(Essa análise não existe no Ink/Stitch — é nossa.)*
3. Usuário ajusta o **tipo de ponto por parte** nas Propriedades (todos os tipos do Ink/Stitch).
4. Export → nosso SVG (geometria + `inkstitch:*`) → **Ink/Stitch (subprocess)** → arquivo de bordado.

---

## 9. Como verificar tudo (ambiente)

- **Docker é obrigatório** pra validar o motor: o Ink/Stitch só roda no Linux do container, e o vtracer
  (análise) segfaulta no Python 3.14/Windows local. Sem o Docker Desktop no ar, só dá pra rodar
  tsc + testes unitários que **não** dependem do worker.
- Comandos úteis:
  - `docker compose build worker` — reconstrói a imagem (baixa o binário do Ink/Stitch, ~600MB, cacheado).
  - `docker run --rm ponto-studio-worker python3 -m unittest test_worker test_inkstitch_runner test_analyze -v`
    — todos os testes do worker (`test_fill.py` não existe mais — foi removido na Fase 0).
  - `npx pnpm@9.15.4 --filter @ponto-studio/api test` / `--filter @ponto-studio/web test` — testes TS.
  - `npx pnpm@9.15.4 --filter @ponto-studio/web exec tsc --noEmit` / `--filter @ponto-studio/api exec tsc --noEmit` — typecheck.
- **Docker Desktop no Windows demora pra subir** (nesta máquina, historicamente 5-12 min desde
  `Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'` até `docker info` responder) —
  iniciar cedo e fazer outra coisa enquanto espera, não ficar em loop de `docker info` curto.
- **`docker exec`/`docker cp` com paths Unix no git-bash do Windows**: prefixar o comando com
  `MSYS_NO_PATHCONV=1` (senão o git-bash converte `/exports` etc. em caminho do Windows tipo
  `C:\Program Files\Git\exports`, quebrando tudo).

---

## 10. Log de progresso

| Data | Fase/Checkpoint | O que foi feito | Commit |
|------|-----------------|-----------------|--------|
| 2026-07-20 | — | Plano criado (este documento) | — |
| 2026-07-20 | Fase 0 (0.1–0.7) | Ink/Stitch integrado via subprocess; motor caseiro removido; 5 bugs de compatibilidade achados e corrigidos (ver Seção 3.1); e2e validado com SVG de produção real dentro do container | (não commitado ainda nesta sessão) |

# Motor de bordado — migração para o Ink/Stitch (subprocess)

> **Documento de execução autossuficiente.** Se a sessão de IA acabar, qualquer pessoa (ou outra IA)
> consegue continuar só lendo este arquivo — toda a pesquisa necessária está embutida aqui.
> Marque os checkpoints `[ ]` → `[x]` conforme for implementando.

**Última atualização:** 2026-07-20
**Status geral:** 🟢 Fase 0 + Fase 1 + Fase 2 + Fase 3 CONCLUÍDAS — motor real (Ink/Stitch) rodando com 8
tipos de ponto (Tatami/Contour/Meander/Circular/Running/Zigzag/Ripple/Satin Column), UI por tipo,
heurística de sugestão, rotação real. Próximo: Fase 4 (Guided/Linear Gradient/Tartan/Cross Stitch).

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
  pros **5 problemas não-óbvios** encontrados e corrigidos (leitura obrigatória antes de mexer na Fase 2+).
- **Fase 1 concluída em 2026-07-20**: `StitchParams` virou união discriminada com 6 tipos (tatami/contour/
  meander/circular/satin-legado/running); rotação agora é embutida DIRETO nas coordenadas do path (não
  mais um atributo custom ignorado pelo Ink/Stitch); UI (`PropertiesPanel`) mostra só os controles válidos
  por tipo; heurística estendida com `circular` pra formas arredondadas. Ver Seção 5.1 pros achados
  críticos (nomes de atributo ERRADOS descobertos via teste empírico, incluindo que `tatami_fill` nunca
  foi um `fill_method` válido — o nome certo é `auto_fill`).
- **Fase 2 concluída em 2026-07-20**: Stroke — `zigzag`/`ripple` novos, `running` ganhou `repeats`/
  `beanStitchRepeats`. Achado CRÍTICO no início da fase (corrigido, afetava código já commitado da Fase 1):
  o Ink/Stitch cria `FillStitch` e `Stroke` **independentemente** (por `fill`/`stroke` CSS, não é
  if/else) — nosso `running` emitia `fill=cor stroke="none"`, o que criava um `auto_fill` FANTASMA por
  baixo do ponto corrido (confirmado: 286 pontos vs 48 na mesma geometria só trocando `fill`/`stroke`).
  Ver Seção 6.1 pros detalhes e por que isso também elimina o campo `angle` do `running` (nunca teve
  efeito real — só afetava o fill fantasma).
- **Fase 3 concluída em 2026-07-20**: Satin Column real (`satinColumn`), **escopo reduzido de propósito**
  (decisão explícita do usuário) — só extrai os 2 trilhos de formas SIMPLES (retângulo/elipse/livre, sem
  `svgContent`); partes vindas de importação de imagem caem no fallback pra `tatami`. Ver Seção 7.1 pro
  porquê e pro achado de que, pra coluna RETA (nosso escopo), Cetim e Ziguezague geram a MESMA geometria —
  o ganho de shipar Cetim agora é `pull_compensation_mm`/`center_walk_underlay` (que `zigzag_stitch` não
  tem) e preparar terreno pra colunas curvas numa fase futura.

### Checklist de alto nível
- [x] **Fase 0** — Runner do Ink/Stitch no worker (fundação; validado headless) ✅ 2026-07-20
- [x] **Fase 1** — Schema de params + Fills (Tatami, Contour, Meander, Circular) + UI + heurística ✅ 2026-07-20
- [x] **Fase 2** — Stroke (running/bean/zigzag/ripple) ✅ 2026-07-20
- [x] **Fase 3** — Satin Column (formas simples; extração geral de polígono fica pra depois) ✅ 2026-07-20
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

## 3. Estado atual do código (pós Fase 0 + Fase 1 — 2026-07-20)

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
- **`apps/api/src/services/svgConverter.ts`** — `buildStitchAttributes` reescrita com um `switch` por
  `stitch.type`, emitindo só os atributos que cada `fill_method` REALMENTE lê (ver 5.1 — `angle`/
  `pull_compensation_mm` não existem pra contour/meander/circular; `row_spacing_mm`/`max_stitch_length_mm`
  não existem pra meander). Nomes/formato dos atributos: `inkstitch:row_spacing_mm` (não `line_distance`),
  `inkstitch:fill_underlay="true"/"false"` sempre explícito (default do Ink/Stitch é `true`),
  `inkstitch:max_stitch_length_mm`, `inkstitch:running_stitch_length_mm`. **Valores sempre número puro,
  sem sufixo "mm"**. Tatami usa `fill_method="auto_fill"` (não `"tatami_fill"` — nunca foi um valor
  válido, ver 5.1.1). Rotação embutida DIRETO nas coordenadas do `d` via `rotatePathData` (nova em
  `svgTransform.ts`) — `ponto:rotation*`/`xmlns:ponto` foram REMOVIDOS (o Ink/Stitch nunca leu esses
  atributos custom). `satin` continua mapeando pra `contour_fill` (nunca foi cetim de verdade — ver Fase 3).
- **`packages/shared/src/index.ts`** — `StitchParams` é uma **união discriminada** com 6 membros:
  `TatamiStitchParams`, `ContourStitchParams`, `MeanderStitchParams`, `CircularStitchParams`,
  `SatinStitchParams` (`@deprecated`, alias de contour), `RunningStitchParams`. Cada um só tem os campos
  que o Ink/Stitch de fato lê pra aquele `fill_method` (ver tabela em 5.1.2).
- **`apps/web/src/components/PropertiesPanel.tsx`** — reescrito: seletor com 5 opções (sem "satin" como
  escolha nova), controles condicionais por tipo (`stitch.type === "x" && (...)`), `buildStitchForType`
  migra campos compatíveis ao trocar de tipo.
- **`apps/web/src/utils/stitchHeuristics.ts`** — heurística atualizada: coluna alongada → tatami com
  ângulo perpendicular (não mais "satin"); nova regra de forma arredondada → circular.
- **`apps/web/src/components/PartsPanel.tsx`** — `STITCH_LABEL` com rótulos pros 4 novos tipos + "satin"
  mostrado como "Contorno".
- **`apps/web/src/store/projectStore.ts`** — inalterado (default `{type:"tatami", density:0.6, angle:45}`
  já é uma `TatamiStitchParams` válida).
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

## 5. Fase 1 — Schema de params + Fills (Tatami, Contour, Meander, Circular) — ✅ CONCLUÍDA 2026-07-20

### Checkpoints
- [x] **1.1** `packages/shared/src/index.ts`: `StitchParams` virou **união discriminada por `type`** com 6
      membros: `TatamiStitchParams` (angle, density, underlay?, pullCompensationMm?), `ContourStitchParams`
      (density, contourStrategy?, avoidSelfCrossing?, underlay? — **sem** angle/pullCompensationMm),
      `MeanderStitchParams` (density, pattern?, angle?, underlay? — **sem** row_spacing/max_stitch_length),
      `CircularStitchParams` (density, underlay? — **sem** angle/maxStitchLength), `SatinStitchParams`
      (`@deprecated` alias legado, mecanicamente idêntico a contour, mantido só pra dados salvos antigos),
      `RunningStitchParams` (density, angle). Sem "target point" custom pro circular (exigiria o sistema
      de "commands" visuais do Ink/Stitch — fora do escopo, usa sempre o centroide).
- [x] **1.2** `apps/api/src/services/svgConverter.ts`: `buildStitchAttributes` reescrita com um `switch`
      por tipo, emitindo só os atributos que aquele `fill_method` REALMENTE lê (ver 5.1 — vários eram
      emitidos à toa antes). `densityToRange` substituiu `densityToMm` (mais genérica, recebe o range
      como tupla). `DEFAULT_MEANDER_PATTERN = "N4-21c"` (um dos 75 tiles bundlados, sem nome amigável).
- [x] **1.3** Rotação: `rotatePathData(d, angleDeg, cx, cy)` nova em `svgTransform.ts` — rotaciona as
      coordenadas do `d` de verdade (H/V viram L, M com pares extras vira LINETO implícito, arco soma o
      ângulo no `x-axis-rotation`). 9 testes unitários cobrindo cada caso, mais 2 testes de integração no
      `svgConverter.test.ts` com valores conferidos à mão. `ponto:rotation*`/`xmlns:ponto` REMOVIDOS por
      completo (o Ink/Stitch nunca leu esses atributos — rotação estava silenciosamente quebrada desde a
      Fase 0 até este fix).
- [x] **1.4** `PropertiesPanel.tsx` reescrito: seletor com 5 opções (Tatami/Contorno/Circular/Meandro/
      Corrido — "satin" não é mais oferecido como escolha nova, um elemento legado com `type:"satin"` é
      tratado como "Contorno" em toda a tela). Ângulo só aparece pra tatami/running (os únicos que o
      Ink/Stitch lê). Avançado mostra: tatami→underlay+pull compensation; contour→underlay+direção do
      contorno (3 opções)+evitar auto-cruzamento; meander→underlay+ângulo do padrão; circular→underlay;
      running→nada. `buildStitchForType` migra os campos compatíveis ao trocar de tipo.
- [x] **1.5** `stitchHeuristics.ts`: heurística ATUALIZADA — coluna alongada agora sugere **tatami** com
      ângulo perpendicular (não mais "satin", que nunca teve zigue-zague real e não lê `angle` mesmo);
      nova regra "forma arredondada + área pequena/média (< 400mm²) → circular". `contour`/`meander`
      ficam de fora da sugestão automática (sem sinal geométrico claro pra decidir — usuário escolhe manual).
- [x] **1.6** `projectStore.ts`/`Editor.tsx`: **nenhuma mudança necessária** — o default (`{type:"tatami",
      density:0.6, angle:45}`) já era uma `TatamiStitchParams` válida, e dados antigos com `type:"satin"`
      fluem em runtime normalmente (JS não impõe a união) com o tratamento de compat já feito na UI (1.4).

### 5.1 Achados críticos da Fase 1 (leitura obrigatória antes de mexer em Fase 2+)

**1. `inkstitch:fill_method="tatami_fill"` NUNCA foi um valor válido** — o nome real do fill "tatami" no
   Ink/Stitch é **`auto_fill`**. Confirmado empiricamente: gerando o mesmo desenho com `fill_method=
   "tatami_fill"` vs `fill_method="auto_fill"`, a contagem de pontos e a bbox saem **idênticas** — ou
   seja, o valor desconhecido "tatami_fill" caía num fallback silencioso pro default (`auto_fill`) desde
   a Fase 0. Funcionava por sorte (o default JÁ era o que queríamos), mas o nome estava errado. **Fix**:
   `buildStitchAttributes` agora emite `auto_fill` explicitamente.

**2. Cada `fill_method` só lê um SUBCONJUNTO de parâmetros — testado um por um, não por suposição**
   (via `select_items` no código-fonte do Ink/Stitch E confirmado rodando o binário comparando geometria
   resultante com valores bem diferentes):
   | Parâmetro | tatami (auto_fill) | contour_fill | meander_fill | circular_fill |
   |---|---|---|---|---|
   | `angle` | ✅ lido | ❌ ignorado | ❌ ignorado (usa `meander_angle` à parte) | ❌ ignorado |
   | `row_spacing_mm` | ✅ | ✅ | ❌ **ignorado** (confirmado: preenchimento idêntico com/sem) | ✅ |
   | `max_stitch_length_mm` | ✅ | ✅ | ❌ ignorado | ❌ ignorado |
   | `fill_underlay` | ✅ | ✅ | ✅ | ✅ (universal, sem gating) |
   | `pull_compensation_mm` | ✅ | ❌ **ignorado** (testado: bbox idêntica com/sem) | ❌ | ❌ |
   Conclusão prática: **nosso código antigo emitia `pull_compensation_mm` pro tipo "satin" (→contour_fill)
   desde sempre e isso NUNCA teve efeito nenhum** — no-op silencioso, igual o bug do `tatami_fill`.

**3. `contour_strategy` e `meander_pattern` — valores confirmados**: `contour_strategy` aceita `"0"`
   (de fora pra dentro), `"1"` (espiral simples), `"2"` (espiral dupla) como STRING do índice numérico
   (não o nome em inglês). `meander_pattern` é o NOME DE PASTA de um dos 75 tiles bundlados em
   `/opt/inkstitch/tiles/*/tile.json` (ex.: `"N4-21c"`, confirmado válido) — sem nome amigável nenhum
   (campo `description` de todos os `tile.json` testados vinha vazio), por isso não tem seletor visual
   na Fase 1 (mostrar 75 códigos crípticos pra quem não sabe digitalizar seria pior que não oferecer).

**4. `circular_fill` não tem atributo de "ponto-alvo" simples.** O centro customizado do Ink/Stitch é lido
   via `self.get_command('target_point')` — um elemento visual "command" do próprio Ink/Stitch (símbolo +
   linha conectora no SVG), não um atributo `inkstitch:target_x/y`. Implementar isso exigiria replicar o
   formato desses "commands" (fora do escopo da Fase 1) — por ora, `circular_fill` sempre usa
   `shape.centroid` (comportamento default do próprio Ink/Stitch quando não acha o command).

**5. `rotatePathData` é bem mais complexo que `scalePathData`** (que já existia) porque rotação MISTURA
   x e y — não dá pra tratar cada eixo independentemente. H/V precisam virar L (uma rotação de 90° faz
   uma linha horizontal deixar de ser horizontal); pares extras depois do primeiro `M` são LINETO
   implícito por regra do spec SVG (não outro `M`); arcos (`A`) precisam somar o ângulo de rotação ao
   próprio `x-axis-rotation` do arco, além de rotacionar o ponto final. A mesma convenção de sinal do
   `svgpathtools.Path.rotated()` do Python (que fazia a rotação no worker antes da Fase 0) foi preservada
   (`x' = cx + dx·cos − dy·sin`, `y' = cy + dx·sin + dy·cos`) — sem mudança de comportamento visível pro
   usuário, só de ONDE a rotação acontece (TS em vez de Python, já que o Ink/Stitch não vê `<g transform>`
   nem atributos custom).

### 5.2 Verificação end-to-end já feita (2026-07-20)
SVG real gerado por `convertProjectToSvg` com um elemento de CADA tipo (tatami/contour/meander/circular/
running, canvas 60×60mm), processado via `worker.process_job` de verdade dentro do container:
- 2492 pontos totais, 5 threads distintas, 4 `COLOR_CHANGE` (entre os 5 blocos) — todos corretos.
- Contagem e bbox por bloco, todos com geometria real e corretamente posicionada: tatami 661pts,
  contour 519pts, meander 179pts (menos denso, esperado — é textura leve), circular 687pts, running 431pts.
- Nenhum tipo gerou 0 pontos ou geometria degenerada.

### Verificação da Fase 1 — ✅ feita
- `npx pnpm@9.15.4 --filter @ponto-studio/api test` → 42 testes OK (svgTransform 22 + svgConverter 20).
- `npx pnpm@9.15.4 --filter @ponto-studio/web test` → 67 testes OK (stitchHeuristics 12 + resto inalterado).
- `tsc --noEmit` limpo em `api` e `web`.
- **Ainda não testado nesta sessão**: trocar o tipo de ponto pela UI de verdade no browser (Properties
  Panel) e conferir visualmente; fluxo completo via `docker compose up` clicando "Exportar".

---

## 6. Fase 2 — Stroke (running/bean/zigzag/ripple) — ✅ CONCLUÍDA 2026-07-20

### 6.1 Achado crítico (corrigido — afetava código já commitado na Fase 1)

**O Ink/Stitch decide `FillStitch` vs `Stroke` de forma INDEPENDENTE, não mutuamente exclusiva.**
Fonte: `lib/elements/utils.py::node_to_elements` (v3.2.2):
```python
if element.get_style("fill", "black") and not element.get_style('fill-opacity', 1) == "0":
    elements.append(FillStitch(node))
if element.get_style("stroke"):
    ...
    elements.append(Stroke(node))
```
Ou seja: um `<path>` com `fill="cor" stroke="none"` (o padrão que usávamos pra `running` desde a Fase 0)
tem `fill` truthy (`get_style` só zera pra `"none"`/`"None"`) → SEMPRE cria um `FillStitch` também, com o
`fill_method` DEFAULT (`auto_fill`/tatami) quando não emitimos esse atributo — um preenchimento fantasma
por baixo do ponto corrido, com o MESMO fio (mesma cor = sem `COLOR_CHANGE` separando os dois, invisível
na contagem de blocos por cor).

**Confirmado empiricamente** (metodologia igual à Fase 0/1: SVG mínimo → `run_inkstitch` → `pyembroidery.read`
→ contar pontos): o mesmo retângulo fino (`inkstitch:stroke_method="running_stitch"`,
`running_stitch_length_mm="2.5"`) gerava **286 pontos** com `fill="cor" stroke="none"` vs **48 pontos**
com `fill="none" stroke="cor"` — os 238 pontos a mais eram o `auto_fill` fantasma. Isso reintroduzia
exatamente o bug original ("parece impressora") em qualquer parte do tipo `running` já exportada nas
Fases 0/1.

**Fix**: `STROKE_FAMILY_TYPES` em `svgConverter.ts` (`running`/`zigzag`/`ripple`) — esses tipos SEMPRE
emitem `fill="none" stroke=cor` (nunca os dois juntos); os fills (`tatami`/`contour`/`meander`/`circular`/
`satin`) continuam `fill=cor stroke="none"`. `buildStitchAttributes` agora devolve `{ presentation, inkstitch }`
em vez de uma string única, pra separar essa decisão de apresentação dos atributos `inkstitch:*`.

**Consequência pro schema**: o campo `angle` que `RunningStitchParams` tinha desde a Fase 0 foi REMOVIDO —
`Stroke`/`running_stitch` nunca leu `angle` (é exclusivo de `FillStitch`/`auto_fill`, `lib/elements/fill_stitch.py`);
o campo só parecia funcionar porque afetava o `auto_fill` fantasma, nunca o ponto corrido em si.

### 6.2 Atributos confirmados por tipo (via `lib/elements/stroke.py`, v3.2.2, + teste empírico)

| Tipo (`stroke_method`) | Atributos emitidos | Confirmado empiricamente |
|---|---|---|
| `running` (`running_stitch`) | `running_stitch_length_mm`, `repeats`?, `bean_stitch_repeats`? | repeats=1→29pts, repeats=3→63pts; bean=1→63pts (ambos ~triplicam, igual ao esperado: "ida-volta-ida") |
| `zigzag` (`zigzag_stitch`) | `zigzag_spacing_mm`, `stroke_pull_compensation_mm`?, `repeats`? + `stroke-width` (CSS, mm) | width=3mm→zigzag 3mm real, width=6mm→6mm real (escala 1:1 com `stroke-width`); spacing=0.4mm→213pts, spacing=0.2mm→413pts (dobra, como esperado) |
| `ripple` (`ripple_stitch`) | `running_stitch_length_mm`, `line_count`?, `join_style`?, `repeats`?, `bean_stitch_repeats`? | default (line_count=10 implícito)→272pts; line_count=20→532pts; line_count=3→91pts — funciona SEM linha-guia, usa `shape.centroid` (comportamento default do Ink/Stitch, `get_ripple_target()`) |

**`ripple_stitch` sem linha-guia**: o `ripple_stitch` do Ink/Stitch normalmente pode seguir uma "linha-guia"
(satin guide line, elemento SVG à parte) pra mirar numa forma customizada — isso é a mesma infraestrutura
de "commands" visuais que também bloqueia o `target_point` do `circular_fill` (ver Seção 5.1, achado #4).
Sem linha-guia, ele simplesmente gera cópias concêntricas do PRÓPRIO traço ao redor do centroide da forma
— suficiente pro nosso caso de uso (textura decorativa), evitando replicar o formato de "commands" do
Ink/Stitch. `scale_axis`/`scale_start`/`scale_end`/`rotate_ripples`/`grid_size_mm`/`reverse_rails` (todos
exclusivos de ripple GUIADO) ficam de fora do schema por ora.

`stroke-width` (CSS, não `inkstitch:*`) é o único parâmetro de largura do zigzag — vem de
`self.stroke_width` em `lib/elements/element.py` (`get_style("stroke-width", "1.0")`), lido como número
puro = mm (mesma convenção do resto do documento: 1 user unit = 1mm).

### Verificação da Fase 2 — ✅ feita
- Testes empíricos A/B no container (repeats/bean/zigzag width+spacing/ripple line_count) — todos batendo
  com o comportamento esperado, ver tabela acima.
- SVG de produção com um elemento de CADA um dos 7 tipos (`convertProjectToSvg` real, canvas 60×90mm),
  processado via `worker.process_job` dentro do container: **2702 pontos totais, 7 blocos de cor**, todos
  com geometria não-vazia e bbox na posição esperada (nenhum tipo gerou 0 pontos).
- `npx pnpm@9.15.4 --filter @ponto-studio/api test` → 47 testes OK (svgTransform 22 + svgConverter 25).
- `npx pnpm@9.15.4 --filter @ponto-studio/web test` → 67 testes OK (stitchHeuristics 12 + resto inalterado).
- `tsc --noEmit` limpo em `api` e `web`.
- **Ainda não testado nesta sessão**: trocar pra zigzag/ripple pela UI de verdade no browser; fluxo
  completo via `docker compose up` clicando "Exportar".

---

## 7. Fase 3 — Satin Column — ✅ CONCLUÍDA 2026-07-20

### 7.1 Decisão de escopo (explícita do usuário) e por quê

O `SatinColumn` do Ink/Stitch (`lib/elements/satin_column.py`, v3.2.2) exige um `<path>` com **2+
subcaminhos** (os trilhos/rails) — pro modo "old-style" (sem rungs explícitos), os 2 trilhos precisam ter
o MESMO número de pontos, e a costura conecta ponto[i] do trilho 1 com ponto[i] do trilho 2. Extrair esses
2 trilhos de um POLÍGONO ARBITRÁRIO (contorno vindo de importação de imagem/IA) é um problema geométrico
sério: precisa achatar curvas Bezier em polilinhas (não existe ainda no lado TS — Python tinha
`svgpathtools`, removido na Fase 0), dividir o contorno nos 2 pontos extremos do eixo principal, e
reamostrar os 2 lados resultantes pro mesmo número de pontos por comprimento de arco.

Diante do risco/esforço, o usuário optou por um **escopo reduzido**: só implementar a extração pra
**formas simples desenhadas no editor** (retângulo/elipse/desenho livre — ferramenta do tldraw), cujo
`svgPath` é **sempre** o bounding box retangular da forma (ver `Editor.tsx`, o listener que sincroniza
`svgPath: rectToSvgPath(...)` pra QUALQUER shape, independente do tipo). Isso torna a extração **trivial**:
os 2 lados MAIS COMPRIDOS do retângulo são os 2 trilhos, sem nenhuma análise de polígono. Partes com
`svgContent` (geometria complexa, vinda da análise de imagem) caem no **fallback pra `tatami`** com a
mesma densidade — tanto no `svgConverter.ts` (rede de segurança pra dados salvos) quanto na UI (a opção
"Cetim" nem aparece no seletor de tipo de ponto quando o elemento tem `svgContent`).

Extração geral de polígono (pra colunas curvas vindas de importação de imagem) fica pra uma fase futura.

### 7.2 Construção dos trilhos (rects) e atributos confirmados

`satinColumnToSvgGroup` em `svgConverter.ts`: dado o bbox `(x, y, width, height)` do elemento (mesma
`parseElementBoundsMm` já usada pra rotação), os 2 trilhos correm ao longo do lado mais comprido — os 2
pontos de cada trilho DEVEM percorrer a MESMA direção (ex.: ambos esquerda→direita), senão o Ink/Stitch
pareia os pontos errados e o zigue-zague sai cruzado:

```
width >= height (coluna horizontal):
  d = "M x,y L x+width,y  M x,y+height L x+width,y+height"   (topo e base, ambos →)

height > width (coluna vertical):
  d = "M x,y L x,y+height  M x+width,y L x+width,y+height"   (esquerda e direita, ambos ↓)
```

`SatinColumn.color` lê a cor do `stroke` (não do `fill`) — por isso `satinColumn` entra no
`STROKE_FAMILY_TYPES` junto com running/zigzag/ripple (`fill="none" stroke=cor`).

Atributos confirmados empiricamente (SVG mínimo, coluna reta 40mm×10mm, dentro do container):

| Atributo | Efeito confirmado |
|---|---|
| `satin_column="true"` | Obrigatório — sem ele (mesmo com 2 subpaths + stroke), o Ink/Stitch trataria como `Stroke` comum |
| `satin_method="satin_column"` | Já é o default (`get_param('satin_method', 'satin_column')`), emitido mesmo assim por clareza |
| `zigzag_spacing_mm` | 0.4mm→213pts, 0.2mm→413pts (dobra, mesmo nome/comportamento do zigzag simples) |
| `pull_compensation_mm` | 1mm→bbox largura +2mm (1mm de cada lado) — nome DIFERENTE do `stroke_pull_compensation_mm` do zigzag simples |
| `center_walk_underlay="true"` | 213→248 pontos (passe extra pelo centro entre os trilhos, params default: 3mm/2 repetições/50% posição) |

**Achado notável**: pra uma coluna RETA (nosso escopo), `satin_column` com 2 trilhos paralelos gera
**exatamente a mesma contagem/geometria de pontos** que um `zigzag_stitch` simples (Stroke) com
`stroke-width` igual à distância entre os trilhos — confirmado (213 pontos nos dois casos). Isso faz
sentido matematicamente: só há diferença real entre os dois métodos quando a coluna CURVA ou muda de
largura ao longo do comprimento — nenhum dos dois casos é o nosso (retângulo reto). O valor prático de
shipar "Cetim" já nesta fase é: (1) `pull_compensation_mm` e `center_walk_underlay`, que o `zigzag_stitch`
simples não tem; (2) preparar o terreno pro Fase 3+ (colunas curvas de verdade).

### Verificação da Fase 3 — ✅ feita
- Testes empíricos A/B no container: `zigzag_spacing_mm`, `pull_compensation_mm`, `center_walk_underlay` —
  todos com o efeito esperado (tabela acima), incluindo a comparação satin-reto vs zigzag-simples.
- SVG de produção com um elemento de CADA um dos 8 tipos (`convertProjectToSvg` real, canvas 60×100mm),
  processado via `worker.process_job` dentro do container: **3018 pontos totais, 8 blocos de cor**, todos
  com geometria não-vazia e bbox na posição esperada.
- `npx pnpm@9.15.4 --filter @ponto-studio/api test` → 51 testes OK (svgTransform 22 + svgConverter 29,
  incluindo 4 novos testes de `satinColumn`: trilhos horizontais, trilhos verticais, pull_compensation/
  underlay, e o fallback pra tatami quando há `svgContent`).
- `npx pnpm@9.15.4 --filter @ponto-studio/web test` → 67 testes OK.
- `tsc --noEmit` limpo em `api` e `web`.
- **Ainda não testado nesta sessão**: escolher "Cetim" pela UI de verdade no browser num retângulo
  desenhado; fluxo completo via `docker compose up` clicando "Exportar".

---

## 8. Fase 4+ (fast-follow)

- [ ] **Fase 4 — Demais fills**: Guided (com linha-guia), Linear Gradient, Tartan, Cross Stitch.
- [ ] **Extensão futura do Satin Column**: extração de trilhos pra polígono arbitrário (formas vindas de
      importação de imagem/IA) — precisa achatar curvas Bezier e reamostrar os 2 lados do contorno pelo
      mesmo número de pontos por comprimento de arco. Maior risco/esforço do roadmap todo.

---

## 9. Arquivos-chave (resumo)

**Criados nas Fases 0/1 (prontos):**
- `workers/embroidery/inkstitch_runner.py` (+ `test_inkstitch_runner.py`) ✅
- `rotatePathData` em `apps/api/src/services/svgTransform.ts` ✅

**Fase 2 (Stroke) e Fase 3 (Satin Column) não precisaram de arquivo novo** — só edições nos mesmos
arquivos da Fase 1 (`satinColumnToSvgGroup` é uma função nova, mas dentro do `svgConverter.ts` existente).
Extração de trilhos pra polígono arbitrário (Fase 3+, ver Seção 8) provavelmente precisa de um helper
novo de geometria (achatar curvas + reamostrar por comprimento de arco).

**Fases 0/1/2/3 completas — arquivos já modificados (não mexer de novo sem motivo):**
- `apps/api/src/services/svgConverter.ts` — `buildStitchAttributes` por tipo + rotação embutida no `d` +
  `STROKE_FAMILY_TYPES` (fill vs stroke por família, não por tipo individual) + `satinColumnToSvgGroup`
  (extração de trilhos de bbox retangular) + `elementToSvgGroupByShape` (fallback pra tatami quando
  `satinColumn` tem `svgContent`)
- `packages/shared/src/index.ts` — `StitchParams` união discriminada (9 tipos: tatami/contour/meander/
  circular/satin-legado/running/zigzag/ripple/satinColumn)
- `apps/web/src/components/PropertiesPanel.tsx` — UI por tipo; opção "Cetim" some quando `svgContent` existe
- `apps/web/src/utils/stitchHeuristics.ts` — sugestão entre tatami/circular/running (zigzag/ripple/
  satinColumn ficam de fora da sugestão automática — heurística só roda sobre camadas de imagem
  analisada, que SEMPRE têm `svgContent`, logo `satinColumn` nunca seria elegível de qualquer forma)
- `apps/web/src/components/PartsPanel.tsx` — rótulos por tipo

**Já prontos, reusar sem mexer:**
- `workers/embroidery/inkstitch_runner.py` (`run_inkstitch`), `worker.py` (`pattern_to_stitch_json`,
  `pattern_to_preview_svg`, `_svg_viewbox`, `_pattern_from_bytes`), `analyze.py` (cores + métricas),
  `splitSvgByColor`, `rotatePathData`/`scalePathData` (`svgTransform.ts`).

---

## 10. Workflow-alvo (visão do produto)

1. Importar imagem → motor gera SVG por cor, **fundindo cores semelhantes** (já existe:
   `analyze.py` + `splitSvgByColor`).
2. **Analisar cada path** pra sugerir o melhor ponto (heurística já existe em `stitchHeuristics.ts` +
   métricas de `analyze.py`; estender pra todos os tipos). *(Essa análise não existe no Ink/Stitch — é nossa.)*
3. Usuário ajusta o **tipo de ponto por parte** nas Propriedades (todos os tipos do Ink/Stitch).
4. Export → nosso SVG (geometria + `inkstitch:*`) → **Ink/Stitch (subprocess)** → arquivo de bordado.

---

## 11. Como verificar tudo (ambiente)

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

## 12. Log de progresso

| Data | Fase/Checkpoint | O que foi feito | Commit |
|------|-----------------|-----------------|--------|
| 2026-07-20 | — | Plano criado (este documento) | — |
| 2026-07-20 | Fase 0 (0.1–0.7) | Ink/Stitch integrado via subprocess; motor caseiro removido; 5 bugs de compatibilidade achados e corrigidos (ver Seção 3.1); e2e validado com SVG de produção real dentro do container | ed2958d |
| 2026-07-20 | Fase 1 (1.1–1.6) | StitchParams união discriminada (6 tipos); atributos inkstitch:* corrigidos por tipo (tatami_fill→auto_fill, pull_compensation/angle removidos de contour/meander/circular); rotação embutida no `d` via `rotatePathData` (novo, com 9 testes); PropertiesPanel reescrito; heurística estendida (circular); e2e validado com os 5 tipos via SVG de produção real | c1198c8 |
| 2026-07-20 | Fase 2 (2.0–2.4) | Achado crítico corrigido: fill fantasma em stroke-family (FillStitch+Stroke não são mutuamente exclusivos no Ink/Stitch); `running` perdeu `angle` (nunca teve efeito real) e ganhou `repeats`/`beanStitchRepeats`; tipos novos `zigzag` e `ripple`; `buildStitchAttributes` devolve `{presentation, inkstitch}`; PropertiesPanel com controles novos; e2e validado com os 7 tipos via SVG de produção real (2702 pontos, 7 blocos, todos com geometria) | 2786631 |
| 2026-07-20 | Fase 3 (3.1–3.4) | Satin Column real (`satinColumn`), escopo reduzido a formas simples (decisão explícita do usuário) — trilhos extraídos trivialmente do bbox retangular; fallback pra tatami quando há `svgContent`; opção "Cetim" some da UI nesse caso. Achado: coluna reta gera geometria idêntica a zigzag_stitch simples (a diferença só aparece em colunas curvas, fora do escopo). e2e validado com os 8 tipos via SVG de produção real (3018 pontos, 8 blocos, todos com geometria) | (não commitado ainda nesta sessão) |

# Plano de Refatoração — `workflows/epub-structuring`

**Projeto:** `extrair_novel`  
**Módulo:** `workflows/epub-structuring`  
**Objetivo deste documento:** orientar outra IA na análise e implementação incremental da evolução do módulo, com foco inicial em:

1. criação de um **menu executável no terminal**;
2. implementação da feature **`8. 🧹 Corrigir conteúdo pré-capítulo`**;
3. suporte a **um ou vários EPUBs de entrada**;
4. possibilidade futura de **corrigir vários EPUBs e reuni-los em um único EPUB final**;
5. preservação integral do que já funciona hoje, evitando uma refatoração ampla e arriscada logo no início.

> **Regra principal:** não reescrever o workflow existente antes de provar que isso é necessário. A evolução deve ser incremental, com caracterização, isolamento das novas features e testes de regressão.

---

# 0. Status de Execução dos Milestones

Atualizado em: 2026-08-11.

Este bloco registra o que já foi executado localmente. O restante do documento continua sendo o plano técnico original.

## M0 — Baseline e caracterização

**Status:** concluído.

- Criado `baseline_report.md`.
- Registrado estado do Git/worktree.
- Caracterizado o fluxo real de `src/main.js`.
- Confirmado comportamento de `findSingleEpub()`.
- Confirmados pontos de TOC/NCX, anchors, frontmatter, builders e hardcode de 25 capítulos.
- Baseline inicial validado com a suíte passando.

## M1 — Menu de terminal

**Status:** concluído.

- Adicionado `npm run menu`.
- Criado menu inicial em `src/cli/`.
- Mantido `npm start` apontando para o pipeline legado.
- Opção de processamento completo chama `src/main.js` sem refatorar o motor.

## M2 — Feature 8: análise e preview

**Status:** concluído.

- Criada seleção de EPUB sem usar `findSingleEpub()`.
- Criado analyzer de conteúdo pré-capítulo.
- Criado preview e relatório JSON.
- A primeira implementação não encontrou boundary real no EPUB principal quando o NCX não tinha anchor útil.

## M2.1 — Boundary por internal-dom

**Status:** concluído.

- Analyzer passou a usar fallback `internal-dom`.
- Reutilizados analyzers/parsers existentes.
- Boundary real encontrado com `confidence: high`.
- Caso real diagnosticado como `candidate_found`.

## M3 — Correção pré-capítulo em cópia

**Status:** concluído.

- Criado fixer não destrutivo.
- Correção aplicada apenas em cópia em `output/fixes/`.
- Original preservado.
- Idempotência comprovada.
- Alteração restrita ao XHTML alvo.

## M4 — Correção de vários EPUBs em lote

**Status:** concluído.

- Batch tratado como orquestração.
- Seleção múltipla aceita `todos`, listas e ranges.
- Cada EPUB é analisado individualmente.
- Apenas candidatos seguros são corrigidos.
- Relatório batch gerado.

## M5 — Inventário, ordenação e precheck para merge

**Status:** concluído.

- Criados módulos em `src/features/merge/`.
- Precheck inventaria fontes, ranges, metadados, navegação, capa e recursos.
- Ordenação usa faixa real de capítulos, não ordem lexicográfica.
- Gaps, overlaps, duplicatas, diferenças de metadados e colisões de assets são registrados.
- Relatório gerado em `reports/merge/merge_precheck_report.json`.

## M6 — Merge real de múltiplos EPUBs

**Status:** implementado.

- Criado merge real em novo EPUB.
- Merge usa `precheck.orderedSources`.
- Não concatena ZIPs.
- Não altera EPUBs originais.
- Gera `content.opf`, `nav.xhtml`, `toc.ncx` e capítulos novos.
- Reescreve referências relativas para recursos.
- Deduplica recursos com mesmo path/hash.
- Namespaceia colisões com mesmo path/hash diferente.
- Gera `reports/merge/merge_report.json`.
- Testes com fixtures multi-source passando.

## M6.1 — Validação real multi-source

**Status:** concluído com 2 EPUBs reais.

Arquivos reais usados:

```text
input/novel capitulos 1 a 60 - ch.epub
input/novel capitulos 61 a 120 - ch.epub
```

Resultado:

- Precheck `ready_for_merge`.
- `sourceCount = 2`.
- Ranges detectados por `internal-dom` com confiança alta:
  - `1–60`;
  - `61–120`.
- Sem gaps, overlaps ou duplicatas.
- Diferença de título registrada.
- CSS duplicado classificado como `samePathSameHash`.
- Capas com mesmo path e hash diferente classificadas como `samePathDifferentHash`.
- Merge real gerado em `output/merged/`.
- EPUB final validado com:
  - `chapterCount = 120`;
  - `navEntries = 120`;
  - `ncxEntries = 120`;
  - `spineEntries = 120`;
  - primeiro capítulo `1`;
  - último capítulo `120`;
  - nenhum capítulo ausente;
  - nenhum capítulo duplicado.
- Fronteira capítulo 60 → 61 inspecionada sem conteúdo editorial artificial entre as partes.
- Corrigido bug encontrado durante M6.1: apenas a capa escolhida fica marcada como `cover-image`; a capa da segunda parte permanece como asset namespaced.
- `npm test`: 104/104 passando.

Observação:

- `npm start` permanece com o contrato legado de exigir exatamente um EPUB em `input/`. Com dois EPUBs reais em `input/`, ele bloqueia com a mensagem esperada: `Mais de um EPUB encontrado em input/. Deixe apenas um.`
- `epubcheck` não estava disponível no PATH no momento da validação.

## M6.2 — Auditoria de integridade dos capítulos com fonte de referência opcional

**Status:** implementado em primeira versão.

- Criada base de `ReferenceDocument` / `ReferenceChapter`.
- Criado loader de referência agnóstico de formato.
- Criado adapter EPUB usando o reader e o detector interno existentes.
- Criado adapter PDF reaproveitando `pdf-utils`.
- Criado adapter DOCX estruturado como `unsupported`, sem fingir suporte enquanto não houver dependência instalada.
- Criado auditor de integridade de capítulos.
- Auditor funciona com referência e sem referência.
- Auditor detecta ausência de capítulos, duplicatas, conteúdo ausente, duplicação de sinais e vazamento de início/fim entre capítulos.
- Auditor não corrige conteúdo automaticamente.
- Criado relatório em `reports/reference/chapter_integrity_report.json`.
- Auditoria estrutural-only rodada no EPUB unido 1–120 existente:
  - `status = OK_WITH_WARNINGS`;
  - `chapterCount = 120`;
  - aviso esperado: `NO_REFERENCE_SOURCE`.
- `npm test`: 110/110 passando.

Pendência registrada:

- DOCX ainda está `unsupported`.
- A abstração agnóstica já existe, e EPUB/PDF têm adapters funcionais, mas a cobertura real de DOCX ainda depende de implementação futura de leitura/extração própria.
- Essa pendência não bloqueia M6.3, porque normalização de títulos não depende de fonte de referência.

## M6.3 — Normalização e revisão de títulos dos capítulos

**Status:** implementado.

- Criado parser/normalizador para títulos de capítulo.
- Criado analyzer com preview de inconsistências.
- Criado fixer não destrutivo que gera cópia em `output/titles/`.
- Padrão aplicado: `Capítulo N: Título`.
- Pontuação interna do título é preservada.
- XHTML, `nav.xhtml` e `toc.ncx` são sincronizados.
- Corpo narrativo é validado como preservado.
- Normalização é idempotente.
- Criado relatório em `reports/titles/chapter_title_normalization_report.json`.
- Validação real no EPUB unido 1–120:
  - `chapterCount = 120`;
  - `changed = 69`;
  - `unchanged = 51`;
  - `remainingInconsistent = 0`;
  - `bodyTextPreserved = true`;
  - `navSynced = true`;
  - `ncxSynced = true`.
- `npm test`: 113/113 passando.

## M7 — Correção + merge em uma única operação

**Status:** implementado e validado com 2 EPUBs reais.

- Criado orquestrador em `src/features/orchestration/`.
- Adicionada opção `8 → 6. Corrigir vários + juntar`.
- M7 não cria nova engine; ele chama features já existentes.
- Regra definitiva de fonte efetiva:
  - `fixed` → usar cópia corrigida;
  - `already_clean` → usar original;
  - `no_boundary`, `ambiguous`, `unsupported`, `failed` → bloquear antes do merge.
- Fluxo implementado:
  - seleção múltipla;
  - análise prechapter;
  - correção somente de `candidate_found + high`;
  - resolução de fontes efetivas;
  - merge-precheck;
  - merge;
  - auditoria de integridade;
  - normalização de títulos pós-merge;
  - relatório consolidado.
- Validação real com `1–60` + `61–120`:
  - `status = success`;
  - `blockers = 0`;
  - as duas partes viraram cópias `fixed`;
  - EPUB final com 120 capítulos;
  - nenhum capítulo ausente;
  - nenhum capítulo duplicado;
  - títulos finais normalizados;
  - originais preservados por hash.
- Relatório: `reports/orchestration/m7_orchestration_report.json`.
- Saída final: `output/titles/Novel-capitulos-1-a-120-capitulos-1-a-120-3-titles-normalized.epub`.
- `npm test`: 115/115 passando.

## M8 — Corrigir dívida da validação de regressão

**Status:** implementado.

- Removido o hardcode histórico de `25` capítulos do `final-regression-validator.js`.
- O validator agora deriva a expectativa aprovada da execução a partir de:
  - `chapter_report.json`;
  - `chapter_resplit_report.json`.
- A expectativa exige consistência entre:
  - capítulos selecionados;
  - `chapterCount`;
  - `resplitReport.chapterCount`;
  - `outputFile` gerados pelo resplit.
- `toc_report.json` e `structure_report.json` são comparados contra os hrefs aprovados pelo resplit.
- O EPUB final continua sendo validado quanto à existência e presença de `nav.xhtml` e `toc.ncx`, mas não é a fonte única da expectativa.
- Criados testes para:
  - expectativa dinâmica com 3 capítulos;
  - expectativa dinâmica com 490 capítulos;
  - bloqueio de expectativa inconsistente/circular.
- `npm test`: 118/118 passando.

## M9.1 — Exposição inicial no menu

**Status:** implementado.

- Opção `4. 📝 Revisar títulos dos capítulos` exposta no menu principal.
- A opção 4 reutiliza a feature do M6.3:
  - análise;
  - preview;
  - confirmação;
  - cópia normalizada;
  - relatório.
- Opção `7. 📚 Usar fonte de referência` exposta como auditoria.
- A opção 7 reutiliza a infraestrutura do M6.2:
  - seleção de EPUB alvo;
  - referência opcional EPUB/PDF/DOCX;
  - DOCX continua explicitamente `unsupported`;
  - auditoria;
  - relatório;
  - nenhuma correção automática.
- Opção `12. 📊 Ver relatórios` exposta como fluxo somente leitura.
- A opção 12 descobre relatórios existentes em `reports/` recursivamente, sem lista hardcoded de nomes.
- Nenhuma engine nova foi criada para títulos, referência ou relatórios.
- `npm test`: 118/118 passando.

## M9.2 — Exposição de análise, capítulos e idioma no menu

**Status:** implementado.

- Opção `1. 📖 Analisar EPUB` exposta no menu principal.
- A opção 1 reutiliza:
  - `readEpub`;
  - `readHtmlDocuments`;
  - `analyzeToc`.
- A opção 1 grava `reports/epub_analysis_report.json`.
- Opção `2. 🧩 Detectar capítulos` exposta no menu principal.
- A opção 2 reutiliza:
  - `detectChapters`;
  - `detectInternalChapters`;
  - `analyzeToc`;
  - leitura EPUB/HTML já existente.
- A opção 2 grava:
  - `reports/spine_chapter_report.json`;
  - `reports/internal_chapter_report.json`.
- Opção `6. 🌐 Verificar idioma` exposta no menu principal.
- A opção 6 reutiliza `detectLanguage`.
- A opção 6 grava `reports/language_report.json`.
- Nenhum analyzer paralelo foi criado.
- `npm test`: 118/118 passando.

## M9.3 — Exposição de análise de sumário no menu

**Status:** implementado para análise.

- Opção `5. 📑 Analisar / reconstruir sumário` exposta no menu principal.
- A opção 5 reutiliza:
  - `readEpub`;
  - `readHtmlDocuments`;
  - `analyzeToc`.
- A opção 5 grava `reports/toc_report.json`.
- A reconstrução de `nav.xhtml`/`toc.ncx` não foi habilitada neste milestone.
- Motivo: `buildNavXhtml` e `buildNcx` existem, mas reconstrução segura exige contexto aprovado de capítulos, OPF e empacotamento; expor isso diretamente no menu criaria risco de mini-pipeline paralelo.
- Nenhum builder foi duplicado.

## M9.4 — Exposição de validação de EPUB no menu

**Status:** implementado.

- Opção `10. ✅ Validar EPUB` exposta no menu principal.
- A opção 10 reutiliza:
  - `readEpub`;
  - `readHtmlDocuments`;
  - `analyzeToc`;
  - `detectChapters`;
  - `detectLanguage`;
  - `analyzeStructure`;
  - `validateEpub3`;
  - `auditFinalEpub`, quando aplicável;
  - `runFinalRegressionValidation`, somente quando existem relatórios aprovados suficientes.
- A opção 10 grava `reports/menu_epub_validation_report.json`.
- A validação de regressão não fabrica expectativa quando falta contexto aprovado.
- Auditorias finais específicas de EPUB estruturado são marcadas como indisponíveis quando o EPUB alvo não tem o formato esperado por essas auditorias.
- Nenhum validator paralelo foi criado.
- Nenhuma correção automática foi adicionada.

## M9.5 — Exposição conservadora de reestruturação / EPUB 3

**Status:** implementado como wrapper controlado.

- Opção `3. ✂️ Reestruturar capítulos` exposta no menu principal.
- Opção `9. 🔧 Converter / reconstruir como EPUB 3` exposta no menu principal.
- Ambas as opções chamam o pipeline legado completo em `src/main.js`, após confirmação explícita.
- O contrato de `npm start` foi preservado:
  - usa `findSingleEpub()`;
  - exige exatamente um EPUB em `input/`;
  - não altera o fluxo legado.
- `canonical-resplitter`, builders e geração de OPF/NAV/NCX não foram chamados diretamente pelo menu.
- Motivo: resplit e rebuild dependem de escolha aprovada de fonte, boundary coverage, prechecks, ranges e empacotamento; chamar peças isoladas criaria risco de pipeline paralelo.
- Nenhum motor novo foi criado.

## Próximo milestone recomendado

**M9 concluído. Próximo: definir refinamentos fora do M9.**

M8 foi implementado removendo o hardcode de 25 capítulos do `final-regression-validator`, e M9.1/M9.2/M9.3/M9.4/M9.5 expuseram capacidades já estabilizadas no menu.

Fluxo alvo:

```text
selecionar partes
  ↓
corrigir somente HIGH
  ↓
precheck de merge
  ↓
merge
  ↓
auditar integridade
  ↓
normalizar títulos quando confirmado
  ↓
validar
```

---

# 1. Contexto

O módulo `epub-structuring` foi criado para analisar e reestruturar EPUBs, detectar capítulos, trabalhar com boundaries/ranges, reconstruir navegação e gerar EPUB 3 estruturado.

O fluxo atual do GitHub está concentrado em:

```text
src/main.js
```

e executa o pipeline completo de forma sequencial.

No estado observado no repositório, o fluxo principal faz aproximadamente:

```text
EPUB de entrada
    ↓
ler EPUB
    ↓
ler documentos HTML/XHTML
    ↓
analisar TOC
    ↓
detectar idioma
    ↓
extrair mapa canônico opcional via PDF
    ↓
detectar capítulos
    ↓
analisar estrutura
    ↓
validar EPUB 3
    ↓
analisar boundaries dos capítulos
    ↓
construir ranges
    ↓
canonical resplit
    ↓
reconstruir EPUB
    ↓
reabrir EPUB final
    ↓
reanalisar
    ↓
validar novamente
    ↓
gerar relatórios
    ↓
regressão final
```

Hoje o `package.json` expõe apenas:

```json
{
  "scripts": {
    "start": "node src/main.js"
  }
}
```

Ou seja, o usuário precisa executar o fluxo completo mesmo quando deseja apenas uma ação específica.

---

# 2. Visão de produto desejada

A intenção é transformar gradualmente o `epub-structuring` em uma ferramenta de terminal onde cada capacidade possa ser executada isoladamente.

Menu alvo:

```text
╔══════════════════════════════════════════════════════╗
║               EPUB STRUCTURING                     ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  1. 📖 Analisar EPUB                                ║
║  2. 🧩 Detectar capítulos                           ║
║  3. ✂️  Reestruturar capítulos                      ║
║  4. 📝 Revisar títulos dos capítulos                ║
║  5. 📑 Analisar / reconstruir sumário               ║
║  6. 🌐 Verificar idioma                             ║
║  7. 📚 Usar fonte de referência                     ║
║  8. 🧹 Corrigir conteúdo pré-capítulo               ║
║  9. 🔧 Converter / reconstruir como EPUB 3          ║
║ 10. ✅ Validar EPUB                                 ║
║                                                      ║
║ 11. 🚀 Processamento completo                       ║
║ 12. 📊 Ver relatórios                               ║
║                                                      ║
║  0. Sair                                             ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

## Estratégia

**Não implementar todas as opções imediatamente.**

Primeiro:

```text
npm start
→ continua executando o pipeline atual exatamente como hoje.

npm run menu
→ abre a nova interface.

Menu inicial:
8. Corrigir conteúdo pré-capítulo  → funcional.
11. Processamento completo         → chama o fluxo atual.
0. Sair                            → funcional.

Demais opções:
podem ser adicionadas gradualmente em milestones posteriores.
```

Isso reduz drasticamente o risco de regressão.

---

# 3. Problema concreto que motiva a feature 8

Foi analisado o EPUB:

```text
novel capitulos 1 a 60 - ch.epub
```

O arquivo interno:

```text
index_split_000.html
```

possui no início:

```html
<p>Romance Capítulos 1 a 60</p>
<p>Capítulos 1 a 60</p>
<p> </p>

<h1 id="toc_id_1">Capítulo 1 O Tirano Injustiçado Lê Meu Coração</h1>

<p> </p>
<p> </p>

<p>"Vossa Majestade, a senhora está grávida!"</p>
<p>"Seu desgraçado!"</p>
...
```

O `toc.ncx` aponta corretamente para:

```text
index_split_000.html#toc_id_1
```

com o título:

```text
Capítulo 1 O Tirano Injustiçado Lê Meu Coração
```

Portanto há uma evidência estrutural muito forte de que o verdadeiro início do capítulo é:

```html
<h1 id="toc_id_1">Capítulo 1 ...</h1>
```

No Kindle, porém, o usuário vê:

```text
Romance Capítulos 1 a 60

Capítulos 1 a 60


Capítulo 1 O Tirano Injustiçado Lê Meu Coração
```

O resultado fica visualmente repetitivo.

---

# 4. O problema NÃO deve ser tratado como limpeza textual genérica

Não implementar:

```js
remove("Romance Capítulos 1 a 60");
remove("Capítulos 1 a 60");
```

Não implementar:

```text
remover os dois primeiros parágrafos
```

Não implementar:

```text
remover qualquer coisa antes de um H1
```

Não implementar uma heurística do tipo:

```text
texto repetido = lixo
```

Essas soluções podem apagar:

- prólogos;
- introduções;
- epígrafes;
- notas do autor;
- conteúdo editorial;
- páginas de título legítimas;
- outros elementos válidos.

A feature precisa trabalhar com **estrutura e boundary**, não com uma blacklist de textos.

---

# 5. Conceito correto da feature

A feature deve responder:

> Onde começa o primeiro capítulo real deste EPUB/parte?

Depois:

> Existe conteúdo anterior a esse boundary dentro do mesmo XHTML?

Se existir, apresentar esse conteúdo ao usuário e permitir a geração de uma cópia corrigida.

Conceitualmente:

```text
XHTML
│
├── conteúdo anterior ao capítulo
│   ├── Romance Capítulos 1 a 60
│   ├── Capítulos 1 a 60
│   └── parágrafo vazio
│
└── boundary confirmado
    ├── <h1 id="toc_id_1">Capítulo 1 ...</h1>
    └── narrativa
```

Saída desejada:

```html
<h1 id="toc_id_1">Capítulo 1 O Tirano Injustiçado Lê Meu Coração</h1>

<p> </p>
<p> </p>

<p>"Vossa Majestade, a senhora está grávida!"</p>
...
```

> No primeiro milestone da feature, o objetivo é remover **somente o conteúdo anterior ao boundary**. Não ampliar automaticamente o escopo para remover parágrafos vazios depois do heading.

---

# 6. Importante: o primeiro capítulo de cada EPUB não será sempre o Capítulo 1

O livro foi dividido em vários EPUBs menores para reduzir a complexidade de processamento.

Exemplo:

```text
novel capitulos 1 a 60 - ch.epub
novel capitulos 61 a 120 - ch.epub
novel capitulos 121 a 180 - ch.epub
novel capitulos 181 a 211 - ch.epub
novel capitulos 212 a 270 - ch.epub
novel capitulos 271 a 300 - ch.epub
novel capitulos 301 a 360 - ch.epub
novel capitulos 361 a 421 - ch.epub
```

Logo, a feature não pode procurar especificamente:

```text
Capítulo 1
```

Ela deve procurar:

```text
o primeiro chapter boundary real do EPUB selecionado
```

Exemplos possíveis:

```text
Parte 1:
Capítulo 1

Parte 2:
Capítulo 61

Parte 3:
Capítulo 121

...

Parte 8:
Capítulo 361
```

Isso é fundamental para tornar a feature reutilizável.

---

# 7. Restrição atual importante no código

O código atual possui:

```js
findSingleEpub(inputDir)
```

e rejeita a execução se houver mais de um `.epub` em `input/`.

A mensagem atual é equivalente a:

```text
Mais de um EPUB encontrado em input/.
Deixe apenas um.
```

Essa regra deve continuar válida para o **pipeline legado** enquanto ele depender dela.

Não alterar `findSingleEpub()` apenas para atender ao novo menu.

Criar uma nova API de seleção para o menu, por exemplo:

```text
listEpubs(inputDir)
selectSingleEpub(...)
selectMultipleEpubs(...)
```

Assim:

```text
npm start
→ continua aceitando exatamente um EPUB.

npm run menu
→ pode trabalhar com um ou vários EPUBs.
```

---

# 8. Risco atual relacionado a `index_split_000`

O estado observado do repositório possui regras como:

```js
/titlepage|cover|copyright|dedication|toc|nav|index_split_000/
```

em lógica de frontmatter.

No `frontmatter-detector.js`, `index_split_000` pode ser classificado diretamente como frontmatter pelo filename.

O `chapter-boundary-analyzer.js` também filtra documentos do spine considerados frontmatter antes de procurar boundaries.

Isso significa que o fluxo atual pode assumir incorretamente:

```text
index_split_000 = frontmatter
```

quando na verdade o arquivo pode ser:

```text
frontmatter/boilerplate + capítulo real
```

## Recomendação para a feature 8

**Não mudar essa regra global no primeiro milestone.**

A feature 8 deve possuir uma análise própria e isolada para o primeiro chapter boundary do arquivo selecionado.

Motivo:

- remover `index_split_000` da regra global pode alterar o comportamento do pipeline completo;
- a feature nova pode ser implementada sem tocar na lógica validada do workflow existente;
- uma eventual generalização do `frontmatter-detector` deve acontecer em milestone posterior, com testes de caracterização.

---

# 9. Princípio de alteração mínima

A feature 8 não precisa executar:

```text
chapter discovery completo
→ canonical resplit
→ rebuild de todos os capítulos
→ rebuild de nav
→ rebuild de NCX
→ rebuild de OPF
```

para corrigir somente três elementos antes de um heading.

A estratégia preferencial é:

```text
EPUB original
    ↓
copiar para uma nova saída
    ↓
abrir XHTML alvo
    ↓
identificar boundary
    ↓
remover somente nós anteriores ao boundary
    ↓
preservar o próprio boundary e seu id
    ↓
substituir somente esse XHTML dentro da cópia
    ↓
validar
```

Isso é muito mais seguro.

Se o elemento:

```html
<h1 id="toc_id_1">
```

for preservado, o link existente:

```text
index_split_000.html#toc_id_1
```

continua válido.

Portanto, em um caso simples como o EPUB de exemplo, não há motivo para reconstruir TOC/NCX/OPF.

---

# 10. Comportamento desejado da opção 8

Ao selecionar:

```text
8. 🧹 Corrigir conteúdo pré-capítulo
```

o submenu inicial deve ser algo semelhante a:

```text
╔══════════════════════════════════════════════════════╗
║        CORRIGIR CONTEÚDO PRÉ-CAPÍTULO              ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  1. Corrigir um EPUB                                ║
║  2. Corrigir vários EPUBs                           ║
║  3. Corrigir vários EPUBs e juntar em um só         ║
║                                                      ║
║  0. Voltar                                           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

## Observação arquitetural

A opção:

```text
Corrigir vários EPUBs e juntar em um só
```

não deve colocar a lógica de merge dentro de `fix-prechapter-content.js`.

A feature deve orquestrar dois serviços independentes:

```text
pre-chapter correction
        ↓
epub merge service
```

Isso permite que futuramente o merge seja exposto como outra opção do menu sem depender da correção pré-capítulo.

---

# 11. Preview obrigatório antes da alteração

Exemplo:

```text
Arquivo:
novel capitulos 1 a 60 - ch.epub

Primeiro chapter boundary detectado:
index_split_000.html#toc_id_1

Título:
Capítulo 1 O Tirano Injustiçado Lê Meu Coração

Sinais:
✓ alvo explícito no TOC/NCX
✓ elemento é <h1>
✓ contém número de capítulo
✓ título do TOC e heading são compatíveis

Confiança:
ALTA

Conteúdo anterior ao boundary:

[1] <p>Romance Capítulos 1 a 60</p>
[2] <p>Capítulos 1 a 60</p>
[3] <p></p>

Ação proposta:
remover estes 3 elementos da cópia de saída.

[S] Aplicar
[N] Cancelar
[V] Ver mais detalhes
```

A feature não deve alterar o original.

---

# 12. Regras de confiança para encontrar o boundary

Não usar somente uma regex textual.

Combinar sinais.

## Sinais fortes

- TOC/NCX aponta para `arquivo.xhtml#id`;
- o ID existe no DOM;
- o elemento é `h1`, `h2` ou outro heading;
- label do TOC é compatível com o texto do elemento;
- texto possui indicação de capítulo;
- número do capítulo é coerente com a parte do livro;
- primeiro capítulo detectado é coerente com os próximos capítulos.

## Sinais médios

- heading com padrão de capítulo, mas sem anchor;
- texto e TOC compatíveis por filename;
- sequência de capítulos posterior confirma a numeração.

## Regra inicial recomendada

Modo automático:

```text
aplicar somente se confidence = HIGH
```

Se a confiança não for alta:

```text
não alterar automaticamente
```

Mostrar:

```text
Boundary não confirmado com segurança.
Nenhuma alteração foi realizada.
```

Posteriormente pode existir modo manual.

---

# 13. Operação deve ser não destrutiva

Nunca sobrescrever:

```text
input/original.epub
```

Exemplo de saída:

```text
output/fixes/
└── novel capitulos 1 a 60 - ch-prechapter-fixed.epub
```

Para múltiplos:

```text
output/fixes/
├── novel capitulos 1 a 60 - ch-prechapter-fixed.epub
├── novel capitulos 61 a 120 - ch-prechapter-fixed.epub
├── novel capitulos 121 a 180 - ch-prechapter-fixed.epub
└── ...
```

Para merge:

```text
output/merged/
└── novel-capitulos-1-a-421-merged.epub
```

---

# 14. Idempotência

Rodar a feature novamente em um EPUB já corrigido não deve remover conteúdo adicional.

Exemplo:

```text
primeira execução:
3 elementos pré-boundary removidos

segunda execução:
0 elementos pré-boundary removíveis
status = already_clean
```

Nunca continuar "comendo" o início do capítulo a cada execução.

---

# 15. Invariantes da correção

Depois da correção:

- heading do primeiro capítulo permanece;
- `id` do heading permanece;
- primeiro parágrafo narrativo permanece;
- TOC ainda aponta para um anchor existente;
- número de capítulos não muda;
- spine não muda;
- manifest não muda;
- recursos não relacionados não mudam;
- nenhum arquivo diferente do XHTML alvo deve ter seu conteúdo alterado, salvo metadados ZIP inevitáveis;
- original permanece intacto.

Para testar preservação, comparar **hash do conteúdo descompactado** de todos os entries que não deveriam mudar.

Não comparar somente o hash binário do EPUB inteiro, pois o repack do ZIP pode alterar bytes mesmo quando o conteúdo lógico é igual.

---

# 16. Relatório da feature 8

Gerar, por arquivo:

```text
reports/prechapter/
└── <nome>-prechapter-report.json
```

Exemplo conceitual:

```json
{
  "sourceFile": "novel capitulos 1 a 60 - ch.epub",
  "status": "fixed",
  "target": {
    "href": "index_split_000.html",
    "anchor": "toc_id_1",
    "title": "Capítulo 1 O Tirano Injustiçado Lê Meu Coração",
    "chapterNumber": 1
  },
  "confidence": "high",
  "signals": [
    "toc-anchor-match",
    "heading-element",
    "chapter-number-match"
  ],
  "preBoundary": {
    "elementCount": 3,
    "textElements": [
      "Romance Capítulos 1 a 60",
      "Capítulos 1 a 60"
    ]
  },
  "result": {
    "removedElementCount": 3,
    "anchorPreserved": true,
    "tocTargetValid": true
  },
  "outputFile": "..."
}
```

Os nomes dos campos podem ser adaptados ao padrão existente do projeto.

---

# 17. Suporte a vários EPUBs

A seleção múltipla deve listar os EPUBs encontrados:

```text
EPUBs encontrados:

[1] novel capitulos 1 a 60 - ch.epub
[2] novel capitulos 61 a 120 - ch.epub
[3] novel capitulos 121 a 180 - ch.epub
[4] novel capitulos 181 a 211 - ch.epub
[5] novel capitulos 212 a 270 - ch.epub
[6] novel capitulos 271 a 300 - ch.epub
[7] novel capitulos 301 a 360 - ch.epub
[8] novel capitulos 361 a 421 - ch.epub

Selecione:
1
1,2,3
1-8
todos
```

Não depender da ordem retornada por `fs.readdir()`.

---

# 18. Ordenação para merge

Esse ponto é crítico.

A lista original pode estar fisicamente ou alfabeticamente em uma ordem incorreta.

Exemplo:

```text
1 a 60
121 a 180
181 a 211
...
61 a 120
```

Uma ordenação puramente lexicográfica produziria:

```text
1 a 60
121 a 180
...
61 a 120
```

o que está errado.

## Ordem recomendada de evidências

### 1. Melhor fonte
Detectar os números reais dos capítulos dentro de cada EPUB.

Exemplo:

```text
EPUB A → 1..60
EPUB B → 61..120
EPUB C → 121..180
```

### 2. Fallback
Extrair range do filename:

```text
capitulos 61 a 120
```

### 3. Último fallback
Pedir ordenação manual ao usuário.

Nunca fazer merge silencioso confiando apenas na ordem alfabética do nome.

---

# 19. Precheck antes de juntar vários EPUBs

Antes do merge, gerar uma tabela semelhante:

```text
Ordem  Arquivo                          Primeiro  Último
1      ... 1 a 60 ...                  1         60
2      ... 61 a 120 ...                61        120
3      ... 121 a 180 ...               121       180
4      ... 181 a 211 ...               181       211
5      ... 212 a 270 ...               212       270
6      ... 271 a 300 ...               271       300
7      ... 301 a 360 ...               301       360
8      ... 361 a 421 ...               361       421
```

Depois verificar:

```text
Gaps:       nenhum
Overlaps:   nenhum
Duplicados: nenhum
Ordem:      válida
```

## Política inicial

- overlap de capítulos → bloquear merge;
- capítulo duplicado → bloquear merge;
- ordem ambígua → bloquear e pedir revisão;
- gap → warning forte e exigir confirmação ou bloquear em modo strict;
- idioma inconsistente → warning/bloqueio conforme severidade;
- EPUB sem capítulos detectáveis → não fazer merge automático.

---

# 20. Merge é uma responsabilidade própria

O builder atual trabalha a partir de **um único objeto EPUB base** e copia os entries desse ZIP.

Logo, multi-EPUB não deve ser implementado simplesmente chamando o builder atual várias vezes.

Criar futuramente um serviço próprio, por exemplo:

```text
src/services/epub-merge-service.js
```

ou:

```text
src/features/merge-epubs/
```

Responsabilidades:

```text
EPUB 1 ─┐
EPUB 2 ─┤
EPUB 3 ─┤
...     ├──> representação canônica unificada
EPUB N ─┘
              ↓
          capítulos globais
              ↓
          recursos resolvidos
              ↓
          metadata final
              ↓
          manifest
              ↓
          spine
              ↓
          nav.xhtml
              ↓
          toc.ncx
              ↓
          EPUB final
```

---

# 21. Representação intermediária recomendada para merge

Não juntar ZIPs diretamente.

Criar uma estrutura lógica independente dos EPUBs fonte:

```js
{
  sourceEpub: "...",
  sourceOrder: 2,
  chapterNumber: 61,
  title: "...",
  bodyXhtml: "...",
  sourceHref: "...",
  resourceRefs: [...]
}
```

O merge trabalha com:

```text
GlobalChapter[]
```

ordenado por `chapterNumber`.

Depois constrói um EPUB novo.

---

# 22. Recursos e colisões no merge

É possível que diferentes partes tenham:

```text
styles.css
cover.jpg
image001.jpg
fonts/...
```

com nomes idênticos.

Não presumir que:

```text
mesmo nome = mesmo conteúdo
```

Estratégias possíveis:

## Assets idênticos

Comparar hash.

Se o conteúdo for idêntico:

```text
deduplicar
```

## Assets diferentes com mesmo nome

Namespace por parte:

```text
assets/part_001/...
assets/part_002/...
```

e reescrever referências XHTML/CSS.

No primeiro milestone do merge, se o suporte completo a recursos for complexo, detectar essa situação e **bloquear com diagnóstico** em vez de produzir EPUB corrompido.

---

# 23. Metadados do EPUB unido

Definir explicitamente.

Sugestão:

- título: perguntar ou derivar do título comum;
- autor: preservar se todos concordarem;
- idioma: preservar se consistente;
- identifier: gerar um novo identificador para o EPUB unido;
- cover: usar a capa escolhida, normalmente da primeira parte;
- source identifiers: registrar no relatório;
- capítulos: lista global unificada;
- data `dcterms:modified`: atualizar.

Não copiar cegamente todos os metadados da primeira parte sem verificar consistência.

---

# 24. Menu: implementação sem refatorar o pipeline inteiro

Estrutura sugerida:

```text
src/
├── main.js                         # fluxo atual, inicialmente intocado
│
├── cli/
│   ├── menu.js
│   ├── input-selector.js
│   └── terminal-ui.js
│
├── features/
│   └── prechapter/
│       ├── prechapter-analyzer.js
│       ├── prechapter-preview.js
│       ├── prechapter-fixer.js
│       └── prechapter-report.js
│
├── services/
│   ├── epub-copy-patcher.js
│   └── epub-merge-service.js       # milestone posterior
│
├── analyzers/
├── builders/
├── parsers/
├── segmenters/
├── validators/
└── utils/
```

Não é obrigatório usar exatamente esses nomes.

A IA deve primeiro verificar as convenções atuais do projeto.

---

# 25. CLI sem dependência desnecessária

Preferir inicialmente:

```text
node:readline/promises
```

em vez de adicionar uma biblioteca grande de prompts.

Só introduzir dependência externa se houver benefício claro.

---

# 26. Scripts sugeridos

Manter:

```json
"start": "node src/main.js"
```

Adicionar:

```json
"menu": "node src/cli/menu.js"
```

Possível evolução:

```json
{
  "scripts": {
    "start": "node src/main.js",
    "menu": "node src/cli/menu.js",
    "test": "..."
  }
}
```

**Não mudar o significado de `npm start` no primeiro milestone.**

---

# 27. O processamento completo deve continuar acessível

No menu:

```text
11. 🚀 Processamento completo
```

deve inicialmente chamar o pipeline atual.

Evitar refatorar `main.js` só para poder chamá-lo como função.

Opção inicial segura:

```text
menu
  ↓
processamento completo
  ↓
spawn/exec do comando legado
```

Depois, em milestone posterior, o pipeline pode ser extraído para um service reutilizável.

---

# 28. Dívida técnica já identificada: regression validator hardcoded

No snapshot analisado do GitHub, `final-regression-validator.js` ainda possui expectativas fixas de:

```text
25 capítulos
```

incluindo:

```text
chapterCount === 25
toc entryCount === 25
chapter_001.xhtml ... chapter_025.xhtml
```

Isso deve ser tratado como uma dívida separada.

Não misturar a correção do hardcode com a feature 8.

## Motivo

Feature 8:

```text
corrige um trecho específico de XHTML
```

Final regression:

```text
valida o pipeline completo
```

São responsabilidades diferentes.

A IA deve comparar o código **local** com o GitHub antes de alterar, pois o ambiente local pode já conter mudanças não publicadas.

---

# 29. Milestones

---

## M0 — Baseline e caracterização

### Objetivo

Congelar o comportamento atual antes de adicionar menu ou feature.

### Não editar código inicialmente.

### Tarefas

1. mapear arquivos do módulo;
2. mapear funções públicas/importadas;
3. executar fluxo atual em uma fixture conhecida;
4. registrar todos os relatórios;
5. verificar testes existentes;
6. verificar se existem mudanças locais não commitadas;
7. comparar local vs GitHub;
8. confirmar o comportamento de `findSingleEpub`;
9. confirmar o hardcode de 25 capítulos no ambiente local;
10. confirmar como o EPUB de 1–60 é interpretado pelo fluxo atual.

### Entregável

```text
baseline_report.md
```

com:

```text
arquivos
fluxo
testes
resultados
riscos
pontos de extensão
```

### Gate

Nenhuma alteração antes da aprovação do diagnóstico.

---

## M1 — Casca do menu de terminal

### Objetivo

Criar interface sem refatorar o motor.

### Implementar

```text
npm run menu
```

Menu alvo completo pode ser exibido, mas deve deixar claro quais opções ainda não foram habilitadas.

Obrigatoriamente funcionais:

```text
8. Corrigir conteúdo pré-capítulo
11. Processamento completo
0. Sair
```

### Requisitos

- `npm start` permanece inalterado;
- pipeline atual permanece inalterado;
- `npm run menu` é entrada nova;
- nenhuma alteração em analyzers/builder apenas para montar o menu;
- Ctrl+C encerra corretamente;
- entradas inválidas não derrubam o processo.

### Gate

`npm start` deve produzir o mesmo resultado de antes.

---

## M2 — Feature 8: análise e preview para um EPUB

### Objetivo

Implementar somente diagnóstico, sem alteração.

Fluxo:

```text
selecionar EPUB
    ↓
ler EPUB
    ↓
localizar primeiro chapter boundary confiável
    ↓
capturar conteúdo anterior
    ↓
mostrar preview
    ↓
não alterar arquivo
```

### Requisitos

- não depender de `Capítulo 1`;
- funcionar em parte que começa em 61/121/etc.;
- TOC/NCX anchor deve ser priorizado;
- não alterar regras globais de frontmatter;
- não alterar EPUB.

### Status possíveis

```text
candidate_found
already_clean
ambiguous
no_boundary
unsupported
```

### Gate

O EPUB `novel capitulos 1 a 60 - ch.epub` deve mostrar:

```text
boundary:
index_split_000.html#toc_id_1

pre-boundary:
Romance Capítulos 1 a 60
Capítulos 1 a 60
```

sem escrever nenhuma saída modificada.

---

## M3 — Feature 8: aplicar correção em um EPUB

### Objetivo

Gerar uma cópia corrigida.

### Estratégia

Patch mínimo do XHTML alvo.

### Não executar

- canonical resplit completo;
- rebuild global de todos os capítulos;
- rebuild de nav/NCX/OPF se não houver necessidade;
- alterações em outros XHTMLs.

### Pós-validação

Verificar:

```text
anchor existe
TOC target existe
heading existe
primeiro parágrafo narrativo existe
estrutura ZIP legível
mimetype válido
EPUB reabre no parser interno
```

### Gate

EPUB corrigido deve abrir e o início visual deve ser:

```text
Capítulo 1 O Tirano Injustiçado Lê Meu Coração

"Vossa Majestade, a senhora está grávida!"
...
```

sem os dois textos redundantes anteriores.

---

## M4 — Feature 8: vários EPUBs

### Objetivo

Permitir:

```text
corrigir um
corrigir seleção
corrigir todos
```

Cada EPUB é tratado isoladamente.

### Requisitos

- falha de uma parte não deve apagar os resultados das demais;
- produzir batch report;
- mostrar status por arquivo;
- não alterar os originais.

Exemplo:

```text
1–60      FIXED
61–120    ALREADY_CLEAN
121–180   FIXED
181–211   AMBIGUOUS
...
```

### Gate

Processar uma pasta com várias partes sem depender de `findSingleEpub()`.

---

## M5 — Preparação para merge: inventário e ordenação

### Objetivo

Ainda não gerar EPUB unido.

Analisar partes e construir:

```text
orderedSourceSet
```

### Validar

- primeiro capítulo;
- último capítulo;
- overlaps;
- gaps;
- duplicados;
- idioma;
- metadados;
- recursos;
- cover;
- CSS;
- imagens;
- estrutura.

### Gate

Para as oito partes fornecidas, produzir ordem:

```text
1–60
61–120
121–180
181–211
212–270
271–300
301–360
361–421
```

independentemente da ordenação lexicográfica dos filenames.

---

## M6 — Merge de múltiplos EPUBs

### Objetivo

Criar um EPUB novo e unificado.

### Não concatenar ZIPs.

Criar:

```text
GlobalChapter[]
```

e montar um novo package.

### Requisitos

- capítulos 1–421 em ordem;
- sem duplicação;
- sem perda;
- manifest consistente;
- spine consistente;
- nav consistente;
- NCX consistente;
- metadata coerente;
- recursos resolvidos;
- cover único;
- novo identifier;
- EPUB final validável.

### Gate

Relatório:

```text
sources: 8
chapters: 421
gaps: 0
overlaps: 0
duplicates: 0
navEntries: 421
spineEntries: 421
validation: ok
```

---

## M6.1 — Validação real multi-source

### Objetivo

Validar o merge com pelo menos dois EPUBs reais da mesma obra.

Exemplo ideal:

```text
1–60
61–120
```

### Gate

Não considerar M6 validado apenas com uma fonte única ou com um rebuild de um EPUB completo.

O merge precisa provar:

- precheck com `sourceCount >= 2`;
- ranges corretos;
- ordem correta;
- gaps = 0;
- overlaps = 0;
- duplicatas = 0;
- metadata differences registradas;
- resource collisions classificadas;
- EPUB final único criado;
- originais preservados;
- relatório coerente.

### Validação de fronteira entre sources

Em especial, verificar:

```text
fim do capítulo 60
    ↓
início do capítulo 61
```

O esperado é:

```text
Capítulo 60
texto...
    ↓
Capítulo 61
texto...
```

Não:

```text
Capítulo 60
texto...

Romance Capítulos 61 a 120
Capítulos 61 a 120
[capa da parte 2]

Capítulo 61
```

---

## M6.2 — Auditoria de integridade dos capítulos com fonte de referência opcional

### Objetivo

Validar se os capítulos produzidos pelo merge/resplit correspondem corretamente à estrutura da obra de referência.

O M6.2 é **somente auditoria**.

Não corrigir automaticamente conteúdo neste milestone.

### Problema que motivou o milestone

Depois do M6.1, a validação estrutural confirmou:

- `chapterCount`;
- `navEntries`;
- `ncxEntries`;
- `spineEntries`;
- gaps;
- overlaps;
- duplicatas.

Isso ainda não prova sozinho que o conteúdo dos capítulos foi separado no ponto correto.

Problemas que precisam ser detectáveis:

- final do capítulo N entrando no capítulo N+1;
- início do capítulo N+1 permanecendo no capítulo N;
- heading de capítulo incorporado ao corpo errado;
- trecho narrativo perdido na separação;
- conteúdo duplicado entre capítulos;
- boundary reconhecido estruturalmente, mas aplicado no ponto errado.

### Não fixar DOCX como referência

Uma referência DOCX pode ser usada quando disponível, mas o plano não deve depender de DOCX.

Em outras obras, a fonte de referência poderá ser:

- EPUB;
- DOCX;
- PDF;
- outro formato suportado no futuro.

Portanto, o conceito correto é:

```text
fonte de referência
```

e não:

```text
comparar com DOCX
```

### Abstração: Reference Source

Conceitualmente:

```text
                 Fonte de referência
                        │
          ┌─────────────┼─────────────┐
          │             │             │
        EPUB           DOCX          PDF
          │             │             │
          └─────────────┼─────────────┘
                        ↓
              Reference Adapter
                        ↓
          representação intermediária
                        ↓
              ReferenceDocument
                        ↓
             ReferenceChapter[]
                        ↓
             Auditor de integridade
                        ↓
                  EPUB gerado
```

O auditor não deve precisar saber se a referência veio de EPUB, DOCX ou PDF.

Cada adapter converte sua fonte para uma representação comum.

### Representação intermediária

Estrutura conceitual:

```js
ReferenceDocument {
  sourceType,
  sourceFile,
  language,
  title,
  chapters[]
}

ReferenceChapter {
  number,
  title,
  text,
  sourceLocation,
  confidence
}
```

Os nomes podem mudar para seguir as convenções do projeto.

A regra principal é separar:

```text
extração da referência
```

de:

```text
auditoria dos capítulos gerados
```

### Referência opcional

O módulo precisa funcionar:

```text
COM fonte de referência
```

e:

```text
SEM fonte de referência
```

Fluxo com referência:

```text
EPUB gerado
    +
reference source
    ↓
auditoria estrutural + editorial/conteúdo
```

Fluxo sem referência:

```text
EPUB gerado
    ↓
auditoria estrutural interna
```

A ausência de referência não deve impedir:

- merge;
- estruturação;
- validação estrutural;
- uso normal do módulo.

A referência serve para elevar o nível de confiança.

### Idioma da referência

Não assumir que EPUB final e referência estão no mesmo idioma.

Exemplo:

```text
Referência:
第 61 章 ...

EPUB:
Capítulo 61: ...
```

Não usar igualdade textual literal como critério principal.

Priorizar sinais estruturais:

- número do capítulo;
- ordem;
- position/boundary;
- quantidade de capítulos;
- sequência;
- correspondência de blocos;
- continuidade de conteúdo;
- sinais independentes do idioma.

Comparação textual só deve ser usada quando fizer sentido.

### Auditoria de boundaries

O auditor deve validar explicitamente:

```text
Capítulo N
    ↓
último conteúdo esperado
    ↓
boundary
    ↓
Capítulo N+1
    ↓
primeiro conteúdo esperado
```

Detectar:

- boundary correto;
- texto do capítulo N vazando para N+1;
- texto de N+1 permanecendo em N;
- heading absorvido pelo capítulo anterior;
- primeiro parágrafo perdido;
- último parágrafo perdido;
- conteúdo duplicado;
- conteúdo ausente.

### Amostragem e modo completo

Prever dois níveis:

```text
amostragem dirigida
```

e:

```text
auditoria completa
```

Amostragem dirigida deve priorizar:

- primeiros capítulos;
- capítulos próximos a boundaries complexos;
- fronteiras entre EPUBs fonte;
- capítulos onde detector teve menor confiança;
- último capítulo.

Quando tecnicamente viável, a auditoria completa deve comparar todos os capítulos.

O auditor deve produzir relatório, não exigir revisão manual de todos os capítulos.

### Prioridade nas fronteiras entre sources

Em merge multi-EPUB, dar atenção especial a:

```text
último capítulo da parte A
        ↓
primeiro capítulo da parte B
```

Exemplos:

```text
60 → 61
120 → 121
180 → 181
```

Verificar se não entrou entre eles:

- capa da parte seguinte;
- titlepage;
- texto `Capítulos X a Y`;
- frontmatter;
- conteúdo editorial;
- duplicação de heading;
- trecho perdido.

### Estrutura futura possível

Exemplo conceitual:

```text
src/features/reference/
├── reference-loader.js
├── reference-document.js
├── adapters/
│   ├── epub-reference-adapter.js
│   ├── docx-reference-adapter.js
│   └── pdf-reference-adapter.js
└── chapter-integrity-auditor.js
```

Antes de criar código futuro, verificar o que já existe no projeto para:

- leitura de EPUB;
- leitura de PDF;
- extração de TOC;
- chapter detection;
- leitura de DOCX;
- normalização de texto.

Evitar mecanismos duplicados.

### Relatório

Gerar algo como:

```text
reports/reference/
└── chapter_integrity_report.json
```

Estrutura conceitual:

```json
{
  "status": "ok",
  "reference": {
    "sourceType": "docx",
    "sourceFile": "..."
  },
  "targetEpub": "...",
  "chapterCount": 120,
  "checkedChapters": 120,
  "boundaryIssues": [],
  "missingContent": [],
  "duplicatedContent": [],
  "chapterMismatches": [],
  "warnings": [],
  "confidence": "high"
}
```

### Status possíveis

```text
OK
OK_WITH_WARNINGS
REVIEW_REQUIRED
FAILED
```

### Testes

Cobrir:

- referência EPUB;
- referência DOCX;
- referência PDF;
- referência ausente;
- capítulo correto;
- texto do capítulo anterior vazando no seguinte;
- primeiro parágrafo do capítulo perdido;
- último parágrafo perdido;
- capítulo duplicado;
- número divergente;
- idiomas diferentes;
- referência parcial;
- boundary entre duas sources corretas;
- boundary entre duas sources com frontmatter intermediário;
- source adapter falha;
- auditoria continua estruturadamente sem referência.

### Gate

M6.2 não deve apagar, corrigir ou reescrever conteúdo.

Deve apenas elevar o diagnóstico sobre integridade real dos capítulos.

---

## M6.3 — Normalização e revisão de títulos dos capítulos

### Objetivo

Detectar e corrigir inconsistências de apresentação dos headings.

Padrão canônico inicial:

```text
Capítulo N: Título
```

Exemplos:

```text
ANTES:
Capítulo 1 O Tirano Injustiçado Lê Meu Coração
Capítulo 2: Beliscando os Grandes Músculos Peitorais do Tirano
Capítulo 17 Ning Xiaoxiao: Seu imperador cachorro, seu cavalo de lama!

DEPOIS:
Capítulo 1: O Tirano Injustiçado Lê Meu Coração
Capítulo 2: Beliscando os Grandes Músculos Peitorais do Tirano
Capítulo 17: Ning Xiaoxiao: Seu imperador cachorro, seu cavalo de lama!
```

O primeiro `:` é estrutural, separando número do capítulo e título.

Se o próprio título tiver outro `:`, ele deve ser preservado.

### Não reescrever o título

Separar:

```text
chapterNumber
```

de:

```text
chapterTitle
```

Depois reconstruir:

```text
Capítulo {number}: {title}
```

Não:

- traduzir título;
- reescrever conteúdo;
- alterar pontuação interna do título;
- remover `:` pertencente ao próprio título;
- mudar capitalização sem regra;
- modificar texto narrativo.

### Exemplo importante

Entrada:

```text
Capítulo 17 Ning Xiaoxiao: Seu imperador cachorro, seu cavalo de lama!
```

Parse:

```text
chapterNumber = 17

chapterTitle =
Ning Xiaoxiao: Seu imperador cachorro, seu cavalo de lama!
```

Saída:

```text
Capítulo 17: Ning Xiaoxiao: Seu imperador cachorro, seu cavalo de lama!
```

O `:` interno do título deve permanecer.

### Locais que precisam ficar consistentes

Quando a normalização for aplicada, validar coerência entre:

- heading XHTML;
- `nav.xhtml`;
- `toc.ncx`;
- qualquer título canônico usado internamente;
- relatório de capítulos.

Não permitir:

```text
XHTML:
Capítulo 17: ...

NAV:
Capítulo 17 ...

NCX:
Capítulo 17 ...
```

Tudo deve refletir o mesmo título final.

### Preview

Antes de aplicar:

```text
Títulos analisados: 120
Consistentes: 87
Inconsistentes: 33

Exemplos:

Capítulo 1 O Tirano...
→ Capítulo 1: O Tirano...

Capítulo 17 Ning Xiaoxiao: ...
→ Capítulo 17: Ning Xiaoxiao: ...

Aplicar normalização? [S/n]
```

Nunca alterar automaticamente sem confirmação, exceto se um modo explicitamente automático for criado no futuro.

### Relatório

Gerar algo como:

```text
reports/titles/
└── chapter_title_normalization_report.json
```

Exemplo:

```json
{
  "status": "success",
  "chapterCount": 120,
  "changed": 33,
  "unchanged": 87,
  "items": [
    {
      "chapter": 1,
      "before": "Capítulo 1 O Tirano...",
      "after": "Capítulo 1: O Tirano..."
    }
  ]
}
```

### Testes

Cobrir:

- título sem `:`;
- título já correto;
- título com `:` interno;
- capítulo sem título;
- whitespace irregular;
- título com número incorreto;
- NAV/NCX/XHTML sincronizados;
- idempotência;
- nenhuma alteração no corpo narrativo;
- preview + cancelamento.

### Compatibilidade

M6.3 não deve depender de existir fonte de referência.

M6.2 não deve depender de M6.3.

---

## M7 — Integrar merge ao fluxo da feature 8

**Status:** implementado e validado com 2 EPUBs reais.

### Objetivo

Habilitar:

```text
8
→ 6. Corrigir vários EPUBs e juntar em um só
```

Fluxo:

```text
selecionar partes
    ↓
analisar prechapter por parte
    ↓
corrigir cópias temporárias/lógicas
    ↓
resolver effectiveSource
    ↓
precheck de merge
    ↓
merge
    ↓
auditoria de integridade
    ↓
normalização de títulos após o merge
    ↓
validação final
    ↓
relatório consolidado
```

### Regra definitiva de fonte efetiva

O merge automático só recebe EPUBs explicitamente classificados como seguros.

```text
candidate_found + high
    ↓
corrigir
    ↓
fixed
    ↓
effectiveSource = cópia corrigida

already_clean
    ↓
effectiveSource = original
```

Qualquer outro resultado bloqueia toda a orquestração antes do merge:

```text
no_boundary
ambiguous
unsupported
failed
```

Não existe fallback automático para o original nesses casos.

### Resultado real validado

Arquivos usados:

```text
input/novel capitulos 1 a 60 - ch.epub
input/novel capitulos 61 a 120 - ch.epub
```

Resultado:

- `status = success`;
- `selectedCount = 2`;
- `blockers = 0`;
- as duas fontes foram corrigidas primeiro;
- `effectiveSource` das duas partes = cópia `fixed`;
- merge `ready_for_merge`;
- merge final com `chapterCount = 120`;
- `navEntries = 120`;
- `ncxEntries = 120`;
- `spineEntries = 120`;
- auditoria estrutural `OK_WITH_WARNINGS` por ausência opcional de referência;
- normalização de títulos `success`;
- capítulo 1 final: `Capítulo 1: O Tirano Injustiçado Lê Meu Coração`;
- capítulo 61 final: `Capítulo 61: Ativando uma missão secundária oculta – O tirano está morto?`;
- nenhum capítulo ausente;
- nenhum capítulo duplicado;
- originais preservados por hash.

Relatório:

```text
reports/orchestration/m7_orchestration_report.json
```

Saída final:

```text
output/titles/Novel-capitulos-1-a-120-capitulos-1-a-120-3-titles-normalized.epub
```

---

## M8 — Corrigir dívida da validação de regressão

**Status:** implementado.

### Objetivo

Remover pressupostos históricos específicos do validador genérico.

### Antes

```text
esperado = 25
```

### Depois

Validação deve comparar:

```text
estrutura canônica esperada
vs
resultado final
```

Não usar o próprio resultado final como sua única fonte de expectativa, evitando validação circular.

Expectativas específicas de livros/fixtures devem ficar em testes de regressão próprios.

### Implementado

O `final-regression-validator.js` agora deriva a expectativa aprovada da execução sem depender do EPUB final como fonte única.

Fonte da expectativa:

```text
chapter_report.json
chapter_resplit_report.json
```

Validações principais:

- `chapter_report.json` precisa ter `chapterCount` coerente com os capítulos selecionados;
- `chapter_resplit_report.json` precisa ter `chapterCount` coerente;
- cada capítulo aprovado precisa ter `outputFile`;
- `toc_report.json` precisa apontar para os hrefs aprovados pelo resplit;
- `structure_report.json` precisa apontar para os hrefs aprovados pelo resplit;
- contagens finais precisam concordar com a expectativa aprovada.

Testes adicionados:

- 3 capítulos;
- 490 capítulos;
- expectativa inconsistente bloqueada.

---

## M9 — Expor gradualmente as demais funcionalidades no menu

Depois de estabilizar menu + feature 8:

```text
1. 📖 Analisar EPUB
2. 🧩 Detectar capítulos
3. ✂️ Reestruturar capítulos
4. 📝 Revisar títulos dos capítulos
5. 📑 Analisar / reconstruir sumário
6. 🌐 Verificar idioma
7. 📚 Usar fonte de referência
8. 🧹 Corrigir conteúdo pré-capítulo
9. 🔧 Converter / reconstruir como EPUB 3
10. ✅ Validar EPUB
11. 🚀 Processamento completo
12. 📊 Ver relatórios
```

Cada opção deve chamar services/analyzers reutilizáveis.

Não migrar tudo de uma vez.

### Submilestones do M9

M9.1 concluído:
- opção 4: Revisar títulos;
- opção 7: Fonte de referência;
- opção 12: Relatórios.

M9.2 concluído:
- opção 1: Analisar EPUB;
- opção 2: Detectar capítulos;
- opção 6: Verificar idioma.

M9.3 concluído para análise:
- opção 5: Sumário;
- primeiro análise;
- reconstrução somente se houver fluxo isolado seguro.

M9.4 concluído:
- opção 10: Validar EPUB.

M9.5 concluído como wrapper controlado:
- opção 3: Reestruturar capítulos;
- opção 9: Reconstruir EPUB 3.

### Importante sobre a opção 4

Como M6.3 passa a criar a lógica real de normalização/revisão de títulos, M9 não deve implementar outra engine.

Responsabilidade:

```text
M6.3
    ↓
cria service/feature de normalização de títulos

M9
    ↓
expõe essa feature na opção 4 do menu principal
```

Evitar duplicação.

### Importante sobre a opção 7

Depois da introdução de `Reference Source`, a opção 7 não deve ficar restrita a PDF.

A visão futura é:

```text
7. Usar fonte de referência
```

ou:

```text
7. Comparar com fonte de referência
```

Essa opção poderá aceitar:

- EPUB;
- DOCX;
- PDF.

Não implementar isso durante a atualização do plano.

---

## M10 — Refatoração final do pipeline legado

Somente depois que os serviços individuais estiverem comprovados.

Possível alvo:

```text
src/main.js
    ↓
chama runFullPipeline()
```

e:

```text
menu
    ↓
chama os mesmos services
```

Nesse ponto o `main.js` deixa de ser o local onde toda a lógica de orquestração está acoplada.

---

# 30. Testes obrigatórios da feature 8

## T1 — Caso real

Entrada:

```html
<p>Romance Capítulos 1 a 60</p>
<p>Capítulos 1 a 60</p>
<p></p>
<h1 id="toc_id_1">Capítulo 1 ...</h1>
<p>narrativa</p>
```

Esperado:

```html
<h1 id="toc_id_1">Capítulo 1 ...</h1>
<p>narrativa</p>
```

considerando apenas remoção dos nós anteriores.

---

## T2 — EPUB já limpo

```html
<h1 id="chapter61">Capítulo 61 ...</h1>
<p>...</p>
```

Esperado:

```text
already_clean
```

nenhuma modificação.

---

## T3 — Prólogo legítimo sem confirmação

```html
<h2>Prólogo</h2>
<p>...</p>
<h1>Capítulo 1</h1>
```

Se a feature não puder provar com segurança que o prólogo deve ser descartado:

```text
não remover
```

---

## T4 — TOC confirma boundary

TOC:

```text
file.xhtml#c121
```

DOM:

```html
<h1 id="c121">Capítulo 121 ...</h1>
```

Esperado:

```text
confidence = high
```

---

## T5 — Anchor inexistente

TOC aponta para:

```text
#abc
```

mas `#abc` não existe.

Esperado:

```text
ambiguous ou no_boundary
```

não alterar.

---

## T6 — Arquivo não chamado `index_split_000`

```text
section-a.xhtml
```

com o mesmo padrão.

Esperado:

feature continua funcionando.

---

## T7 — Idempotência

Rodar duas vezes.

Esperado:

```text
execução 1 = fixed
execução 2 = already_clean
```

---

## T8 — Preservação

Todos os ZIP entries não relacionados devem ter o mesmo hash de conteúdo descompactado antes/depois.

---

## T9 — Primeiro capítulo = 61

A feature deve identificar corretamente o primeiro boundary sem presumir capítulo 1.

---

## T10 — Batch parcialmente problemático

8 EPUBs:

```text
5 fixed
2 already_clean
1 ambiguous
```

Esperado:

- resultados dos 7 seguros são preservados;
- ambíguo não é alterado;
- batch report registra tudo.

---

# 31. Testes obrigatórios do merge

## MRG1 — Ordem numérica

Arquivos fornecidos em ordem aleatória.

Esperado:

```text
1–60
61–120
121–180
...
361–421
```

---

## MRG2 — Overlap

```text
1–60
60–120
```

Esperado:

```text
BLOCK
overlap = chapter 60
```

---

## MRG3 — Gap

```text
1–60
62–120
```

Esperado:

```text
warning/block
missing = 61
```

---

## MRG4 — Duplicata

Dois sources contendo Capítulo 121.

Esperado:

```text
BLOCK
```

---

## MRG5 — Resource collision

Duas partes contêm:

```text
images/image001.jpg
```

com hashes diferentes.

Esperado:

não sobrescrever silenciosamente.

---

## MRG6 — Resultado final

Para as oito partes:

```text
chapter count = 421
nav = 421
spine = 421
sem gap
sem overlap
sem duplicata
```

---

# 32. Relatórios de batch/merge

Batch:

```text
reports/prechapter/batch_report.json
```

Merge:

```text
reports/merge/merge_report.json
```

O `merge_report` deve informar pelo menos:

```json
{
  "sources": [],
  "sourceOrder": [],
  "chapterCount": 0,
  "firstChapter": null,
  "lastChapter": null,
  "gaps": [],
  "overlaps": [],
  "duplicates": [],
  "resourceCollisions": [],
  "metadataDecisions": {},
  "outputFile": null,
  "validation": {}
}
```

---

# 33. UX desejada para correção + merge

Exemplo:

```text
8. Corrigir conteúdo pré-capítulo

Modo:
3. Corrigir vários EPUBs e juntar em um só

EPUBs encontrados:
[1] ... 1 a 60 ...
[2] ... 61 a 120 ...
...
[8] ... 361 a 421 ...

Selecionados:
todos

Analisando...

1–60      boundary Cap. 1     HIGH   3 elementos antes
61–120    boundary Cap. 61    HIGH   2 elementos antes
121–180   boundary Cap. 121   HIGH   já limpo
...

Aplicar correções seguras? [S/n]

...

Precheck do merge:

Capítulos: 1 → 421
Gaps: 0
Overlaps: 0
Duplicados: 0
Ordem: OK

Gerar EPUB único? [S/n]

Saída:
output/merged/novel-capitulos-1-a-421-merged.epub

Validação:
OK
```

---

# 34. Tratamento de erros

Nenhuma stack trace crua como experiência padrão do usuário.

Exemplo:

```text
Não foi possível confirmar o início do primeiro capítulo em:
novel capitulos 181 a 211 - ch.epub

Nenhuma alteração foi realizada.

Detalhes técnicos:
reports/prechapter/...
```

Em modo debug, stack trace pode ser habilitada.

---

# 35. Compatibilidade

A refatoração deve preservar:

- Node/ES Modules usados atualmente;
- parsers existentes;
- analyzers existentes;
- builders existentes;
- reports existentes;
- `npm start`;
- fluxo PDF opcional;
- canonical resplit;
- filenames de saída atuais do pipeline legado;
- qualquer override de livros já existente.

Nenhuma mudança de nomenclatura/estrutura deve ser feita apenas por estética.

---

# 36. O que NÃO fazer

Não:

1. reescrever o projeto inteiro para criar o menu;
2. transformar `npm start` no menu imediatamente;
3. alterar globalmente `frontmatter-detector` antes de testes;
4. remover `index_split_000` da regex sem análise;
5. usar blacklist de frases;
6. apagar conteúdo sem preview/confirmação;
7. modificar o EPUB original;
8. concatenar ZIPs para fazer merge;
9. ordenar partes alfabeticamente;
10. confiar exclusivamente nos filenames;
11. aceitar overlaps silenciosamente;
12. sobrescrever assets com mesmo nome;
13. misturar a correção do hardcode `25` com a feature 8;
14. tornar o merge obrigatório para batch;
15. acoplar merge ao `prechapter-fixer`.

---

# 37. Passo 0 obrigatório para a outra IA

Antes de qualquer alteração, responder com um diagnóstico contendo:

1. árvore atual de `workflows/epub-structuring`;
2. estado do Git;
3. diferenças local vs GitHub;
4. scripts atuais do `package.json`;
5. fluxo atual de `main.js`;
6. uso de `findSingleEpub`;
7. parsers/analyzers reutilizáveis pela feature 8;
8. como TOC/NCX anchors são lidos atualmente;
9. onde `index_split_000` é tratado como frontmatter;
10. como o builder atual trabalha com um único EPUB base;
11. testes existentes;
12. relatórios existentes;
13. confirmação ou não do hardcode de 25;
14. proposta exata para M1 e M2;
15. lista de arquivos que pretende criar;
16. lista de arquivos existentes que pretende modificar;
17. riscos;
18. estratégia de rollback.

**Não editar código no Passo 0.**

Aguardar aprovação.

---

# 38. Critério de sucesso da primeira entrega

A primeira entrega relevante não precisa refatorar todo o módulo.

Ela estará correta se entregar:

```text
npm start
→ continua funcionando como antes.

npm run menu
→ abre menu.

8
→ permite selecionar um EPUB.

feature analisa:
novel capitulos 1 a 60 - ch.epub

detecta:
index_split_000.html#toc_id_1

mostra:
Romance Capítulos 1 a 60
Capítulos 1 a 60

usuário confirma.

gera:
cópia corrigida.

original:
intocado.

TOC:
continua válido.

Capítulo:
continua íntegro.
```

Isso já é um milestone completo e útil.

---

# 39. Critério de sucesso da segunda grande entrega

Depois:

```text
feature 8
→ selecionar vários EPUBs
→ corrigir todos os casos seguros
→ ordenar as partes corretamente
→ validar ranges
→ opcionalmente juntar em EPUB único
→ validar EPUB unido
```

Para os arquivos deste projeto, o alvo final será:

```text
Capítulos 1 → 421
```

a partir das partes:

```text
1–60
61–120
121–180
181–211
212–270
271–300
301–360
361–421
```

---

# 40. Direção arquitetural final

A evolução desejada é:

```text
HOJE

main.js
   ↓
pipeline inteiro obrigatório
```

para:

```text
TRANSIÇÃO

npm start
   ↓
pipeline legado intacto

npm run menu
   ↓
features isoladas
   ├── prechapter
   └── processamento completo legado
```

e somente depois:

```text
ALVO FINAL

CLI
 │
 ├── análise
 ├── capítulos
 ├── resplit
 ├── títulos
 ├── navegação
 ├── idioma
 ├── fonte de referência
 ├── prechapter
 ├── EPUB 3
 ├── validação
 ├── merge
 └── relatórios
        │
        ▼
services/analyzers/builders compartilhados
        │
        ▼
pipeline completo como uma orquestração dessas mesmas capacidades
```

O objetivo não é "quebrar o pipeline em pedaços" por estética.

O objetivo é tornar as capacidades existentes **executáveis de forma independente**, preservando um modo de processamento completo.

---

# 41. Fontes técnicas usadas para este plano

Snapshot consultado do repositório:

- `workflows/epub-structuring/README.md`
- `workflows/epub-structuring/package.json`
- `src/main.js`
- `src/utils/file-utils.js`
- `src/analyzers/frontmatter-detector.js`
- `src/analyzers/chapter-detector.js`
- `src/analyzers/chapter-boundary-analyzer.js`
- `src/analyzers/chapter-range-builder.js`
- `src/segmenters/canonical-resplitter.js`
- `src/utils/dom-range-extractor.js`
- `src/builders/epub-builder.js`
- `src/validators/final-regression-validator.js`

Repositório:

```text
https://github.com/angeline1986/extrair_novel/tree/main/workflows/epub-structuring
```

## Observação

O código local deve ser considerado a fonte operacional real durante a implementação. O snapshot do GitHub serve para orientar o plano, mas a IA deve comparar o repositório local antes de editar.

---

# 42. Resumo executivo para implementação

```text
PRIORIDADE 1
M0 Baseline

PRIORIDADE 2
M1 Menu sem alterar pipeline legado

PRIORIDADE 3
M2 Feature 8 em preview

PRIORIDADE 4
M3 Feature 8 aplicada a um EPUB

PRIORIDADE 5
M4 Batch de vários EPUBs

PRIORIDADE 6
M5 Análise e ordenação para merge

PRIORIDADE 7
M6 Merge real

PRIORIDADE 8
M6.1 Validação real multi-source

PRIORIDADE 9
M6.2 Auditoria de integridade

PRIORIDADE 10
M6.3 Normalização de títulos

PRIORIDADE 11
M7 Correção + merge pelo menu

PRIORIDADE 12
M8 Dívidas de regressão

PRIORIDADE 13
M9 Expor demais capacidades

PRIORIDADE 14
M10 Refatorar pipeline completo para reutilizar services
```

**Regra durante todas as etapas: diagnóstico antes de edição, mudança mínima, teste antes/depois e nenhuma alteração destrutiva do EPUB original.**

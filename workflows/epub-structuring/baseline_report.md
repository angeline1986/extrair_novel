# Baseline M0 - `workflows/epub-structuring`

Data: 2026-08-11

Este documento registra o diagnóstico técnico antes de qualquer implementação do menu ou da feature 8. Nenhum código executável foi alterado nesta etapa.

## 1. Estado do Git e local vs GitHub

- Branch atual: `main`.
- `HEAD`, `origin/main` e `FETCH_HEAD` apontam para o mesmo commit: `17ed53f0ecf02af5f9c94aad842da990b9e995b7`.
- Foi executado `git fetch origin main` para confirmar a referência remota.
- O worktree está sujo. Há mudanças locais rastreadas em `workflows/epub-structuring` e também muitos arquivos novos não rastreados.

Arquivos rastreados modificados em `workflows/epub-structuring`:

- `package.json`
- `src/main.js`
- `src/utils/file-utils.js`
- `src/analyzers/chapter-boundary-analyzer.js`
- `src/analyzers/chapter-range-builder.js`
- `src/analyzers/language-detector.js`
- `src/analyzers/pdf-toc-extractor.js`
- `src/builders/epub-builder.js`
- `src/builders/nav-builder.js`
- `src/builders/ncx-builder.js`
- `src/builders/opf-builder.js`
- `src/config/canonical-chapters.js`
- `src/segmenters/canonical-resplitter.js`
- `src/utils/dom-range-extractor.js`

Arquivos/pastas novos relevantes em `workflows/epub-structuring`:

- `PLANO_REFATORACAO_EPUB_STRUCTURING_MENU_PRECHAPTER_MERGE.md`
- `src/analyzers/internal-chapter-discovery.js`
- `src/config/book-structure-overrides.js`
- `src/utils/book-structure-overrides.js`
- `src/utils/chapter-parser.js`
- `src/utils/chapter-source.js`
- `src/utils/dom-chapter-candidates.js`
- `src/utils/language-utils.js`
- `src/utils/zip-writer.js`
- `src/validators/final-epub-auditor.js`
- `test/`

Resumo do diff local contra `origin/main` para arquivos rastreados do módulo: 14 arquivos, 904 inserções e 154 remoções. O código local deve ser tratado como fonte operacional real, mas qualquer mudança nova precisa preservar essas alterações locais.

## 2. Árvore atual do módulo

Diretórios principais:

```text
workflows/epub-structuring/
├── input/
├── output/
│   ├── chapters/
│   └── chapters_internal_diagnostic/
├── reports/
├── src/
│   ├── analyzers/
│   ├── builders/
│   ├── config/
│   ├── parsers/
│   ├── segmenters/
│   ├── utils/
│   └── validators/
└── test/
    ├── integration/
    └── unit/
```

Arquivo EPUB presente em `input/`:

- `The_Editor_Is_the_Novels_Extra_Portuguese_Edition_-_Jongsuil.epub`

Há saídas e relatórios já gerados em `output/` e `reports/`.

## 3. Scripts atuais

`package.json` local:

```json
{
  "scripts": {
    "start": "node src/main.js",
    "test": "node --test"
  }
}
```

`npm start` ainda chama diretamente `src/main.js`. Não há `npm run menu` no estado atual.

## 4. Fluxo real de `src/main.js`

O fluxo atual é um pipeline completo e acoplado:

1. lê opções CLI com `parseCliOptions()`;
2. garante `input/`, `output/` e `reports/`;
3. exige exatamente um EPUB com `findSingleEpub()`;
4. resolve PDF opcional;
5. lê EPUB com `readEpub()`;
6. lê documentos HTML com `readHtmlDocuments()`;
7. analisa NCX/TOC com `analyzeToc()`;
8. detecta idioma;
9. extrai mapa canônico via PDF opcional;
10. detecta capítulos por spine/canônico;
11. detecta capítulos internos no DOM;
12. aplica overrides de estrutura do livro;
13. mede cobertura de boundaries para spine e internal DOM;
14. escolhe fonte de capítulos com `chooseChapterReport()`;
15. gera relatórios preliminares;
16. bloqueia resplit se boundaries não cobrirem 100%;
17. constrói ranges;
18. executa canonical resplit;
19. empacota EPUB estruturado;
20. reabre o EPUB final;
21. reanalisa estrutura e TOC;
22. grava relatórios finais;
23. roda validação de regressão;
24. audita pacote EPUB final.

Ponto importante: `main.js` executa imediatamente `main().catch(...)` no final, então ele ainda não é reutilizável como função por um menu sem spawn/subprocesso.

## 5. `findSingleEpub()`

`src/utils/file-utils.js` confirma:

- lista arquivos em `inputDir`;
- filtra extensões `.epub`;
- falha se não houver EPUB;
- falha se houver mais de um EPUB;
- retorna o único caminho encontrado.

Mensagem para múltiplos:

```text
Mais de um EPUB encontrado em input/. Deixe apenas um.
```

Conclusão: não alterar essa função para a feature 8. Criar APIs novas de listagem/seleção para o menu.

## 6. TOC/NCX e anchors

`readEpub()`:

- lê `META-INF/container.xml`;
- lê OPF;
- monta `manifestItems`, `spineItems`, `htmlItems`, `ncxItems` e `navItems`;
- identifica NCX por `application/x-dtbncx+xml`;
- identifica nav por `properties` contendo `nav`.

`analyzeToc()`:

- usa apenas o primeiro NCX (`epub.ncxItems?.[0]`);
- lê `navMap/navPoint`;
- achata navPoints recursivamente;
- retorna entradas com `id`, `playOrder`, `level`, `label` e `src`;
- preserva o `src` como veio do NCX, incluindo anchors como `arquivo.xhtml#id`.

`chapter-detector.js` usa `stripAnchor(entry.src)` para mapear TOC por arquivo, então o fluxo existente não usa o anchor como boundary primário. A feature 8 deve criar uma leitura própria que use o `src` completo do NCX e confirme o `id` no DOM.

## 7. `index_split_000` como frontmatter

`src/analyzers/frontmatter-detector.js` classifica como frontmatter qualquer href que bata em:

```js
/titlepage|cover|copyright|dedication|toc|nav|index_split_000/
```

Isso confirma o risco descrito no plano.

Nuance local: alguns módulos novos usam helpers próprios que nao incluem `index_split_000` na regex, por exemplo:

- `src/analyzers/chapter-boundary-analyzer.js`
- `src/analyzers/chapter-range-builder.js`
- `src/analyzers/internal-chapter-discovery.js`
- `src/utils/book-structure-overrides.js`

Risco: há inconsistência de política de frontmatter entre o detector genérico e os fluxos novos. Não corrigir isso em M1/M2; a feature 8 deve ser isolada.

## 8. Parsers/analyzers reutilizáveis para feature 8

Reutilizáveis com baixo risco:

- `readEpub()` para abrir EPUB e localizar OPF/manifest/spine/NCX.
- `readZipText()` para ler XHTML/NCX dentro do ZIP.
- `analyzeToc()` como fonte inicial de entradas NCX, desde que a feature preserve anchors.
- `cleanText()` para normalização de texto exibido no preview.
- `parseChapterHeading()` para reconhecer capítulo sem presumir `Capítulo 1`.
- `normalizeChapterTitle()` para comparação leve entre label do TOC e heading.
- `writeJsonReport()` para gravar relatórios.
- `writeZipFile()`/`auditZipMimetype()` podem ser úteis em M3, mas não são necessários para M2 preview.

Evitar reutilizar diretamente em M2:

- `analyzeChapterBoundaries()`, porque depende de `chapterReport` canônico e varre candidatos por capítulo.
- `buildChapterRanges()` e `performCanonicalResplit()`, porque fazem parte do pipeline de reconstrução.
- `buildStructuredEpub()`, porque reconstrói OPF/nav/NCX e remove HTMLs originais.

## 9. Builder atual e EPUB-base único

`buildStructuredEpub(epub, chapterReport, resplitReport, chaptersDir, outputFile)` trabalha a partir de um único `epub` base:

- reutiliza metadados e caminhos OPF do EPUB original;
- gera `nav.xhtml`, `toc.ncx` e OPF novos;
- remove HTMLs originais do manifest;
- adiciona capítulos gerados em `output/chapters`;
- escreve um EPUB novo com `mimetype` primeiro e sem compressão.

Conclusão: o builder atual não serve para merge multi-EPUB e também é grande demais para a correção mínima de pré-capítulo.

## 10. Testes existentes

Comando executado:

```text
npm test
```

Resultado:

```text
72 testes
72 passaram
0 falharam
```

Cobertura relevante existente:

- parser de títulos/capítulos;
- seleção de fonte de capítulos;
- descoberta interna de capítulos;
- ranges DOM;
- opções CLI de PDF;
- overrides de estrutura;
- output XML de OPF/nav;
- escrita ZIP com `mimetype` correto;
- integração de internal discovery, ranges, resplit e builders.

Lacunas para feature 8:

- não há teste de remoção de conteúdo antes de boundary NCX;
- não há teste de idempotência de correção pré-capítulo;
- não há teste de preservação por hash de entries ZIP;
- não há teste de seleção múltipla de EPUBs;
- não há teste de menu.

## 11. Relatórios atuais

`reports/` já contém muitos relatórios do pipeline completo, incluindo:

- `toc_report.json`
- `language_report.json`
- `chapter_report.json`
- `spine_chapter_report.json`
- `internal_chapter_report.json`
- `boundary_report.json`
- `chapter_boundary_report.json`
- `chapter_range_report.json`
- `chapter_resplit_report.json`
- `validation_report.json`
- `final_regression_report.json`
- `final_epub_validation.json`
- `epub_packaging_audit.json`
- `chapter_content_audit.json`

Para feature 8, criar namespace próprio:

```text
reports/prechapter/
```

Isso evita misturar relatórios do pipeline completo com diagnóstico/correção pontual.

## 12. Hardcode de 25 capítulos

Confirmado em `src/validators/final-regression-validator.js`:

- `chapterReport.chapterCount === 25`;
- `structureReport.summary.chapterCount === 25`;
- `tocReport.entryCount === 25`;
- consistência exige todos os counts iguais a 25;
- hrefs esperados são `chapter_001.xhtml` até `chapter_025.xhtml`.

Não corrigir junto com M1/M2. Tratar como dívida separada em M8.

## 13. Riscos de regressão

1. `src/main.js` é acoplado e autoexecutável; importar esse arquivo pelo menu rodaria o pipeline completo.
2. `findSingleEpub()` bloqueia múltiplos EPUBs e é usado pelo pipeline legado.
3. `frontmatter-detector.js` classifica `index_split_000` como frontmatter, mas outros fluxos locais não fazem isso.
4. `analyzeToc()` preserva anchors, mas os detectores atuais tendem a reduzir TOC para arquivo sem anchor.
5. O builder atual reconstrói pacote inteiro, remove HTMLs originais e não é adequado para patch mínimo.
6. Há muitas mudanças locais não commitadas; qualquer refatoração ampla aumenta risco de sobrescrever trabalho existente.
7. `final-regression-validator.js` ainda é específico para 25 capítulos.
8. Os relatórios atuais são gerados pelo pipeline completo; a feature 8 precisa namespace próprio para não poluir baseline.

## 14. Proposta mínima para M1

Objetivo: criar casca de menu sem alterar pipeline legado.

Arquivos a criar:

- `src/cli/menu.js`
- `src/cli/terminal-ui.js`
- possivelmente `src/cli/input-selector.js`

Arquivos a alterar:

- `package.json`, adicionando apenas:

```json
"menu": "node src/cli/menu.js"
```

Comportamento:

- `npm start` permanece `node src/main.js`;
- opção `11` chama o pipeline legado via subprocesso, sem importar `main.js`;
- opção `8` entra no submenu, mas em M1 pode chamar stub amigável ou encaminhar para M2 quando implementado;
- opções não implementadas exibem mensagem clara;
- `0` sai;
- entradas inválidas não derrubam o processo;
- Ctrl+C encerra limpo.

## 15. Proposta mínima para M2

Objetivo: preview da feature 8 para um EPUB, sem alterar arquivo.

Arquivos a criar:

- `src/features/prechapter/prechapter-analyzer.js`
- `src/features/prechapter/prechapter-preview.js`
- `src/features/prechapter/prechapter-report.js`

Arquivos existentes a alterar:

- `src/cli/menu.js`, para ligar opção 8 ao preview.
- `src/cli/input-selector.js`, se a seleção de EPUBs ficar separada.

Não alterar:

- `src/main.js`
- `src/analyzers/frontmatter-detector.js`
- `src/builders/*`
- `src/segmenters/*`
- `src/utils/file-utils.js` no comportamento de `findSingleEpub()`

Algoritmo M2 sugerido:

1. listar EPUBs de `input/` de forma ordenada;
2. permitir escolher um EPUB;
3. abrir com `readEpub()`;
4. obter entradas NCX com `analyzeToc()`;
5. escolher a primeira entrada que aponte para `href#anchor`;
6. localizar o item XHTML correspondente no manifest/spine;
7. ler XHTML com `readZipText()`;
8. confirmar que o `id` existe no DOM;
9. confirmar que o elemento é heading ou candidato forte;
10. comparar label do TOC com texto do elemento;
11. confirmar que há padrão de capítulo, sem exigir número 1;
12. coletar nós irmãos anteriores dentro do corpo até o boundary;
13. classificar `candidate_found`, `already_clean`, `ambiguous`, `no_boundary` ou `unsupported`;
14. mostrar preview;
15. gravar relatório JSON opcional de análise;
16. não escrever EPUB corrigido em M2.

## 16. Arquivos previstos para M3

Somente depois de M2 aprovado:

- `src/features/prechapter/prechapter-fixer.js`
- `src/services/epub-copy-patcher.js`
- testes unitários e/ou fixtures sintéticas para idempotência e preservação.

## 17. Estratégia de rollback

- M1: remover `src/cli/*` e remover script `menu` do `package.json`.
- M2: remover `src/features/prechapter/*` e desfazer ligação da opção 8 no menu.
- Como `npm start` e `src/main.js` não devem ser alterados em M1/M2, o rollback não deve afetar o pipeline legado.
- Antes de qualquer implementação, registrar `git diff --stat` e manter commits pequenos por milestone.

## 18. Conclusão

O M0 confirma o direcionamento do plano:

- não refatorar `main.js` agora;
- não alterar `findSingleEpub()`;
- não mexer na regra global de `index_split_000`;
- não usar o builder completo para correção pré-capítulo;
- criar menu e feature 8 como camada isolada;
- começar com preview antes de qualquer patch de EPUB.

Próximo passo recomendado: aguardar aprovação deste diagnóstico antes de iniciar M1.

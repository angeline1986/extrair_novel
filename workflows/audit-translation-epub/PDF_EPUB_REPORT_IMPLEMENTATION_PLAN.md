# Plano de Implementacao - Relatorio PDF x EPUB

Objetivo: criar um relatorio editorial novo, baseado no modelo tabulado por abas, comparando o PDF original em `input/source/pdf/` com o EPUB traduzido/validado, preferencialmente em `output/` ou `input-fixed/vN/`.

Este plano existe para permitir retomada segura caso a implementacao seja interrompida.

## Escopo

- Criar um relatorio HTML separado:
  - `reports/html/pdf-epub-comparison-latest.html`
- Criar um JSON interno de apoio:
  - `state/pdf-epub-comparison.json`
- Comparar:
  - PDF original: `input/source/pdf/*.pdf`
  - EPUB alvo, em ordem de preferencia:
    1. `output/*.epub`
    2. `input-fixed/vN/*.epub`, usando `input-fixed/manifest.json`
    3. `input/translated/*.epub`
- Nao aplicar correcoes automaticamente.
- Nao alterar EPUB, PDF, review queue ou correction plan.

## Fora de Escopo Inicial

- OCR de PDF escaneado.
- Correcao automatica do EPUB com base no relatorio.
- Uso obrigatorio de Ollama.
- Substituicao do `reader-report-latest.html`.
- Aplicar automaticamente achados aprovados da fila `state/pdf-epub-review-queue.json`; proxima etapa prevista: criar fluxo "Aplicar achados PDF x EPUB aprovados".

## Milestone 1 - Lexicos de Idioma

Status: implementado em `src/languageLexicons.js`.

Criar uma camada leve de idioma para reduzir falsos positivos.

Arquivo previsto:

- `src/languageLexicons.js`

Conteudo previsto:

- `PORTUGUESE_COMMON_WORDS`
- `SPANISH_COMMON_WORDS`
- `ENGLISH_COMMON_WORDS`
- `PORTUGUESE_STRONG_MARKERS`
- `SPANISH_STRONG_MARKERS`
- `ENGLISH_STRONG_MARKERS`
- helpers como:
  - `normalizeLexiconWord`
  - `isCommonWord`
  - `isStrongLanguageMarker`
  - `languageMarkerScore`

Criterios de aceite:

- Palavras portuguesas comuns nao devem virar falso positivo de espanhol residual.
- Marcadores fortes de espanhol devem ajudar a priorizar achados como `reunión`, `embarazo`, `náuseas`, `matrimonio`.
- O lexico deve ser pequeno, curado e facil de revisar.

## Milestone 2 - Leitura do PDF

Status: implementado em `src/pdfReader.js`.

Criar leitor simples para extrair texto do PDF original.

Arquivo previsto:

- `src/pdfReader.js`

Funcionalidades previstas:

- localizar o primeiro `.pdf` em `input/source/pdf/`;
- ler PDF com `pdf-parse`;
- normalizar texto;
- extrair blocos/linhas;
- tentar identificar titulos/capitulos por padrao numerico;
- manter `paragraphs` por compatibilidade com `epubReader.js`, mas no PDF esse campo representa linhas/blocos textuais extraidos, nao paragrafos editoriais reais;
- expor `textBlocks` como alias mais explicito de `paragraphs`;
- retornar objeto parecido com:

```js
{
  filePath,
  filename,
  rawText,
  pages,
  sections,
  paragraphs,
  textBlocks,
  paragraphCount,
  textBlockCount,
  charCount
}
```

Criterios de aceite:

- Falhar com mensagem clara se nao houver PDF.
- Funcionar com o PDF atual em `input/source/pdf/`.
- Nao exigir OCR nesta fase.

## Milestone 3 - Escolha do EPUB Alvo

Status: implementado em `src/epubTargetResolver.js`.

Criar resolucao automatica do EPUB traduzido/validado.

Arquivo previsto:

- `src/epubTargetResolver.js`

Ordem de preferencia:

1. primeiro `.epub` em `output/`;
2. versao atual de `input-fixed/manifest.json`;
3. primeiro `.epub` em `input/translated/`.

Criterios de aceite:

- O relatorio deve informar qual EPUB foi usado.
- Se cair em fallback, isso deve aparecer no JSON/HTML.
- Caminhos explicitos futuros podem ser adicionados por CLI depois.

## Milestone 4 - Auditoria PDF x EPUB

Status: implementado em `src/pdfEpubComparisonAudit.js`.

Criar motor de comparacao entre PDF original e EPUB PT-BR.

Arquivo previsto:

- `src/pdfEpubComparisonAudit.js`

Categorias previstas, alinhadas ao modelo HTML:

1. Semanticos
   - mudancas suspeitas de sentido;
   - inicialmente heuristico e conservador.

2. Omissoes
   - capitulos ou blocos do PDF sem reflexo claro no EPUB;
   - numeros, nomes ou frases-chave ausentes.

3. Inconsistencia terminologica
   - termos do glossario traduzidos de formas divergentes;
   - termos do PDF ainda presentes no EPUB.

4. Drift de sentido
   - divergencias fortes por titulo/capitulo;
   - ratios extremos de tamanho;
   - perda de marcadores semanticos importantes.

5. Achados editoriais
   - espanhol residual no EPUB PT-BR;
   - titulos em espanhol;
   - termos problemáticos com recomendacao de traducao.

Criterios de aceite:

- Gerar achados com campos suficientes para tabela:
  - `chapter`
  - `type`
  - `original`
  - `translation`
  - `problem`
  - `recommendation`
  - `location`
- Limitar quantidade por categoria.
- Remover duplicidades e exemplos muito parecidos.
- Classificar achados como informativos/heuristicos, sem aplicar correcoes.

## Milestone 5 - Writer HTML

Status: implementado em `src/pdfEpubComparisonReportWriter.js`.

Criar relatorio HTML baseado no modelo anexado.

Arquivo previsto:

- `src/pdfEpubComparisonReportWriter.js`

Saida:

- `reports/html/pdf-epub-comparison-latest.html`

Caracteristicas:

- layout com abas;
- tabelas por categoria;
- cabecalho com PDF e EPUB usados;
- resumo com totais por aba;
- nota editorial clara de que os achados exigem validacao humana;
- sem links para dashboards tecnicos.

Criterios de aceite:

- HTML abre sozinho no navegador.
- Abas funcionam sem dependencias externas.
- Tabelas ficam legiveis em desktop e mobile.
- Conteudo vazio mostra mensagem amigavel.

## Milestone 6 - CLI e Menu

Status: implementado em `src/auditPdfEpubReport.js`, `src/menu.js` e `../../package.json`.

Criar comando dedicado para gerar o novo relatorio.

Arquivos previstos:

- `src/auditPdfEpubReport.js`
- `src/menu.js`
- `../../package.json`

Comando previsto:

```bash
npm run audit:translation:epub:pdf-report
```

Opcao de menu prevista:

- `Gerar relatorio PDF x EPUB`
- `Validar achados PDF x EPUB`, dentro do submenu de revisao, gerando fila separada:
  - `state/pdf-epub-review-queue.json`

Criterios de aceite:

- Rodar sem afetar auditoria atual.
- Fluxo principal do menu tambem deve gerar `reports/html/pdf-epub-comparison-latest.html` ao final, quando houver PDF disponivel.
- Achados aprovados do relatorio PDF x EPUB devem ficar em fila separada, sem misturar com `state/review-queue.json`.
- Exibir no final apenas o caminho:
  - `reports/html/pdf-epub-comparison-latest.html`
- Exit code deve indicar erro real de execucao, nao quantidade de achados.

## Milestone 7 - Documentacao

Atualizar documentacao do workflow.

Arquivos previstos:

- `README.md`
- opcionalmente `EPUB_REFACTOR_PLAN.md`

Conteudo previsto:

- explicar `input/source/pdf/`;
- explicar diferenca entre:
  - `reader-report-latest.html`
  - `pdf-epub-comparison-latest.html`
- explicar que o novo relatorio e uma comparacao editorial PDF original x EPUB traduzido/validado.

Criterios de aceite:

- Usuario sabe onde colocar o PDF.
- Usuario sabe qual comando rodar.
- Usuario sabe que nenhuma correcao automatica sera aplicada.

## Ordem Recomendada de Execucao

1. Milestone 1 - Lexicos de idioma.
2. Milestone 2 - Leitura do PDF.
3. Milestone 3 - Escolha do EPUB alvo.
4. Milestone 4 - Auditoria PDF x EPUB.
5. Milestone 5 - Writer HTML.
6. Milestone 6 - CLI e menu.
7. Milestone 7 - Documentacao.

## Validacoes Finais

Rodar:

```bash
node --check src/languageLexicons.js
node --check src/pdfReader.js
node --check src/pdfEpubComparisonAudit.js
node --check src/pdfEpubComparisonReportWriter.js
node --check src/auditPdfEpubReport.js
npm run audit:translation:epub:pdf-report
```

Conferir:

- `state/pdf-epub-comparison.json` foi gerado.
- `reports/html/pdf-epub-comparison-latest.html` foi gerado.
- EPUB/PDF originais nao foram alterados.
- `state/review-queue.json` nao foi alterado por esse relatorio.
- `reports/html/reader-report-latest.html` continua sendo o relatorio principal da auditoria EPUB.

## Riscos e Cuidados

- PDFs escaneados podem nao ter texto extraivel.
- PDF e EPUB podem ter quebras de capitulo diferentes.
- Termos compartilhados entre espanhol e portugues exigem filtros fortes.
- Glossario da obra deve continuar tendo prioridade sobre heuristicas gerais.
- O relatorio deve priorizar poucos achados uteis em vez de muitos alertas ruidosos.

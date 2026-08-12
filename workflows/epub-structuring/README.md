# EPUB Structuring Workflow v7.2 PDF Canonical

Workflow para analisar, reestruturar, validar, corrigir e unir EPUBs, preservando o contrato legado de `npm start` e expondo operações seguras pelo menu interativo.

## Uso

Instale as dependências dentro deste workflow:

```bash
npm install
```

### Pipeline legado

Coloque um único `.epub` em `input/`. Opcionalmente, coloque um único `.pdf` da mesma obra em `input/` para recuperar a lista canônica de capítulos.

```bash
npm start
```

`npm start` mantém o contrato histórico: exige exatamente um EPUB em `input/`, aceita PDF opcional, gera o EPUB estruturado e escreve os relatórios em `reports/`.

### Menu interativo

Use o menu para acessar as capacidades já estabilizadas sem alterar o contrato de `npm start`:

```bash
npm run menu
```

Opções disponíveis:

```text
1. Analisar EPUB
2. Detectar capítulos
3. Reestruturar capítulos
4. Revisar títulos dos capítulos
5. Analisar / reconstruir sumário
6. Verificar idioma
7. Usar fonte de referência
8. Corrigir conteúdo pré-capítulo
9. Converter / reconstruir como EPUB 3
10. Validar EPUB
11. Processamento completo
12. Ver relatórios
0. Sair
```

As opções 3, 9 e 11 chamam `runFullPipeline()` diretamente. O menu não usa mais `spawn src/main.js`.

## Saídas

- `output/<nome-do-livro>-structured-complete.epub`
- `output/chapters/`
- `reports/structure_report.json`
- `reports/chapter_report.json`
- `reports/chapter_resplit_report.json`
- `reports/toc_report.json`
- `reports/language_report.json`
- `reports/pdf_toc_report.json`
- `reports/validation_report.json`
- `reports/final_regression_report.json`
- `reports/final_epub_validation.json`

Outras features podem gerar relatórios adicionais em `reports/`, incluindo análise/correção pré-capítulo, merge, auditoria de integridade, normalização de títulos e validações acionadas pelo menu.

## Arquitetura

O pipeline principal foi refatorado para services reutilizáveis:

```text
src/main.js
  ↓
runFullPipeline()
  ↓
preparePipelineContext()
analyzeAndSelectChapterReport()
prepareResplitPrecheck()
runResplit()
buildStructuredOutput()
runFinalAnalysis()
```

`src/main.js` é apenas o entrypoint fino de `npm start`. O menu reutiliza os mesmos services e não duplica o motor do workflow.

## Foco

- Conversão para EPUB 3
- `nav.xhtml`
- `toc.ncx`
- Extração e validação de títulos
- Mapa canônico opcional via PDF ou obra conhecida
- Correção não destrutiva de conteúdo pré-capítulo
- Merge seguro de múltiplos EPUBs
- Auditoria de integridade com fonte de referência opcional
- Normalização sincronizada de títulos em XHTML, NAV e NCX
- Validação final dinâmica sem hardcode de quantidade de capítulos

## Regressão

```bash
npm test
```

A suíte inclui contratos de caixa-preta para `npm start`, cobrindo:

- 0 EPUBs em `input/`
- 1 EPUB sem PDF
- múltiplos EPUBs
- PDF explícito ausente
- conflito `--no-pdf` + `--pdf`
- PDF opcional inválido

## Dívidas conhecidas

- Adapter DOCX real para fonte de referência.
- Nome canônico limpo para saídas finais de merge/normalização.
- Validação final com todas as partes reais da obra.

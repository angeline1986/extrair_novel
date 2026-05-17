# Extract EPUB

Fluxo para extrair EPUBs em arquivos DOCX.

## Uso

- `npm run extract:epub [epubPath] [outputDir] [chapterTitlesPath] [chaptersPerDocx]`
- `npm run extract:epub:groups [epubPath] [outputDir] [chapterTitlesPath] [chaptersPerDocx]`

## Pastas

- `input/` — coloque EPUBs aqui
- `output/` — todos os DOCX extraídos são gerados aqui
- `logs/` — logs de extração

## Scripts

- `scripts/extractEpubInChapterGroups.cjs` — gera DOCX em grupos de 4 capítulos por padrão.

Os extratores antigos por arco foram movidos para `src/legacy/`.

O caminho antigo em `src/extract/` fica apenas como compatibilidade.

# Extract EPUB

Fluxo para extrair EPUBs em arquivos DOCX.

## Uso

- `npm run extract:epub [epubPath] [outputDir]`

## Pastas

- `input/` — coloque EPUBs aqui
- `output/` — todos os DOCX extraídos são gerados aqui
- `logs/` — logs de extração

O entrypoint do workflow é `scripts/extractEpubArcsToDocx.js`; o caminho antigo em `src/extract/` fica apenas como compatibilidade.

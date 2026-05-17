# Build EPUB

Fluxo para gerar EPUB final a partir de arquivos DOCX.

## Uso

- `npm run build:epub`

## Pastas

- `input/` — arquivos DOCX de entrada
- `output/` — EPUB resultante e temporários do empacotamento
- `assets/` — capas, imagens e metadados, incluindo `cover2.jpg`

O script executável vive em `scripts/buildEpubFromDocx.js`; o caminho antigo em `src/epub/` fica apenas como compatibilidade.

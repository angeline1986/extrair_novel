# Analyze Translation

Fluxo para análise e correção de tradução.

## Uso

- `npm run analyze:translation analisar`
- `npm run analyze:translation corrigir`

## Pastas

- `input/` — arquivos originais e traduzidos para análise
- `output/` — todos os DOCX corrigidos são gerados aqui
- `reports/` — todos os relatórios de revisão são gerados aqui

O script executável vive em `scripts/analyzeTranslation.js`. A pasta antiga `src/translation/` foi removida para evitar duplicação com `src/core/`.

# EPUB Structuring Workflow v7.1

## Uso

Coloque um único `.epub` em `input/`.

```bash
npm install
npm start
```

## Saídas

- `output/<nome-do-livro>-structured.epub`
- `reports/structure_report.json`
- `reports/chapter_report.json`
- `reports/toc_report.json`
- `reports/language_report.json`
- `reports/validation_report.json`

## Foco

- Conversão para EPUB 3
- `nav.xhtml`
- `toc.ncx` compatível
- Extração avançada de títulos
- Classificação de frontmatter
- Detecção de capítulos quebrados
- Validação rígida

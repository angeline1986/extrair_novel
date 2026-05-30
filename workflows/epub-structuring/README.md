# EPUB Structuring Workflow v7.2 PDF Canonical

## Uso

Coloque um único `.epub` em `input/`. Opcionalmente, coloque um único `.pdf` da mesma obra em `input/` para recuperar a lista canônica de capítulos.

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
- `reports/pdf_toc_report.json`
- `reports/validation_report.json`

## Foco

- Conversão para EPUB 3
- `nav.xhtml`
- `toc.ncx`
- Extração e validação de títulos
- Mapa canônico opcional via PDF ou obra conhecida

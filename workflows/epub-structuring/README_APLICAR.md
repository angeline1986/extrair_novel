# Patch: EPUB Structuring com mapa canônico via PDF

Copie esta pasta por cima de `workflows/epub-structuring/` no repositório.

Arquivos novos:

- `src/utils/pdf-utils.js`
- `src/config/canonical-chapters.js`
- `src/analyzers/pdf-toc-extractor.js`
- `src/analyzers/canonical-chapter-mapper.js`

Arquivos alterados:

- `package.json`
- `src/main.js`
- `src/utils/file-utils.js`
- `src/analyzers/chapter-detector.js`
- `src/analyzers/chapter-sequence-validator.js`
- `src/analyzers/title-extractor.js`
- `src/analyzers/title-quality-analyzer.js`
- `src/builders/nav-builder.js`
- `src/builders/ncx-builder.js`
- `src/validators/epub3-validator.js`

Uso esperado:

```bash
cd workflows/epub-structuring
npm install
npm start
```

Entrada:

```text
input/
├─ livro.epub
└─ ilide.info-bebe-accidental.pdf
```

Novos relatórios:

- `reports/pdf_toc_report.json`
- `reports/chapter_report.json` com `canonicalMapActive`, `canonicalTitle`, `detectedTitle`, `finalTitle`, `titleSource`, `volume`, `chapterNumber`

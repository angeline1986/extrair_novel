# PDF to EPUB Workflow

Este workflow converte um único PDF em um EPUB 3 válido com:

- estrutura EPUB correta (`mimetype`, `META-INF/container.xml`, OPF, nav, NCX);
- XHTML por capítulo;
- CSS básico;
- relatórios JSON detalhados;
- validação estrutural.

## Como usar

1. Coloque exatamente um arquivo `.pdf` em `input/`.
2. Execute:

```bash
npm install
npm start
```

3. Consulte os resultados em `output/` e `reports/`.

## Saídas esperadas

- `output/<nome>.epub`
- `reports/pdf-analysis.json`
- `reports/chapters.json`
- `reports/epub-structure.json`
- `reports/validation.json`

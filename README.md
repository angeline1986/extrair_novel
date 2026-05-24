# Extrair_novel

Projeto para extrair conteúdo de EPUB/DOCX, traduzir textos com apoio do Ollama, revisar traduções e gerar EPUBs finais.

## Funcionalidades

- Extração EPUB -> DOCX por arcos
- Tradução automática de DOCX com Ollama
- Revisão/análise de traduções
- Geração de EPUB final a partir de DOCX
- Wrappers temporários para compatibilidade com caminhos antigos

## Requisitos

| Requisito | Versão mínima | Observação |
| --- | ---: | --- |
| Node.js | 16.0.0 | Runtime JavaScript |
| npm | 7.0.0 | Gerenciador de pacotes |
| Ollama | 0.1.0 | Necessário apenas para tradução/revisão com IA |
| Modelo Ollama | qwen2.5:7b | Modelo padrão dos scripts de tradução |

## Instalação

```bash
npm install
```

## Comandos Principais

```bash
npm start
npm run translate:one -- caminho/arquivo.docx
npm run translate:folder
npm run translate:sequential
npm run extract:epub -- caminho/livro.epub caminho/saida caminho/chapter_titles.txt 4
npm run build:epub
npm run analyze:translation -- analisar --project=nome_do_projeto
npm run analyze:translation -- corrigir --project=nome_do_projeto
npm run audit:translation:epub
npm run audit:translation:epub:run
npm run audit:translation:epub:menu
npm run fix:translation:epub
npm test
```

## Workflows

Os scripts executáveis ficam em `workflows/`. Cada workflow concentra seus scripts, entradas, saídas e documentação local.

```txt
workflows/
├── audit-translation-epub/
│   ├── input/source/
│   ├── input/translated/
│   ├── input/logs/
│   └── logs/
├── epub-to-docx/
│   ├── input/
│   ├── output/
│   ├── logs/
│   ├── scripts/extractEpubInChapterGroups.cjs
│   └── README.md
├── translate-docx/
│   ├── input/
│   ├── output/
│   ├── logs/
│   ├── scripts/translateOne.js
│   ├── scripts/translateFolder.js
│   ├── scripts/translateSequential.js
│   └── README.md
├── review-translation/
│   ├── input/
│   ├── output/
│   ├── reports/
│   ├── scripts/analyzeTranslation.js
│   └── README.md
└── docx-to-epub/
    ├── assets/
    ├── input/
    ├── output/
    ├── scripts/buildEpubFromDocx.js
    └── README.md
```

## Estrutura do Código

`src/` deve conter código reutilizável, integrações e wrappers de compatibilidade. Scripts operacionais novos devem ficar em `workflows/`.

```txt
src/
├── cli.js
├── core/          # regras, prompts, chunking, validação e revisão
├── io/            # leitura/escrita de DOCX, EPUB e arquivos
├── services/      # integrações externas, como Ollama
├── legacy/        # scripts antigos preservados
├── extract/       # wrappers temporários para caminhos antigos
├── epub/          # wrappers temporários para caminhos antigos
└── utils/         # wrappers temporários para caminhos antigos
```

## Pastas Locais e Artefatos

Estas pastas são de trabalho local ou saída gerada e não devem ser versionadas:

```txt
data/
node_modules/
```

`build/` e `Traducao_corrigida/` eram pastas antigas de saída e não fazem mais parte da estrutura oficial. Os resultados dos scripts devem ser gerados em `workflows/*/output/`.

## Compatibilidade

Os fluxos de tradução e análise devem ser executados pelos comandos `npm run ...` baseados em `workflows/`. Caminhos antigos em `src/translation/` foram removidos para evitar duplicação com `src/core/`.

## Dependências Principais

- `adm-zip` e `cheerio`: leitura de EPUB
- `archiver`: geração de EPUB
- `docx`: criação de arquivos DOCX
- `mammoth`: leitura de DOCX
- `xlsx`: relatórios de análise
- `uuid`: identificadores de EPUB

## Licença

ISC

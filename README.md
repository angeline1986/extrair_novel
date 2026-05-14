# Extrair_novel

[![Node.js](https://img.shields.io/badge/Node.js-v16%2B-green?logo=node.js)](https://nodejs.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-angeline1986-black?logo=github)](https://github.com/angeline1986)

Projeto para extrair texto de arquivos DOCX, organizar traduções e gerar EPUBs consistentes.

## 🚀 Funcionalidades

- ✅ Extração de texto de arquivos DOCX
- ✅ Organização estruturada de traduções
- ✅ Geração automática de EPUBs
- ✅ Suporte a capas e metadados
- ✅ CLI simples e intuitiva

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/angeline1986/extrair_novel.git
cd extrair_novel

# Instale as dependências
npm install
```

## 🔧 Uso

### Fluxo principal: gerar EPUB

1. **Arquivos DOCX:** coloque os arquivos corrigidos em `data/corrected/`
2. **Capas:** coloque a capa em `data/assets/covers/cover2.jpg`
3. **Execute a geração:**

```bash
npm run build:epub
```

### Resultado

O EPUB será gerado em: `build/epub/Winter_Field_PTBR_corrigido.epub`

### Fluxo de revisão de tradução

O projeto também inclui um utilitário de análise/correção de tradução em `src/translation/Analisar_traducao_docx.js`.

- Para gerar uma planilha de revisão de gênero e expressões:

```bash
node src/translation/Analisar_traducao_docx.js analisar
```

- Para gerar versões corrigidas dos DOCX no diretório `Traducao_corrigida/`:

```bash
node src/translation/Analisar_traducao_docx.js corrigir
```

#### Diretórios usados por esse utilitário

- `Traducao/` → arquivos DOCX de tradução originais
- `Traducao_corrigida/` → saída de DOCX corrigidos

> O utilitário cobre revisão automática de gênero e expressões, além de transformar hífens de diálogo em travessões.

### Fluxo de extração EPUB → DOCX

Há também um script de extração que converte capítulos de um EPUB em arquivos DOCX por arco:

```bash
node src/extract/extract-epub-arcs-to-docx.cjs [caminho/do/arquivo.epub] [caminho/de/saida] [caminho/chapter_titles.txt]
```

- `caminho/do/arquivo.epub` → caminho opcional para o EPUB de origem (padrão: `data/source/wtnl.epub`)
- `caminho/de/saida` → diretório opcional de saída para os DOCX (padrão: `build/docx/arcs`)
- `caminho/chapter_titles.txt` → base opcional de títulos de capítulos e arcos (padrão: `data/source/chapter_titles.txt`)

Esse script extrai o `toc.ncx` do EPUB, agrupa capítulos por arco e gera arquivos DOCX nomeados por arco.

## 📁 Estrutura do projeto

```
extrair_novel/
├── src/                    # Código-fonte principal
│   ├── cli.js             # Entrada CLI
│   ├── extract/           # Extração de EPUB e parsing de DOCX
│   ├── epub/              # Geração de EPUB
│   ├── translation/       # Utilitários de tradução
│   ├── utils/             # Helpers genéricos
│   └── legacy/            # Scripts antigos preservados
├── data/                  # Dados de trabalho
│   ├── corrected/         # Traduções revisadas para gerar EPUB
│   ├── assets/            # Capas e recursos
│   └── source/            # EPUBs e bases de título para extração
├── Traducao/              # DOCX de tradução originais usados pelo utilitário
├── Traducao_corrigida/    # Saída de DOCX corrigidos
├── build/                 # Arquivos gerados
│   ├── epub/              # EPUBs finais
│   ├── docx/              # DOCX gerados pela extração de EPUB
│   └── temp/              # Temporários
├── tests/                 # Testes futuros
├── package.json
├── README.md
└── .gitignore
```

## 🛠️ Scripts disponíveis

```bash
npm start                                   # Executa o CLI principal e mostra ajuda
npm run build:epub                          # Gera EPUB a partir de data/corrected/
```

## 🧠 Scripts manuais úteis

```bash
node src/translation/Analisar_traducao_docx.js analisar   # Gera planilha de revisão de tradução
node src/translation/Analisar_traducao_docx.js corrigir  # Gera DOCX corrigidos em Traducao_corrigida/
node src/extract/extract-epub-arcs-to-docx.cjs [epub] [saida] [chapter_titles.txt]  # Extrai capítulos de EPUB para DOCX por arco
node src/cli.js help                                     # Mostra ajuda do CLI principal
```

## 📌 Scripts de referência (legado)

O diretório `src/legacy/` contém versões anteriores e utilitários de suporte. Use-os apenas para comparação ou recuperação de lógica antiga.

- `src/legacy/DocxToEpub.js` — conversão antiga DOCX → EPUB
- `src/legacy/Extrair_novel.js` — primeira versão de extração/processamento
- `src/legacy/Extrair_novel2.js` — variante de extração adicional
- `src/legacy/Extrair_novel3.js` — outra variante de extração
- `src/legacy/Gera_Epub.js` — geração antiga de EPUB
- `src/legacy/Gera_Epub2.js` — segunda versão de geração de EPUB
- `src/legacy/Winterfield_extrair_docx.js` — extração específica para Winter Field
- `src/legacy/winterfield_volumes_epub.js` — geração de EPUBs de volumes Winter Field

## �📚 Dependências

### Principais
- `archiver` — Criação de arquivos EPUB (ZIP estruturado)
- `mammoth` — Extração de texto de DOCX
- `uuid` — Identificadores únicos para metadados

### Legadas
- `docx` — Manipulação avançada de DOCX
- `puppeteer` — Scripts de scraping (não usado no fluxo principal)
- `xlsx` — Utilitários de planilha

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC.

## 👤 Autor

**Aline Souza** - [angeline1986](https://github.com/angeline1986)

---

⭐ Se este projeto te ajudou, considere dar uma estrela!

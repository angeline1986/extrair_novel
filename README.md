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

### Preparação dos arquivos

1. **Arquivos DOCX:** Coloque em `data/corrected/`
2. **Capas:** Coloque em `data/assets/covers/cover2.jpg`
3. **Execute a geração:**

```bash
npm run build:epub
```

### Resultado

O EPUB será gerado em: `build/epub/Winter_Field_PTBR_corrigido.epub`

## 📁 Estrutura do projeto

```
extrair_novel/
├── src/                    # Código-fonte principal
│   ├── cli.js             # Entrada CLI
│   ├── extract/           # Leitura e parsing de DOCX
│   ├── epub/              # Geração de EPUB
│   ├── translation/       # Utilitários de tradução
│   ├── utils/             # Helpers genéricos
│   └── legacy/            # Scripts antigos preservados
├── data/                  # Dados de trabalho
│   ├── input/             # DOCX originais
│   ├── translated/        # Traduções brutas
│   ├── corrected/         # Traduções revisadas
│   └── assets/            # Capas e recursos
├── build/                 # Arquivos gerados
│   ├── epub/              # EPUBs finais
│   └── temp/              # Temporários
├── tests/                 # Testes futuros
├── package.json
├── README.md
└── .gitignore
```

## 🛠️ Scripts disponíveis

```bash
npm start              # Executa o CLI principal
npm run build:epub     # Gera EPUB a partir de data/corrected/
```

## 📚 Dependências

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

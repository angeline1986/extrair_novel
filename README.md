# Extrair_novel

Projeto para extrair texto de arquivos DOCX, organizar traduções e gerar EPUBs consistentes.

## Visão geral

O objetivo deste repositório é manter o processo de conversão e geração de EPUBs mais organizado. A estrutura atual separa:

- código-fonte
- entradas de dados
- ativos de capa
- resultados gerados
- scripts legados

Isso facilita manter o projeto escalável e reduz a bagunça no root.

## Estrutura do projeto

- `package.json` — dependências, tipo de módulo e scripts principais
- `README.md` — documentação do projeto
- `.gitignore` — arquivos e pastas ignorados pelo Git
- `src/` — código-fonte principal
  - `src/cli.js` — entrada CLI
  - `src/extract/` — leitura e parsing de arquivos DOCX
  - `src/epub/` — geração de EPUB
  - `src/translation/` — utilitários de tradução
  - `src/utils/` — helpers genéricos
  - `src/legacy/` — scripts antigos preservados para referência
- `data/` — dados de trabalho
  - `data/input/` — arquivos `.docx` de entrada originais
  - `data/translated/` — traduções brutas ou arquivos em processamento
  - `data/corrected/` — traduções revisadas usadas para gerar EPUB
  - `data/assets/` — capas, imagens e outros recursos estáticos
- `build/` — arquivos gerados e temporários
  - `build/epub/` — EPUBs finais
  - `build/temp/` — arquivos temporários de construção
- `tests/` — testes e validações futuras

## Dependências

O projeto usa Node.js em modo de módulos (`type: module`). As dependências atuais são:

- `archiver` — faz o arquivo EPUB (ZIP com estrutura específica)
- `docx` — manipulação de arquivos DOCX e geração de conteúdo
- `mammoth` — extração de texto de DOCX
- `puppeteer` — scripts legados de scraping (não usados no fluxo principal)
- `uuid` — identificadores únicos para metadados EPUB
- `xlsx` — utilitários de planilha (preservado para uso futuro)

## Instalação

Instale as dependências com:

```bash
npm install
```

## Uso principal

### 1. Colocar arquivos de entrada

- `data/corrected/` — arquivo `.docx` pronto para conversão em EPUB.
- `data/input/` — deixe aqui apenas os DOCX originais se quiser manter a versão bruta.

### 2. Colocar capa

- `data/assets/covers/cover2.jpg` — capa usada pelo gerador atual.

Se quiser usar outra imagem, renomeie para `cover2.jpg` ou ajuste o caminho em `src/epub/epubGenerator.js`.

### 3. Executar a geração

```bash
npm run build:epub
```

Esse comando:

- lê os `.docx` de `data/corrected/`
- monta a estrutura EPUB em `build/temp/`
- cria o arquivo final em `build/epub/`

### 4. Verificar resultado

O EPUB gerado ficará em:

- `build/epub/Winter_Field_PTBR_corrigido.epub`

## Scripts disponíveis

- `npm start` — abre o CLI principal (`src/cli.js`)
- `npm run build:epub` — gera o EPUB a partir de `data/corrected/`

## Como funciona o fluxo

1. `src/cli.js` escolhe a operação.
2. `src/epub/epubGenerator.js` monta a estrutura EPUB padrão.
3. `src/extract/docxExtractor.js` lê e parseia os arquivos DOCX.
4. `src/utils/fileUtils.js` fornece helpers de diretório e escrita.

## Boas práticas

- mantenha apenas arquivos `.docx` válidos em `data/corrected/`
- preserve imagens e capas em `data/assets/`
- limpe `build/temp/` sempre que quiser refazer a geração completa

## Arquivos legados

A pasta `src/legacy/` contém scripts antigos que ainda podem ser úteis como referência, mas não fazem parte do fluxo principal atual.

## Dúvidas ou ajustes

Se quiser alterar o nome do EPUB de saída, edite `OUTPUT_FILE` em `src/epub/epubGenerator.js`.

Se quiser suportar outro formato de capa ou outra pasta de entrada, basta atualizar as constantes no mesmo arquivo.

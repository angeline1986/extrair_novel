# Plano de Refatoração do Extrair_novel

## Objetivo
Reorganizar o projeto em uma estrutura clara e coerente, separando:
- **workflows/** = scripts executáveis + input/output/logs
- **src/core/** = módulos reutilizáveis de lógica
- **src/io/** = leitura/escrita de arquivos
- **src/services/** = integrações externas
- **src/legacy/** = scripts antigos preservados

> Nota de atualização: `src/translation/` foi removida após a migração para evitar duplicação com `src/core/`. As referências a `src/translation/` neste plano documentam caminhos antigos/origem da refatoração, não a estrutura final desejada.

---

## 1. NOVA ESTRUTURA DE DIRETÓRIOS

```
extrair_novel/
│
├── workflows/                      # Scripts executáveis operacionais
│   ├── translate-docx/
│   │   ├── scripts/
│   │   │   ├── translateOne.js           # Traduz um arquivo DOCX
│   │   │   ├── translateFolder.js        # Traduz pasta completa
│   │   │   └── translateSequential.js    # Traduz com recursos limitados
│   │   ├── input/                        # Onde colocar .docx originais
│   │   ├── output/                       # .docx traduzidos saem aqui
│   │   ├── logs/                         # Logs de execução
│   │   └── README.md
│   │
│   ├── epub-to-docx/
│   │   ├── scripts/
│   │   │   ├── extractEpubToDocx.js      # Extrai EPUB simples em DOCX
│   │   │   └── extractEpubArcsToDocx.js  # Extrai EPUB em DOCXs por arco
│   │   ├── input/                        # .epub originais
│   │   ├── output/                       # .docx extraídos
│   │   ├── logs/
│   │   └── README.md
│   │
│   ├── docx-to-epub/
│   │   ├── scripts/
│   │   │   └── buildEpubFromDocx.js      # Gera EPUB final
│   │   ├── input/                        # .docx para composição
│   │   ├── output/                       # .epub saída
│   │   ├── assets/                       # Capas e recursos
│   │   └── README.md
│   │
│   └── review-translation/
│       ├── scripts/
│       │   └── analyzeTranslation.js     # Análise e correção
│       ├── input/                        # Arquivos para análise
│       ├── output/                       # Arquivos corrigidos
│       ├── reports/                      # Relatórios .xlsx
│       └── README.md
│
├── src/                            # Código reutilizável
│   ├── core/                       # Regras e algoritmos
│   │   ├── chunker.js              # Divisão de texto (moved from translation)
│   │   ├── glossary.js             # Glossário (moved from translation)
│   │   ├── nameProtector.js        # Proteção de nomes (moved from translation)
│   │   ├── prompts.js              # Prompts de IA (moved from translation)
│   │   ├── validator.js            # Validação (moved from translation)
│   │   ├── finalPolish.js          # Pós-processamento (moved from translation)
│   │   └── reviewTranslation.js    # Revisão (moved from translation)
│   │
│   ├── io/                         # I/O de arquivos
│   │   ├── fileUtils.js            # Utilidades gerais (moved from utils)
│   │   ├── docxReader.js           # Leitura DOCX (from docxExtractor.js)
│   │   ├── docxWriter.js           # Escrita DOCX (novo wrapper)
│   │   └── epubReader.js           # Leitura EPUB (novo, de logica do extract)
│   │
│   ├── services/
│   │   └── ollamaClient.js         # Cliente Ollama (moved from translation)
│   │
│   └── legacy/                     # Scripts antigos para referência
│       ├── DocxToEpub.js
│       ├── Extrair_novel.js
│       ├── Extrair_novel.py
│       ├── Extrair_novel2.js
│       ├── Extrair_novel3.js
│       ├── Gera_Epub.js
│       ├── Gera_Epub2.js
│       ├── Winterfield_extrair_docx.js
│       └── winterfield_volumes_epub.js
│
├── data/                           # Dados de trabalho
│   ├── assets/                     # Capas e metadados
│   │   └── covers/
│   ├── source/                     # Fontes (EPUB originais, chapter_titles.txt)
│   ├── input/                      # DOCX originais
│   ├── translated/                 # Traduções brutas (cache)
│   └── corrected/                  # Traduções revisadas
│
├── .gitignore
├── package.json
├── README.md
└── REFACTORING_PLAN.md
```

---

## 2. MAPEAMENTO DE ARQUIVOS MOVIDOS

### 2.1 Módulos reutilizáveis para `src/core/`

| Origem | Destino | Motivo |
|--------|---------|--------|
| `src/translation/chunker.js` | `src/core/chunker.js` | Algoritmo reutilizável |
| `src/translation/glossary.js` | `src/core/glossary.js` | Dados/lógica reutilizável |
| `src/translation/nameProtector.js` | `src/core/nameProtector.js` | Algoritmo genérico |
| `src/translation/prompts.js` | `src/core/prompts.js` | Templates de IA |
| `src/translation/validator.js` | `src/core/validator.js` | Validação genérica |
| `src/translation/finalPolish.js` | `src/core/finalPolish.js` | Pós-processamento |
| `src/translation/reviewTranslation.js` | `src/core/reviewTranslation.js` | Revisão de texto |

### 2.2 Módulos I/O para `src/io/`

| Origem | Destino | Motivo |
|--------|---------|--------|
| `src/extract/docxExtractor.js` | `src/io/docxReader.js` | Leitura DOCX |
| `src/utils/fileUtils.js` | `src/io/fileUtils.js` | Mantém, mas aqui é I/O |
| *(novo)* | `src/io/docxWriter.js` | Wrapper para escrita DOCX |
| *(novo)* | `src/io/epubReader.js` | Extrair lógica do extract-epub-arcs-to-docx.cjs |

### 2.3 Serviços para `src/services/`

| Origem | Destino | Motivo |
|--------|---------|--------|
| `src/translation/ollamaClient.js` | `src/services/ollamaClient.js` | Integração externa |

### 2.4 Helpers para `src/translation/` (internos do workflow)

| Arquivo | Destino | Motivo |
|---------|---------|--------|
| `src/translation/translationHelpers.js` | `src/translation/translationHelpers.js` | Mantém (helpers do workflow) |

### 2.5 Scripts executáveis para `workflows/`

| Origem | Destino | Tipo |
|--------|---------|------|
| `src/translation/translateDocx.js` | `workflows/translate-docx/scripts/translateOne.js` | Refatorar imports |
| `src/translation/translateDirectory.js` | `workflows/translate-docx/scripts/translateFolder.js` | Renomear + refatorar |
| `src/translation/translateArcsSequential.js` | `workflows/translate-docx/scripts/translateSequential.js` | Refatorar |
| `src/translation/Analisar_traducao_docx.js` | `workflows/review-translation/scripts/analyzeTranslation.js` | Renomear + refatorar |
| `src/extract/extract-epub-arcs-to-docx.cjs` | `workflows/epub-to-docx/scripts/extractEpubArcsToDocx.js` | Converter CJS→ESM, refatorar |
| `src/epub/epubGenerator.js` | `workflows/docx-to-epub/scripts/buildEpubFromDocx.js` | Refatorar imports |

### 2.6 Scripts legados para `src/legacy/` (já lá)

Já estão em `src/legacy/`, apenas confirmar:
- `DocxToEpub.js`
- `Extrair_novel.js`, `Extrair_novel2.js`, `Extrair_novel3.js`
- `Gera_Epub.js`, `Gera_Epub2.js`
- `Winterfield_extrair_docx.js`
- `winterfield_volumes_epub.js`

---

## 3. WRAPPERS TEMPORÁRIOS

Para manter compatibilidade, criar redirecionadores nos caminhos antigos:

### 3.1 `src/translation/` wrappers

**src/translation/chunker.js**
```javascript
// Wrapper para compatibilidade retroativa
export { default } from '../../core/chunker.js';
```

**src/translation/glossary.js**, **nameProtector.js**, **prompts.js**, **validator.js**, **finalPolish.js**, **reviewTranslation.js**
```javascript
// Mesma estratégia
```

### 3.2 `src/extract/` wrappers

**src/extract/docxExtractor.js** (já existe, mover lógica para src/io/docxReader.js)
```javascript
// Wrapper
export * from '../../io/docxReader.js';
```

### 3.3 `src/services/` wrapper

**src/translation/ollamaClient.js**
```javascript
// Wrapper
export * from '../../services/ollamaClient.js';
```

---

## 4. PACKAGE.JSON ATUALIZADO

```json
{
  "type": "module",
  "name": "extrair_novel",
  "version": "2.0.0",
  "description": "Extração de DOCX e geração de EPUBs organizados com suporte a traduções.",
  "main": "src/cli.js",
  "repository": {
    "type": "git",
    "url": "https://github.com/angeline1986/extrair_novel.git"
  },
  "scripts": {
    "start": "node src/cli.js",
    
    "translate:one": "node workflows/translate-docx/scripts/translateOne.js",
    "translate:folder": "node workflows/translate-docx/scripts/translateFolder.js",
    "translate:sequential": "node workflows/translate-docx/scripts/translateSequential.js",
    
    "extract:epub": "node workflows/epub-to-docx/scripts/extractEpubArcsToDocx.js",
    
    "build:epub": "node workflows/docx-to-epub/scripts/buildEpubFromDocx.js",
    
    "analyze:translation": "node workflows/review-translation/scripts/analyzeTranslation.js",
    
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "docx",
    "epub",
    "converter",
    "traducao",
    "ebook",
    "cli"
  ],
  "author": "Aline Souza <angeline.fm@gmail.com> (https://github.com/angeline1986)",
  "license": "ISC",
  "dependencies": {
    "archiver": "^7.0.1",
    "docx": "^9.6.1",
    "mammoth": "^1.12.0",
    "puppeteer": "^24.42.0",
    "uuid": "^14.0.0",
    "xlsx": "^0.18.5"
  },
  "engines": {
    "node": ">=16.0.0",
    "npm": ">=7.0.0"
  }
}
```

---

## 5. EXPLICAÇÃO DOS COMANDOS NOVOS

| Comando | Antes | Depois | Uso |
|---------|-------|--------|-----|
| Traduzir um arquivo | `node src/translation/translateDocx.js file.docx` | `npm run translate:one file.docx` | Traduz um único .docx |
| Traduzir pasta | `node src/translation/translateDirectory.js` | `npm run translate:folder` | Traduz todos em pasta |
| Traduzir sequencial | `node src/translation/translateArcsSequential.js` | `npm run translate:sequential` | Com limite de memória |
| Extrair EPUB | `node src/extract/extract-epub-arcs-to-docx.cjs [epub] [out]` | `npm run extract:epub [epub] [out]` | EPUB→DOCX por arco |
| Gerar EPUB | `npm run build:epub` | `npm run build:epub` | *Mantém igual* (conveniência) |
| Analisar tradução | `node src/translation/Analisar_traducao_docx.js [modo]` | `npm run analyze:translation [modo]` | Análise/correção |

---

## 6. RISCOS DE COMPATIBILIDADE

### 6.1 Compatibilidade **MANTIDA**
- ✅ Comandos antigos continuam funcionando (scripts diretos)
- ✅ Imports antigos via wrappers
- ✅ `npm run build:epub` (alias mantido)
- ✅ `npm start` (aponta para `src/cli.js`, mesmo local)
- ✅ Lógica de negócio não muda

### 6.2 Compatibilidade **QUEBRADA** (controlado)
- ⚠️ Scripts movidos para `workflows/` (scripts diretos apontam para novos locais)
- ⚠️ Imports diretos de `src/translation/*` para `src/core/*` (solver via wrappers)
- ⚠️ `extract-epub-arcs-to-docx.cjs` → `.js` (CommonJS → ESM)

### 6.3 Como mitigar riscos

1. **Wrappers**: Todos os módulos movidos têm re-exportadores nos locais antigos
2. **Aliases no package.json**: Scripts npm tapam "buracos"
3. **Testes manuais**: Verificar cada workflow antes de dar por encerrado
4. **Commit incremental**: Fazer em pequenos passos, não tudo de uma vez
5. **Branch de experimentação**: Testar em branch antes de mergear

---

## 7. ESTRATÉGIA DE EXECUÇÃO (INCREMENTAL)

### Fase 1: Preparação (commit seguro)
- [ ] Criar estrutura de pastas `workflows/`
- [ ] Criar estrutura de pastas `src/core/`, `src/io/`, `src/services/`
- [ ] Commit: "chore: create directory structure for refactoring"

### Fase 2: Mover módulos reutilizáveis
- [ ] Copiar `src/translation/chunker.js` → `src/core/chunker.js` (+ ajustar imports internos)
- [ ] Copiar `src/translation/glossary.js` → `src/core/glossary.js`
- [ ] Copiar `src/translation/nameProtector.js` → `src/core/nameProtector.js`
- [ ] Copiar `src/translation/prompts.js` → `src/core/prompts.js`
- [ ] Copiar `src/translation/validator.js` → `src/core/validator.js`
- [ ] Copiar `src/translation/finalPolish.js` → `src/core/finalPolish.js`
- [ ] Copiar `src/translation/reviewTranslation.js` → `src/core/reviewTranslation.js`
- [ ] Commit: "refactor: move translation modules to src/core/"

### Fase 3: Mover serviços
- [ ] Copiar `src/translation/ollamaClient.js` → `src/services/ollamaClient.js`
- [ ] Ajustar imports em ollamaClient (se houver refs a translation/)
- [ ] Commit: "refactor: move ollamaClient to src/services/"

### Fase 4: Mover I/O
- [ ] Refatorar `src/extract/docxExtractor.js` → `src/io/docxReader.js`
- [ ] Copiar `src/utils/fileUtils.js` → `src/io/fileUtils.js`
- [ ] Criar `src/io/docxWriter.js` (wrapper + novo código)
- [ ] Commit: "refactor: move I/O modules to src/io/"

### Fase 5: Mover scripts executáveis
- [ ] Copiar `src/translation/translateDocx.js` → `workflows/translate-docx/scripts/translateOne.js`
  - [ ] Ajustar imports (agora aponta para `src/core/`, `src/services/`, etc.)
- [ ] Copiar `src/translation/translateDirectory.js` → `workflows/translate-docx/scripts/translateFolder.js`
- [ ] Copiar `src/translation/translateArcsSequential.js` → `workflows/translate-docx/scripts/translateSequential.js`
- [ ] Copiar `src/translation/Analisar_traducao_docx.js` → `workflows/review-translation/scripts/analyzeTranslation.js`
- [ ] Converter `src/extract/extract-epub-arcs-to-docx.cjs` → `workflows/epub-to-docx/scripts/extractEpubArcsToDocx.js`
- [ ] Copiar `src/epub/epubGenerator.js` → `workflows/docx-to-epub/scripts/buildEpubFromDocx.js`
- [ ] Commit: "refactor: move executable scripts to workflows/"

### Fase 6: Criar wrappers
- [ ] Criar wrappers em `src/translation/` apontando para `src/core/`
- [ ] Criar wrapper em `src/translation/ollamaClient.js` apontando para `src/services/`
- [ ] Criar wrapper em `src/extract/docxExtractor.js` apontando para `src/io/`
- [ ] Commit: "chore: create backward-compatibility wrappers"

### Fase 7: Atualizar package.json
- [ ] Adicionar scripts `npm run translate:*`, `npm run extract:*`, etc.
- [ ] Commit: "chore: update package.json with new workflow commands"

### Fase 8: Criar READMEs de workflows
- [ ] `workflows/translate-docx/README.md`
- [ ] `workflows/epub-to-docx/README.md`
- [ ] `workflows/docx-to-epub/README.md`
- [ ] `workflows/review-translation/README.md`
- [ ] Commit: "docs: add workflow README files"

### Fase 9: Criar diretórios input/output/logs
- [ ] Criar estrutura vazia (com `.gitkeep`) em cada workflow
- [ ] Commit: "chore: create input/output/logs directories in workflows"

### Fase 10: Atualizar README principal
- [ ] Documentar nova estrutura
- [ ] Atualizar exemplos de comando
- [ ] Commit: "docs: update main README with new structure"

### Fase 11: Testar e validar
- [ ] [ ] Testes manuais de cada workflow
- [ ] [ ] Verificar se wrappers funcionam
- [ ] [ ] Commit final de testes

---

## 8. SUGESTÕES DE TESTE MANUAL

### 8.1 Após mover módulos para `src/core/`

```bash
# Verificar que imports ainda funcionam via wrappers
node -e "import('src/translation/chunker.js').then(m => console.log('OK'))"
```

### 8.2 Após copiar scripts para `workflows/`

```bash
# Testar tradução de um arquivo
npm run translate:one workflows/translate-docx/input/test.docx

# Testar lista de pastas
npm run translate:folder

# Testar extração
npm run extract:epub data/source/wtnl.epub workflows/epub-to-docx/output/

# Testar construção de EPUB
npm run build:epub

# Testar análise
npm run analyze:translation analisar
```

### 8.3 Verificar compatibilidade retroativa

```bash
# Testes com paths antigos (devem falhar gracefully ou funcionar via wrapper)
node src/translation/translateDocx.js workflows/translate-docx/input/test.docx
node src/translation/Analisar_traducao_docx.js analisar
node src/extract/extract-epub-arcs-to-docx.cjs data/source/wtnl.epub
```

### 8.4 Verificar estrutura final

```bash
# Listar estrutura
tree -L 3 workflows/
tree -L 2 src/

# Verificar wrappers
head -5 src/translation/chunker.js  # Deve mostrar re-export
head -5 src/services/ollamaClient.js  # Deve existir aqui
```

---

## 9. ORDEM DE COMMITS RECOMENDADA

```
commit 1: Create directory structure for refactoring
commit 2: Move translation modules to src/core/
commit 3: Move ollamaClient to src/services/
commit 4: Move I/O modules to src/io/
commit 5: Move executable scripts to workflows/
commit 6: Create backward-compatibility wrappers
commit 7: Update package.json with new commands
commit 8: Add workflow README documentation
commit 9: Create input/output/logs directories
commit 10: Update main README with new structure
commit 11: Test all workflows and fix issues
```

---

## 10. CHECKLIST FINAL

- [ ] Todos os arquivos copiados para novos locais
- [ ] Imports ajustados em cada novo arquivo
- [ ] Wrappers criados nos locais antigos
- [ ] package.json atualizado com novos scripts
- [ ] READMEs de workflow criados
- [ ] Teste manual de cada comando `npm run translate:*`, etc.
- [ ] Teste de compatibilidade retroativa (scripts antigos)
- [ ] Verificar geração de EPUB com smoke test em `src/epub/epubGenerator.js`
- [ ] Verificar que `npm run build:epub` ainda funciona
- [ ] Verificar que `npm start` ainda funciona
- [ ] Nenhum breaking change não-intencional
- [ ] Todos os commits atomizados e descritivos
- [ ] Atualizar documentação principal

---

## 11. PRÓXIMOS PASSOS

1. **Você revisar este plano** e aprovar a abordagem
2. **Começar Fase 1** (criar diretórios)
3. **Fazer cada fase em um branch** (opcional, mas seguro)
4. **Mergear para main** após validação manual
5. **Push para GitHub** quando tudo estiver OK

---

**Gerado em**: 15 de maio de 2026  
**Status**: Plano aprovado para execução

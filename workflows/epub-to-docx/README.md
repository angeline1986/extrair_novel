Aqui está o README atualizado com as novas funcionalidades:

```markdown
# Extract EPUB

Fluxo para extrair EPUBs em arquivos DOCX, mantendo a ordem de leitura original do EPUB e incluindo automaticamente todos os blocos de conteúdo, mesmo aqueles que não estão no TOC.

## 📋 Características

- ✅ Usa **spine** como fonte principal da ordem de leitura (não depende apenas do TOC)
- ✅ Inclui automaticamente blocos grandes (≥5000 caracteres) mesmo sem título no TOC
- ✅ Agrupa capítulos por tamanho aproximado (não por quantidade fixa)
- ✅ Auditoria independente que verifica se todo o conteúdo foi extraído
- ✅ Suporte a fallback para blocos sem título reconhecido
- ✅ Cache de extração para melhor performance

## 🚀 Uso

### Comando principal (recomendado)

```bash
npm run extract:epub [epubPath] [outputDir] [chapterTitlesPath] [targetSizeKB]
```

### Parâmetros

| Parâmetro | Descrição | Padrão |
|-----------|-----------|--------|
| `epubPath` | Caminho do arquivo EPUB | Primeiro arquivo `.epub` na pasta `input/` |
| `outputDir` | Diretório de saída para DOCX | `output/[nome_epub]-[data]/` |
| `chapterTitlesPath` | Arquivo com títulos customizados | `input/chapter_titles.txt` |
| `targetSizeKB` | Tamanho alvo por arquivo DOCX (KB) | `400` |

### Exemplos

```bash
# Usar EPUB da pasta input/ com configurações padrão
npm run extract:epub

# Especificar EPUB e tamanho alvo
npm run extract:epub meu_livro.epub "" "" 500

# Especificar todos os parâmetros
npm run extract:epub livro.epub ./saida ./titulos.txt 300

# Modo verbose (mais detalhes no log)
node scripts/extractEpubInChapterGroups.cjs --verbose
```

## 📁 Pastas

| Pasta | Descrição |
|-------|-----------|
| `input/` | Coloque os arquivos EPUB aqui |
| `output/` | Todos os DOCX extraídos são gerados aqui |
| `logs/` | Logs de extração e relatórios de validação |

## 📄 Arquivos de Entrada

### `input/chapter_titles.txt` (opcional)

Permite customizar títulos de capítulos. Formato:

```
1. Título do Capítulo 1
2. Título do Capítulo 2
**Volume 1: Nome do Volume**
```

## 📊 Relatórios Gerados

Para cada execução, são gerados na pasta `logs/`:

| Arquivo | Descrição |
|---------|-----------|
| `validation-summary.txt` | Resumo da extração e validações |
| `validation-report.json` | Relatório detalhado em JSON |

### O relatório inclui:

- Status da validação (OK/FAIL)
- Quantidade de itens no TOC vs spine
- Blocos obrigatórios processados vs ausentes
- Blocos incluídos por fallback
- Estatísticas de cada arquivo DOCX gerado

## 🧠 Como Funciona

### Ordem de Leitura

1. **Lê o arquivo OPF** - Encontra via `META-INF/container.xml`
2. **Carrega o spine** - Obtém ordem real de leitura do EPUB
3. **Mescla com TOC** - Enriquece itens com títulos quando disponíveis
4. **Filtro inteligente**:
   - Blocos ≥5000 caracteres → sempre incluídos
   - Blocos <5000 caracteres → incluídos apenas se reconhecidos como capítulo
5. **Agrupamento** - Por tamanho alvo (padrão 400KB)
6. **Geração** - Cria arquivos DOCX

### Auditoria Independente

Após a geração, o script verifica:
- Se todos os blocos obrigatórios (≥5000 chars) foram processados
- Se a ordem dos capítulos foi preservada
- Se nenhum DOCX está vazio

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run extract:epub` | Versão principal com agrupamento por tamanho |
| `npm run extract:epub:groups` | (Legado) Agrupa por quantidade fixa |

## 📦 Estrutura do Projeto

```
scripts/
├── extractEpubInChapterGroups.cjs   # Script principal
└── modules/
    ├── config.cjs                    # Configurações
    ├── utils.cjs                     # Utilitários
    ├── text-processor.cjs            # Limpeza/normalização
    ├── chapter-parser.cjs            # Parse de títulos/capítulos
    ├── epub-reader.cjs               # Leitura do EPUB
    ├── docx-generator.cjs            # Geração de DOCX
    └── validation.cjs                # Validação e auditoria
```

## 🔄 Legado

Extratores antigos por arco foram movidos para `src/legacy/`. O caminho antigo em `src/extract/` fica apenas como compatibilidade.

## ⚠️ Códigos de Saída

| Código | Significado |
|--------|-------------|
| `0` | Execução bem-sucedida, todos os blocos extraídos |
| `1` | Falha na validação (blocos obrigatórios ausentes, DOCX vazios, etc.) |

## 🐛 Troubleshooting

### "Blocos obrigatórios NÃO processados" no relatório

Verifique se os arquivos no spine são realmente textuais (`.xhtml`, `.html`, `.htm`). Se o problema persistir, execute com `--verbose` para mais detalhes.

### Títulos fallback genéricos ("Bloco sem título X")

Isso ocorre quando o bloco tem conteúdo significativo mas não há título no TOC nem cabeçalho detectado no HTML. Para melhorar, edite o arquivo `chapter_titles.txt` ou ajuste os padrões de detecção.

## 📝 Dependências

- `adm-zip` - Leitura de arquivos ZIP/EPUB
- `cheerio` - Parse de HTML/XML
- `docx` - Geração de documentos DOCX
```

Este README atualizado inclui:

1. **Características principais** - Destaque das funcionalidades novas
2. **Parâmetros detalhados** - Tabela clara dos argumentos
3. **Como funciona** - Explicação do fluxo de extração
4. **Auditoria** - Descrição da validação independente
5. **Estrutura do projeto** - Mostra a arquitetura modular
6. **Troubleshooting** - Ajuda para problemas comuns
7. **Códigos de saída** - Documentação dos retornos do script
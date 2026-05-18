```txt
================================================================================
AUDITORIA DE TRADUÇÕES DOCX
================================================================================

Fluxo para validar traduções de DOCX (Google Tradutor), comparando arquivos
originais em inglês com suas versões traduzidas para português.


--------------------------------------------------------------------------------
CARACTERÍSTICAS
--------------------------------------------------------------------------------

- Compara original (inglês) com tradução (português)
- Detecta capítulos ausentes, truncamentos e perda de conteúdo
- Identifica padrões comuns do Google Tradutor
- Verifica consistência estrutural e de formatação
- Usa IA (Ollama) apenas para casos suspeitos (econômico)
- Validação tolerante (evita falsos positivos)
- Cache do Ollama para evitar reprocessamento
- Gera relatórios em JSON, CSV e TXT


--------------------------------------------------------------------------------
REQUISITOS
--------------------------------------------------------------------------------

- Node.js >= 18.0.0
- Ollama instalado e rodando (com modelo qwen2.5:7b ou similar)

Para iniciar o Ollama:
  ollama serve


--------------------------------------------------------------------------------
USO
--------------------------------------------------------------------------------

Comando principal (via npm da raiz):

  npm run audit:translation

Comando com logs detalhados:

  npm run audit:translation:verbose

Execução direta:

  node workflows/audit-translation-docx/src/index.js
  node workflows/audit-translation-docx/src/index.js --verbose


--------------------------------------------------------------------------------
ESTRUTURA DE PASTAS
--------------------------------------------------------------------------------

workflows/audit-translation-docx/
├── input/
│   ├── source/           # Colocar DOCX originais (inglês) aqui
│   └── translated/       # Colocar DOCX traduzidos (português) aqui
├── output/               # Relatórios gerados (JSON, CSV, TXT)
├── logs/                 # Logs e cache do Ollama
└── src/                  # Código fonte
    ├── index.js          # Orquestrador principal
    ├── config.js         # Configurações (limiares, padrões)
    ├── utils.js          # Utilitários (similaridade, hash)
    ├── docxReader.js     # Leitura de arquivos DOCX
    ├── chapterParser.js  # Parse de capítulos e títulos
    ├── aligner.js        # Alinhamento original ↔ tradução
    ├── ollamaReviewer.js # Revisão com IA (apenas suspeitos)
    ├── reportWriter.js   # Geração de relatórios
    └── checks/
        ├── structural.js     # Capítulos faltando, tamanho, parágrafos
        ├── content.js        # Truncamento, inglês residual
        ├── consistency.js    # Repetições, formatação, nomes
        └── gtPatterns.js     # Padrões específicos do Google Tradutor


--------------------------------------------------------------------------------
PARÂMETROS DE VALIDAÇÃO (TOLERANTES)
--------------------------------------------------------------------------------

| Parâmetro                    | Valor | Descrição                              |
|------------------------------|-------|----------------------------------------|
| Tamanho mínimo da tradução   | 65%   | Aceita traduções até 35% menores       |
| Tamanho máximo da tradução   | 135%  | Aceita expansão natural                |
| Parágrafos mínimos           | 70%   | Aceita perda de até 30% dos parágrafos |
| Inglês residual máximo       | 8%    | Acima disso gera alerta                |
| Repetição máxima             | 5%    | Acima disso gera alerta                |


--------------------------------------------------------------------------------
RELATÓRIOS GERADOS
--------------------------------------------------------------------------------

Após cada execução, os seguintes arquivos são criados:

| Arquivo                                    | Descrição                                    |
|--------------------------------------------|----------------------------------------------|
| output/audit-report-YYYY-MM-DD_HH-MM.json  | Relatório completo em JSON                   |
| output/issues-YYYY-MM-DD_HH-MM.csv         | Issues e warnings em CSV                     |
| output/problematic-chapters-...txt         | Detalhes manuais de capítulos problemáticos  |
| logs/audit-summary-YYYY-MM-DD_HH-MM.txt    | Resumo legível em TXT                        |


--------------------------------------------------------------------------------
TIPOS DE ISSUES DETECTADAS
--------------------------------------------------------------------------------

FAIL (crítico - requer atenção):
  - Capítulo ausente na tradução
  - Tradução vazia ou muito curta (<40% do original)
  - Inglês residual excessivo (>15%)
  - Perda de sentido grave (detectado por IA)

WARN (atenção - pode ser aceitável):
  - Tradução significativamente menor (40%-65%)
  - Parágrafos muito reduzidos
  - Palavras em inglês mantidas (5%-15%)
  - Possível truncamento no final do texto
  - Repetição excessiva (>5%)
  - Problemas de pontuação/formação

INFO (informativo - apenas registro):
  - Capítulos extras na tradução
  - Nomes próprios alterados
  - Pequenas repetições detectadas
  - Variações menores de formato


--------------------------------------------------------------------------------
PADRÕES ESPECÍFICOS DO GOOGLE TRADUTOR
--------------------------------------------------------------------------------

O script detecta automaticamente problemas comuns em traduções do Google Tradutor:

- Problemas de gênero (ex: "o diferente" vs "a diferente")
- Frases quebradas (pontuação incorreta)
- Nomes próprios em minúsculas
- Espaços antes de pontuação
- Marcas como [Traduzido automaticamente]
- Palavras em inglês mantidas
- Cognatos falsos (gaze → gauze, bars → bares/ambiguo)


--------------------------------------------------------------------------------
FLUXO DE EXECUÇÃO
--------------------------------------------------------------------------------

1. Leitura dos arquivos
   └── Lê todos os DOCX da pasta source/ e translated/

2. Pareamento
   └── Alinha arquivos originais com suas traduções por ordem/nome

3. Extração de capítulos
   └── Divide cada documento em capítulos (reconhece Chapter X, Prologue, etc.)

4. Alinhamento estrutural
   └── Compara posição, títulos e tamanho para parear capítulos

5. Validações determinísticas
   ├── Estrutural: capítulos faltando, tamanho, parágrafos
   ├── Conteúdo: truncamento, inglês residual
   ├── Consistência: repetições, formatação, nomes
   └── Google Tradutor: padrões específicos

6. Revisão com IA (apenas suspeitos)
   └── Envia apenas capítulos com baixa confiança para o Ollama

7. Geração de relatórios
   └── Cria JSON, CSV e TXT com todos os resultados


--------------------------------------------------------------------------------
EXEMPLOS DE RESULTADOS
--------------------------------------------------------------------------------

Status OK (tudo certo):
  - Todos os capítulos do original estão presentes
  - Tamanhos compatíveis (entre 65% e 135%)
  - Sem inglês residual excessivo
  - IA confirmou qualidade da tradução

Status WARN (atenção recomendada):
  - Alguns capítulos ausentes ou extras
  - Tradução um pouco menor que o original
  - Pequenas repetições detectadas
  - IA apontou possíveis problemas menores

Status FAIL (revisão necessária):
  - Capítulos inteiros faltando
  - Tradução muito menor (<40% do original)
  - Inglês residual excessivo (>15%)
  - IA detectou perda grave de sentido


--------------------------------------------------------------------------------
COMO INTERPRETAR OS RELATÓRIOS
--------------------------------------------------------------------------------

1. Verifique o audit-summary.txt primeiro
   └── Mostra status consolidado e principais problemas

2. Analise os capítulos problemáticos
   └── Arquivo problematic-chapters-...txt lista detalhes

3. Para cada issue FAIL:
   └── Verificar manualmente a tradução do capítulo indicado

4. Para issues WARN:
   └── Decidir se aceita ou precisa de ajuste manual

5. Para issues INFO:
   └── Apenas registro - geralmente não requer ação


--------------------------------------------------------------------------------
COMANDOS ÚTEIS
--------------------------------------------------------------------------------

# Verificar dependências
cd /Users/alinesouza/Documents/TI/Projetos/Extrair_novel
npm list adm-zip cheerio docx

# Testar se dependências são encontradas
cd workflows/audit-translation-docx
node -e "import('adm-zip').then(() => console.log('OK'))"

# Verificar se Ollama está rodando
curl http://localhost:11434/api/tags

# Listar modelos disponíveis
ollama list


--------------------------------------------------------------------------------
DEPENDÊNCIAS (já instaladas na raiz do projeto)
--------------------------------------------------------------------------------

- adm-zip   → Leitura de arquivos DOCX (via ZIP interno)
- cheerio   → Parse do XML do DOCX
- docx      → Geração de DOCX (não usado diretamente no audit)

Nenhuma instalação adicional é necessária. O audit utiliza as dependências
já existentes no node_modules da raiz do projeto.


--------------------------------------------------------------------------------
SOLUÇÃO DE PROBLEMAS
--------------------------------------------------------------------------------

Problema: "could not connect to Ollama instance"
Solução: Execute 'ollama serve' em um terminal separado

Problema: Modelo qwen2.5:7b não encontrado
Solução: Execute 'ollama pull qwen2.5:7b'

Problema: Arquivos não são pareados corretamente
Solução: Verifique se os nomes dos arquivos seguem o padrão:
         NomeObra_cap_XX-YY.docx (ex: Eighteens_Bed_cap_01-06.docx)

Problema: Muitos falsos positivos
Solução: Ajuste os thresholds no arquivo src/config.js (aumente minSizeRatio,
         maxEnglishWordsRatio, etc.) para tornar mais tolerante


--------------------------------------------------------------------------------
CÓDIGOS DE SAÍDA
--------------------------------------------------------------------------------

Código 0 → Execução bem-sucedida, nenhum issue FAIL detectado
Código 1 → Pelo menos um issue FAIL foi detectado (revisão necessária)


================================================================================
FIM
================================================================================
```

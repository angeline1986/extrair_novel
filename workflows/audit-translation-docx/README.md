```txt
================================================================================
AUDITORIA DE TRADUÇÕES DOCX - WORKFLOW COMPLETO
================================================================================

Sistema para auditar e corrigir traduções automáticas (Google Tradutor) de
documentos DOCX, com versionamento incremental e preservação dos originais.


--------------------------------------------------------------------------------
PRINCÍPIOS FUNDAMENTAIS
--------------------------------------------------------------------------------

1. O arquivo original em input/translatedGoogle/ NUNCA é modificado
2. Todas as correções são salvas em input-fixed/v{N}/ (versões)
3. O arquivo final atual para leitura/exportação fica em output/
4. Arquivos intermediários são temporários e não ficam em output/


--------------------------------------------------------------------------------
ESTRUTURA DE PASTAS
--------------------------------------------------------------------------------

workflows/audit-translation-docx/
├── input/
│   ├── source/              # Arquivos originais (inglês) - NUNCA modificado
│   ├── translatedGoogle/    # Tradução do Google - NUNCA modificado (somente leitura)
│
├── input-fixed/             # Histórico de versões corrigidas
│   ├── manifest.json        # Controle local das versões (ignorado pelo Git)
│   ├── v1/                  # Primeira versão corrigida
│   ├── v2/                  # Segunda versão corrigida
│   └── v3/                  # Terceira versão corrigida
│
├── output/                  # Arquivo final atual para leitura/exportação
│   └── Nome_da_obra.docx
│
├── logs/                    # Relatórios de auditoria e correções
│   ├── audit-report-*.json
│   ├── audit-summary-*.txt
│   ├── issues-*.csv
│   └── correcoes_*.csv
│
├── src/                     # Código fonte (módulos)
│   ├── audit.js             # Auditoria principal
│   ├── entities/            # Glossário e consistência de nomes/personagens
│   ├── fix-gender/          # Correção de gênero
│   ├── menu/                # Menu interativo
│   ├── reportWriter/        # Geração de relatórios
│   ├── version/             # Versionamento incremental
│   └── checks/              # Validações específicas
│
├── .current-step            # Arquivo com o step atual (1, 2, 3...)
└── package.json             # Scripts npm


--------------------------------------------------------------------------------
O QUE CADA ARQUIVO GERADO REPRESENTA
--------------------------------------------------------------------------------

input-fixed/v1/, v2/, v3/...
  Histórico das versões corrigidas. Cada nova correção cria uma nova versão.
  A próxima execução continua da versão mais recente.

input-fixed/manifest.json
  Controle local do versionamento. Guarda versão atual, output final, origem e histórico.
  É ignorado pelo Git junto com o conteúdo de input-fixed/.

output/
  Arquivo final atual. É sobrescrito com a versão mais recente publicada.
  Para histórico, use input-fixed/v1/, v2/, v3/...

logs/
  Relatórios de auditoria, normalização, correções e eventos do workflow.


--------------------------------------------------------------------------------
COMANDOS PRINCIPAIS
--------------------------------------------------------------------------------

Comando                              | Descrição
-------------------------------------|-----------------------------------------
npm run audit:menu                   | Menu interativo (recomendado)
npm run audit:translation            | Auditoria normal
npm run audit:translation:verbose    | Auditoria com detalhes
npm run fix:gender                   | Corrige problemas de gênero (modo normal)
npm run fix:gender:verbose           | Corrige problemas de gênero (detalhado)


--------------------------------------------------------------------------------
GERENCIAMENTO DE VERSÕES
--------------------------------------------------------------------------------

Comando                              | Descrição
-------------------------------------|-----------------------------------------
npm run version:status               | Mostrar status das versões
npm run version:current              | Mostrar versão atual
npm run version:list                 | Listar todas as versões disponíveis
npm run version:next                 | Avançar para próxima versão
npm run version:prev                 | Voltar para versão anterior
npm run version:goto -- 3            | Ir para versão específica
npm run version:diff -- 1 2          | Comparar duas versões
npm run version:clean                | Limpar versões antigas (mantém 5)
npm run version:create               | Criar versão manual


--------------------------------------------------------------------------------
WORKFLOW COMPLETO (RECOMENDADO)
--------------------------------------------------------------------------------

O workflow completo (opção 5 no menu) executa:

1. Auditoria inicial da working source atual
2. Normalização de entidades + correção de problemas de gênero
   - publica input-fixed/v{N}/
   - atualiza output/ com o arquivo final atual
3. Re-auditoria automática da versão publicada
4. Exibição do relatório HTML final

IMPORTANTE: O arquivo original em input/translatedGoogle/ NUNCA é modificado!

Regra de evolução:
  1ª execução: input/translatedGoogle → input-fixed/v1 → output/
  2ª execução: input-fixed/v1         → input-fixed/v2 → output/
  3ª execução: input-fixed/v2         → input-fixed/v3 → output/

Para voltar manualmente ao original Google:
  npm run audit:translation -- --reset-working-copy


--------------------------------------------------------------------------------
CORREÇÕES AUTOMÁTICAS DE GÊNERO
--------------------------------------------------------------------------------

O corretor identifica e corrige:

| Problema                              | Exemplo              | Correção          |
|---------------------------------------|----------------------|-------------------|
| advérbio feminino com artigo masculino | "o diferente"        | "a diferente"     |
| substantivo masculino com artigo fem. | "a computador"       | "o computador"    |
| adjetivo feminino com artigo masculino| "o pequena"          | "a pequena"       |
| substantivo feminino com artigo masc. | "o mesa"             | "a mesa"          |
| "o mesma"                             | "o mesma"            | "a mesma"         |
| "a mesmo"                             | "a mesmo"            | "o mesmo"         |

ATENÇÃO: NÃO corrige pontuação, reticências ou aspas (preserva estilo original)


--------------------------------------------------------------------------------
CONSISTÊNCIA DE ENTIDADES
--------------------------------------------------------------------------------

O workflow usa input/source/ como referência canônica e src/entities/entityGlossary.json
como glossário editável de personagens protegidos.

Durante a auditoria:
- detecta aliases suspeitos na tradução PT;
- inclui entityConsistency no audit-report-*.json;
- adiciona seção "CONSISTÊNCIA DE ENTIDADES" no audit-summary-*.txt;
- gera logs/entity-consistency-*.json quando encontra aliases.

Durante a correção:
- normaliza aliases antes do fix-gender em arquivo temporário interno;
- roda o fix-gender somente sobre a cópia temporária já normalizada;
- versiona o resultado em input-fixed/v{N}/;
- atualiza o arquivo final atual em output/;
- nunca altera input/source/ nem input/translatedGoogle/ diretamente;
- registra substituições em logs/entity-normalization-*.json.


--------------------------------------------------------------------------------
RELATÓRIOS GERADOS
--------------------------------------------------------------------------------

Arquivo                              | Conteúdo
-------------------------------------|-----------------------------------------
logs/audit-report-*.json             | Relatório completo em JSON
logs/audit-summary-*.txt             | Resumo legível com preview dos parágrafos
logs/entity-consistency-*.json       | Aliases e inconsistências de nomes detectadas
logs/entity-normalization-*.json     | Substituições de nomes aplicadas na correção
logs/issues-*.csv                    | Issues e warnings em CSV
logs/correcoes_*.csv                 | Antes/depois das correções de gênero
logs/problematic-chapters-*.txt      | Detalhes de capítulos problemáticos


--------------------------------------------------------------------------------
MENU INTERATIVO
--------------------------------------------------------------------------------

Ao executar npm run audit:menu, as opções disponíveis são:

  ┌───────────── FLUXO PRINCIPAL ─────────────┐
  1. 🚀 Gerar versão revisada da tradução
     Audita + normaliza entidades + corrige gênero + reaudita

  ┌───────────── AUDITORIA ─────────────┐
  2. 🔍 Auditar versão atual
  3. 🔍📋 Auditar versão atual com detalhes

  ┌───────────── CORREÇÃO ──────────────┐
  4. 🔧 Normalizar entidades + corrigir gênero
  5. 🔧📋 Normalizar entidades + corrigir gênero com detalhes

  ┌───────────── RELATÓRIOS ────────────┐
  6. 📊 Ver último relatório
  7. 🗑️  Limpar relatórios antigos

  ┌───────────── VERSÕES ───────────────┐
  8. 📂 Ver status das versões
  9. 🔄 Restaurar versão específica

  ┌───────────── SISTEMA ───────────────┐
  10. ❌ Sair


--------------------------------------------------------------------------------
EXEMPLO PRÁTICO
--------------------------------------------------------------------------------

1. Colocar tradução original em input/translatedGoogle/
2. Executar npm run audit:menu
3. Escolher opção 1 (gerar versão revisada da tradução)
4. Aguardar auditoria e correção
5. Versão corrigida salva em input-fixed/v1/
6. Arquivo final atual disponível em output/
7. Na próxima execução, o workflow usa input-fixed/v1/ como origem
8. Repetir até resultado desejado: v1 → v2 → v3...


--------------------------------------------------------------------------------
SOLUÇÃO DE PROBLEMAS
--------------------------------------------------------------------------------

Problema                                    | Solução
--------------------------------------------|-----------------------------------------
Arquivo original sendo modificado           | Verificar se workflow.js está atualizado
Versões idênticas (sem diferenças)          | Arquivo já está corrigido; usar backup antigo
"Module not found: versionManager.js"       | Criar arquivo de compatibilidade
Ollama não conecta                          | Executar 'ollama serve' em outro terminal
CSV de correções não gerado                 | Nenhuma correção necessária no arquivo


--------------------------------------------------------------------------------
DEPENDÊNCIAS
--------------------------------------------------------------------------------

Todas as dependências estão centralizadas na raiz do projeto:

- adm-zip      → Leitura de DOCX (via ZIP interno)
- cheerio      → Parse do XML do DOCX
- docx         → Geração de DOCX
- (Ollama)     → IA para revisão (opcional)

Nenhuma instalação adicional é necessária na pasta do workflow.


--------------------------------------------------------------------------------
CÓDIGOS DE SAÍDA
--------------------------------------------------------------------------------

Código | Significado
-------|-----------------------------------------
0      | Execução bem-sucedida (ou WARN apenas)
1      | Issue(s) FAIL detectada(s) - revisão necessária


================================================================================
FIM
================================================================================
```

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
3. A última versão corrigida fica em input-fixed/current/
4. Arquivos intermediários ficam em output/ e podem ser usados para auditoria/debug


--------------------------------------------------------------------------------
ESTRUTURA DE PASTAS
--------------------------------------------------------------------------------

workflows/audit-translation-docx/
├── input/
│   ├── source/              # Arquivos originais (inglês) - NUNCA modificado
│   ├── translatedGoogle/    # Tradução do Google - NUNCA modificado (somente leitura)
│
├── input-fixed/             # VERSÕES CORRIGIDAS (resultado final)
│   ├── current/             # Última versão corrigida oficial
│   ├── manifest.json        # Controle local das versões (ignorado pelo Git)
│   ├── v1/                  # Primeira versão corrigida
│   ├── v2/                  # Segunda versão corrigida
│   └── v3/                  # Terceira versão corrigida
│
├── output/
│   ├── normalized/          # Cópias temporárias com nomes/personagens normalizados
│   │   └── step1_18-05-2026_12-21-14/
│   └── fixed/               # Resultado bruto da correção antes de versionar
│       └── step1_18-05-2026_12-21-14/
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

input-fixed/current/
  Última versão corrigida oficial. A próxima execução continua daqui.

input-fixed/v1/, v2/, v3/...
  Histórico das versões corrigidas. Cada execução cria uma nova versão.

input-fixed/manifest.json
  Controle local do versionamento. Guarda versão atual, origem e histórico.
  É ignorado pelo Git junto com o conteúdo de input-fixed/.

output/normalized/step{N}_*/
  Cópia intermediária criada antes do fix-gender.
  Aqui aliases de nomes/personagens já foram normalizados.

output/fixed/step{N}_*/
  Resultado bruto da correção daquele step.
  A partir dele o sistema publica input-fixed/v{N}/ e input-fixed/current/.

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
npm run version:current              | Mostrar step atual
npm run version:list                 | Listar todas as versões disponíveis
npm run version:next                 | Avançar para próximo step
npm run version:prev                 | Voltar para step anterior
npm run version:goto -- 3            | Ir para step específico
npm run version:diff -- 1 2          | Comparar duas versões
npm run version:clean                | Limpar versões antigas (mantém 5)
npm run version:create               | Criar versão manual


--------------------------------------------------------------------------------
WORKFLOW COMPLETO (RECOMENDADO)
--------------------------------------------------------------------------------

O workflow completo (opção 5 no menu) executa:

1. Auditoria da working source atual
2. Normalização de entidades em output/normalized/step{N}_*/
3. Correção de problemas de gênero em output/fixed/step{N}_*/
4. Publicação da versão em input-fixed/v{N}/
5. Atualização de input-fixed/current/
6. Re-auditoria da versão atual, se solicitado

IMPORTANTE: O arquivo original em input/translatedGoogle/ NUNCA é modificado!

Regra de evolução:
  1ª execução: input/translatedGoogle → input-fixed/v1 → input-fixed/current
  2ª execução: input-fixed/current    → input-fixed/v2 → input-fixed/current
  3ª execução: input-fixed/current    → input-fixed/v3 → input-fixed/current

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
- normaliza aliases antes do fix-gender em output/normalized/step{N}_*/;
- roda o fix-gender somente sobre a cópia já normalizada;
- salva a cópia final em output/fixed/step{N}_*/;
- versiona o resultado em input-fixed/v{N}/;
- atualiza a última versão oficial em input-fixed/current/;
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

  ┌───────────── AUDITORIA ─────────────┐
  1. 🔍 Auditoria normal
  2. 🔍📋 Auditoria com detalhes (verbose)

  ┌───────────── CORREÇÃO ──────────────┐
  3. 🔧 Corrigir problemas de gênero
  4. 🔧📋 Corrigir problemas de gênero (verbose)

  ┌───────────── WORKFLOW ──────────────┐
  5. 🚀 Workflow completo

  ┌───────────── VERSIONAMENTO ─────────┐
  6. 📊 Ver último relatório
  7. 🗑️  Limpar relatórios antigos
  8. 📂 Gerenciar versões (status)
  9. ➡️  Avançar para próximo step
  10. ⬅️ Voltar para step anterior
  11. 🔄 Restaurar versão específica

  ┌───────────── SISTEMA ───────────────┐
  12. ❌ Sair


--------------------------------------------------------------------------------
EXEMPLO PRÁTICO
--------------------------------------------------------------------------------

1. Colocar tradução original em input/translatedGoogle/
2. Executar npm run audit:menu
3. Escolher opção 5 (workflow completo)
4. Aguardar auditoria e correção
5. Versão corrigida salva em input-fixed/v1/
6. Última versão corrigida disponível em input-fixed/current/
7. Na próxima execução, o workflow usa input-fixed/current/ como origem
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

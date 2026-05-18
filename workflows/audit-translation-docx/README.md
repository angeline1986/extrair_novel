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
3. Backups são mantidos em output/fixed/step{N}_*/
4. O usuário decide quando restaurar uma versão corrigida


--------------------------------------------------------------------------------
ESTRUTURA DE PASTAS
--------------------------------------------------------------------------------

workflows/audit-translation-docx/
├── input/
│   ├── source/              # Arquivos originais (inglês) - NUNCA modificado
│   ├── translatedGoogle/    # Tradução do Google - NUNCA modificado (somente leitura)
│   ├── backup/              # Backups automáticos de versões
│   └── translated-fixed/    # Última versão corrigida (opcional)
│
├── input-fixed/             # VERSÕES CORRIGIDAS (resultado final)
│   ├── v1/                  # Step 1 - primeira correção
│   ├── v2/                  # Step 2 - segunda correção
│   ├── v3/                  # Step 3 - terceira correção
│   └── current/             # Link para a última versão
│
├── output/
│   └── fixed/               # Backups brutos (timestamp + step)
│       ├── step1_2026-05-18_10-30-00/
│       ├── step2_2026-05-18_10-35-00/
│       └── step3_2026-05-18_10-40-00/
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

1. Auditoria do original (input/translatedGoogle/)
2. Correção de problemas de gênero
3. Organização das versões em input-fixed/v{N}/
4. Backups em output/fixed/step{N}_*/

IMPORTANTE: O arquivo original em input/translatedGoogle/ NUNCA é modificado!

Para auditar uma versão corrigida:
  npm run version:goto -- 1      (restaura v1 para input/translatedGoogle/)
  npm run audit:translation      (audita a versão restaurada)


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
6. Para auditar a correção:
   npm run version:goto -- 1
   npm run audit:translation
7. Se satisfeito, avançar: npm run version:next
8. Repetir até resultado desejado


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

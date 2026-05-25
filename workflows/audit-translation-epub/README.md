# Auditoria de Traducao EPUB

Compara um `.epub` original em ingles com a versao traduzida em portugues e usa um `.txt` de log da traducao como insumo adicional da auditoria.

## Estrutura

```txt
workflows/audit-translation-epub/
├── input/source/       # EPUB original em ingles
├── input/translated/   # EPUB traduzido para portugues
├── input/logs/         # TXT com log/observacoes da traducao
├── input-fixed/        # Versoes corrigidas v1, v2, v3...
├── output/             # EPUB final revisado mais recente
├── logs/               # Relatorios gerados
└── src/audit.js        # Auditor principal
```

## Uso simples

Coloque um EPUB em `input/source/`, um EPUB em `input/translated/` e um TXT em `input/logs/`.

```bash
npm run audit:translation:epub
```

Esse comando abre o menu. Para executar a auditoria diretamente, sem menu:

```bash
npm run audit:translation:epub:run
```

Para gerar uma versao revisada diretamente, sem menu:

```bash
npm run fix:translation:epub
```

Para validar a fila de revisao manual antes de aplicar itens aprovados:

```bash
npm run review:translation:epub:validate
```

O fluxo principal do menu executa:

```txt
1. auditoria da traducao atual
2. geracao de input-fixed/vN/*.epub com correcoes seguras
3. publicacao em output/
4. reauditoria do EPUB publicado
```

As correcoes automaticas sao conservadoras: o script edita apenas nos de texto dos XHTMLs e so aplica trocas declaradas no bloco inicial do log, como `Master -> Mestre`.

Tambem e possivel passar caminhos explicitos:

```bash
npm run audit:translation:epub -- --source=livro-en.epub --translated=livro-pt.epub --log=log-traducao.txt
```

## Formato recomendado do TXT

O log aceita texto livre, mas aproveita melhor linhas estruturadas. Exemplo para *Show Me Your Stats*:

```txt
Termos: Ayra, Janus, Solar, mana, Mestre, GM
Nomes: Solar Xing Ayra, Janus, Attera
Problema: revisar concordancia de genero em dialogos com Janus
Master -> Mestre
lord -> lorde
stats -> estatisticas
```

Copie o template em `templates/Log_Traducao.example.txt` para `input/logs/Log_Traducao.txt` e adapte os termos da obra atual.

O auditor usa esse arquivo para:

- verificar termos importantes citados no log;
- conferir trocas `forma antiga -> forma recomendada`;
- registrar avisos e pendencias no relatorio;
- enriquecer o JSON final com os insumos da traducao.

## Saidas

```txt
logs/workflow-events.jsonl
logs/json/audit-report-*.json
logs/json/correction-plan.json
logs/json/review-queue.json
logs/json/assisted-review-suggestions.json
logs/json/correction-report.json
logs/json/post-correction-validation.json
logs/json/reaudit-report.json
logs/json/reauditoria-summary.json
logs/txt/epub-audit-summary-latest.txt
logs/txt/correction-report-latest.md
logs/txt/review-queue-latest.md
logs/txt/assisted-review-suggestions-latest.md
logs/html/audit-dashboard-latest.html
logs/html/validation-report-latest.html
input-fixed/manifest.json
```

Os relatorios HTML exibem uma secao de correcoes com:

- correcoes aplicadas em XHTML, com before/after, arquivo, nodeId e confianca;
- acoes ignoradas por `auto_review` ou `manual_only`;
- validacao tecnica pos-correcao;
- comparativo da reauditoria antes/depois;
- status final `improvement`, `regression`, `neutral` ou `unknown`.

O arquivo `logs/json/review-queue.json` registra acoes `auto_review` e `manual_only` que ainda nao devem ser aplicadas automaticamente. Cada item nasce como `pending` e pode ser preparado futuramente para `approved`, `rejected` ou `needs_context`, sem alterar o EPUB nesta milestone.

Quando um item da review queue for marcado manualmente como `approved`, ele so sera aplicado pelo `fixEpub` se tambem tiver `before` e `after` preenchidos e uma localizacao XHTML valida. Itens `pending`, `rejected` e `needs_context` continuam registrados, mas nao sao aplicados.

O arquivo `logs/json/assisted-review-suggestions.json` traz sugestoes assistidas para itens `pending` + `auto_review`. Todas as sugestoes possuem `requiresHumanApproval: true` e nao sao aplicadas automaticamente. Cada sugestao e classificada como `suggestion_available`, `needs_human_translation` ou `insufficient_context`; `suggestedAfter` so e preenchido quando houver heuristica segura ou `before/after` explicito na review queue.

Os itens de review e as sugestoes assistidas incluem contexto expandido limitado: `previousParagraph`, `currentParagraph`, `nextParagraph` e, quando houver pareamento simples disponivel, `originalAlignedText`. Esses campos sao previews curtos para apoiar revisao humana sem inflar os relatorios.

O fluxo manual completo esta documentado em `REVIEW_QUEUE_WORKFLOW.md`, incluindo exemplos de item `approved` e `rejected`.

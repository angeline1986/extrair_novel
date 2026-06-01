# Auditoria de Traducao EPUB

Compara um `.epub` original em ingles com a versao traduzida em portugues e usa um `.txt` de log da traducao como insumo adicional da auditoria.

## Estrutura

```txt
workflows/audit-translation-epub/
├── input/source/epub/  # EPUB original
├── input/source/pdf/   # PDF original, quando existir
├── input/translated/   # EPUB traduzido para portugues
├── input/translation-log/         # TXT com log/observacoes da traducao
├── input-fixed/        # Versoes corrigidas v1, v2, v3...
├── output/             # EPUB final revisado mais recente
├── logs/               # Relatorios gerados
└── src/audit.js        # Auditor principal
```

## Uso simples

Coloque o EPUB original em `input/source/epub/`, PDFs originais em `input/source/pdf/` quando existirem, um EPUB traduzido em `input/translated/` e um TXT em `input/translation-log/`.

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

Para validar os contratos internos do pipeline EPUB com fixtures pequenas:

```bash
npm run validate:translation:epub
```

Para gerar a comparacao editorial entre o PDF original e o EPUB traduzido/validado:

```bash
npm run audit:translation:epub:pdf-report
```

O fluxo principal do menu executa:

```txt
1. auditoria da traducao atual
2. geracao de input-fixed/vN/*.epub com correcoes seguras
3. publicacao em output/
4. reauditoria do EPUB publicado
5. geracao do relatorio PDF x EPUB, quando houver PDF disponivel
```

As correcoes automaticas sao conservadoras: o script edita apenas nos de texto dos XHTMLs e so aplica trocas declaradas no bloco inicial do log, como `Master -> Mestre`.

Tambem e possivel passar caminhos explicitos:

```bash
npm run audit:translation:epub -- --source=livro-en.epub --translated=livro-pt.epub --log=log-traducao.txt
```

Quando `--source` nao e informado, a auditoria procura automaticamente o primeiro `.epub` em `input/source/epub/`.

Para auditoria de espanhol para portugues, use o parametro `--source-language`:

```bash
npm run audit:translation:epub -- --source-language=es
```

Idiomas suportados:
- `en` (ingles) - default
- `es` (espanhol)

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

Copie o template em `templates/Log_Traducao.example.txt` para `input/translation-log/Log_Traducao.txt` e adapte os termos da obra atual.

O auditor usa esse arquivo para:

- verificar termos importantes citados no log;
- conferir trocas `forma antiga -> forma recomendada`;
- registrar avisos e pendencias no relatorio;
- enriquecer o JSON final com os insumos da traducao.

## Saidas

A saida HTML principal para leitura e decisao editorial e:

```txt
reports/html/reader-report-latest.html
```

Os demais arquivos sao artefatos internos ou tecnicos do pipeline. Eles preservam estado, historico e rastreabilidade, mas nao devem ser tratados como relatorios principais para o usuario final.

```txt
logs/workflow-events.jsonl
reports/json/audit-report-*.json
state/correction-plan.json
state/semantic-candidates.json
state/editorial-findings.json
state/review-queue.json
state/assisted-review-suggestions.json
logs/assisted-review-model-trace.json
state/correction-report.json
state/post-correction-validation.json
state/reaudit-report.json
state/reauditoria-summary.json
reports/txt/epub-audit-summary-latest.txt
reports/txt/correction-report-latest.md
reports/txt/review-queue-latest.md
reports/txt/assisted-review-suggestions-latest.md
reports/html/reader-report-latest.html
input-fixed/manifest.json
```

Por padrao, o workflow gera apenas `reports/html/reader-report-latest.html` como HTML de decisao. Dashboards tecnicos antigos podem existir de execucoes anteriores ou ser gerados manualmente para depuracao, mas ficam fora da saida recomendada.

O relatorio principal exibe:

- veredito geral;
- saude editorial;
- achados editoriais informativos;
- achados confirmados e heuristicos;
- pendencias humanas;
- sugestoes assistidas, quando existirem.

## Relatorio PDF x EPUB

O relatorio PDF x EPUB compara o PDF original em espanhol com o EPUB traduzido/validado em portugues. Ele e uma auditoria editorial complementar ao relatorio principal.

Coloque o PDF original em:

```txt
input/source/pdf/
```

O EPUB alvo e escolhido automaticamente nesta ordem:

```txt
1. output/*.epub
2. input-fixed/vN/*.epub, conforme input-fixed/manifest.json
3. input/translated/*.epub
```

Para gerar o relatorio diretamente:

```bash
npm run audit:translation:epub:pdf-report
```

Pelo menu, use:

```txt
2. Gerar relatorio PDF x EPUB
3. Exportar lista completa de achados
5. Revisar sugestoes
   2. Validar achados PDF x EPUB
   3. Aplicar achados PDF x EPUB aprovados
```

Saidas geradas:

```txt
reports/html/pdf-epub-comparison-latest.html
reports/txt/pdf-epub-comparison-full.txt
state/pdf-epub-comparison.json
state/pdf-epub-review-queue.json
```

Diferença entre os relatorios HTML:

- `reports/html/reader-report-latest.html`: relatorio principal da auditoria EPUB, com saude editorial, achados da traducao, fila de revisao e resultado do fluxo principal.
- `reports/html/pdf-epub-comparison-latest.html`: relatorio complementar que compara o PDF original com o EPUB traduzido/validado, destacando omissoes, divergencias de titulo, espanhol residual, inconsistencias terminologicas e drift de sentido.

O relatorio PDF x EPUB organiza achados em abas editoriais maiores. O campo `Tipo` dentro de cada tabela indica o subtipo especifico do problema:

- `Cobertura`: omissoes, nomes/numeros ausentes e diferencas estruturais.
- `Sentido`: drift semantico, literalidade e verbos ambiguos herdados de traducao intermediaria EN/ES.
- `Idioma residual`: frases, termos ou titulos que permaneceram em espanhol/ingles.
- `Personagens`: genero, pronomes, nomes canonicos, romanizacao e tratamento.
- `Terminologia`: glossario, termos perigosos e escolhas terminologicas inconsistentes.
- `Titulos`: titulos divergentes, literais, duplicados ou com idioma residual.
- `Editorial`: achados heurísticos que nao se encaixam nas demais abas.

O HTML PDF x EPUB pode exibir apenas os achados mais prioritarios por aba. Quando houver mais achados do que o limite exibido, o proprio relatorio informa quantos foram encontrados e aponta para a lista completa:

```txt
reports/txt/pdf-epub-comparison-full.txt
```

O JSON completo fica em:

```txt
state/pdf-epub-comparison.json
```

Importante: gerar `pdf-epub-comparison-latest.html` **nao aplica correcoes automaticamente**. Para corrigir o EPUB, valide primeiro os achados em `Revisar sugestoes > Validar achados PDF x EPUB`; depois use `Aplicar achados PDF x EPUB aprovados`. Somente achados aprovados e com substituicao clara geram uma nova versao do EPUB.

O arquivo `state/review-queue.json` registra acoes `auto_review` e `manual_only` que ainda nao devem ser aplicadas automaticamente. Cada item nasce como `pending` e pode ser preparado futuramente para `approved`, `rejected` ou `needs_context`, sem alterar o EPUB nesta milestone.

Quando um item da review queue for marcado manualmente como `approved`, ele so sera aplicado pelo `fixEpub` se tambem tiver `before` e `after` preenchidos e uma localizacao XHTML valida. Itens `pending`, `rejected` e `needs_context` continuam registrados, mas nao sao aplicados.

O arquivo `state/assisted-review-suggestions.json` traz sugestoes assistidas para itens `pending` + `auto_review`. Todas as sugestoes possuem `requiresHumanApproval: true` e nao sao aplicadas automaticamente. Cada sugestao e classificada como `suggestion_available`, `needs_human_translation` ou `insufficient_context`; `suggestedAfter` so e preenchido quando houver heuristica segura ou `before/after` explicito na review queue.

Os itens de review e as sugestoes assistidas incluem contexto expandido limitado: `previousParagraph`, `currentParagraph`, `nextParagraph` e, quando houver alinhamento confiavel por numero/titulo de capitulo, `originalAlignedText`. O alinhamento registra `alignmentConfidence` e `alignmentReason`; fallback por indice e tratado como baixa confianca e nao preenche `originalAlignedText`.

As sugestoes assistidas podem usar `originalAlignedText` confiavel para propor `suggestedAfter` apenas em heuristicas locais e conservadoras, como descompasso simples de pronome com sobreposicao textual suficiente entre original e traducao. Mesmo nesses casos, `requiresHumanApproval` permanece `true`.

Dentro de capitulos alinhados, o workflow tenta alinhar o paragrafo original por nomes proprios, numeros, perfil de pontuacao e comprimento relativo. O texto original so e exposto quando `paragraphAlignmentConfidence` e seguro; casos ambiguos mantem `originalAlignedText` vazio.

Opcionalmente, as sugestoes assistidas podem chamar um modelo local Ollama. O adapter fica desativado por padrao e o fluxo usa fallback deterministico quando o modelo nao estiver habilitado ou falhar. Para habilitar:

```bash
EPUB_AUDIT_OLLAMA=1 OLLAMA_MODEL=qwen2.5:7b npm run audit:translation:epub:run
```

Variaveis aceitas: `EPUB_AUDIT_OLLAMA`, `OLLAMA_HOST`, `OLLAMA_MODEL`, `OLLAMA_ENDPOINT` e `OLLAMA_TIMEOUT_MS`. O modelo recebe apenas itens `pending` + `auto_review` e contexto limitado (`originalAlignedText`, paragrafo anterior/atual/posterior e preview). Todas as respostas do modelo sao gravadas em `logs/assisted-review-model-trace.json`, passam por validacao conservadora e continuam com `requiresHumanApproval: true`; nenhuma sugestao e aplicada automaticamente.

O contrato de saida do modelo aceita dois modos. Em `full_paragraph`, `suggestedAfter` deve conter o paragrafo completo corrigido. Em `localized_patch`, o modelo deve preencher `targetBefore` com um trecho existente exatamente no paragrafo atual e `replacementAfter` com a substituicao localizada. Patches localizados sao rejeitados se `targetBefore` nao for encontrado literalmente no paragrafo atual.

A validacao do modelo e conservadora por design. O trace registra detalhes de rejeicao, incluindo tokens protegidos ausentes, numeros alterados, `targetBefore` esperado, preview do paragrafo atual, modo de match e ratios calculados. O workflow aceita equivalencia segura entre aspas retas e tipograficas para localizar patches, mas rejeita alvos truncados com reticencias, mudancas numericas, insercao de marcadores/termos ingleses inseguros e sugestoes semanticas justificadas apenas por estilo/fluencia.

A auditoria semantica gera `state/semantic-candidates.json` como uma camada separada de revisao. Esses candidatos procuram sinais de mudanca de sentido, omissao relevante, repeticao anormal, literalidade, inconsistencia terminologica, tratamento inconsistente e drift semantico usando alinhamento, contexto expandido, glossario e entidades. Eles nao entram automaticamente no `correction-plan.json`, nao alteram EPUB e sempre exigem revisao humana.

Os `semanticCandidates` mais relevantes podem ser copiados para `state/review-queue.json` com `origin: semantic_audit`, sempre como `status: pending` e `mode: auto_review`. Eles nunca viram `auto_safe` e qualquer sugestao assistida gerada para esses itens continua com `requiresHumanApproval: true`.

## Achados Editoriais Informativos

A auditoria gera `state/editorial-findings.json` com problemas editoriais detectados na traducao, separados em duas categorias:

- **Confirmados**: problemas objetivamente comprovados (titulos duplicados, resquicios do idioma original, inconsistencia de nomes)
- **Heuristicos**: suspeitas editoriais que exigem validacao humana (traducao literal, problemas de estilo, localizacao pouco natural)

Esses achados sao puramente informativos e **nao sao aplicados como correcao automatica**. Eles nao entram na review queue e nao alteram o EPUB.

O relatorio `reports/html/reader-report-latest.html` exibe uma nova secao "Achados editoriais informativos" com:

- Metrica de "Saúde editorial" (0-10) no topo do relatorio
- Separacao entre achados Confirmados e Heuristicos
- Detalhes por categoria com exemplos
- Aviso claro de que itens heurísticos exigem validacao humana

Categorias detectadas:

1. **Títulos duplicados origem/tradução** (confirmed, high): Capítulos que mantêm o título original junto do título traduzido
2. **Resquícios do idioma original** (confirmed, high): Termos/frases em espanhol que permaneceram no EPUB traduzido
3. **Possível divergência de tradução em títulos** (heuristic, high, medium): Títulos onde a tradução parece não corresponder ao significado do original
4. **Inconsistência de nomes e romanização** (confirmed, medium): Variantes diferentes do mesmo nome ao longo do texto
5. **Tradução excessivamente literal** (heuristic, medium): Estruturas pouco naturais em português
6. **Pequenos problemas de estilo** (heuristic, low): Pontuação estranha, aspas mal formatadas, espaços duplicados
7. **Localização pouco natural** (heuristic, low): Trechos que parecem pouco naturais em português

## Checklist De Validacao

Use este checklist antes de concluir mudancas no workflow EPUB:

```bash
npm run validate:translation:epub
npm run review:translation:epub:validate
npm run audit:translation:epub:run
npm run fix:translation:epub
```

O comando `validate:translation:epub` cobre os contratos principais de `correctionTypes`, `correctionPlanner`, `xhtmlMapper`, `xhtmlCorrectionEngine`, `postCorrectionValidator`, `reviewQueueValidator` e `chapterAligner` usando EPUBs pequenos gerados temporariamente.

O fluxo manual completo esta documentado em `REVIEW_QUEUE_WORKFLOW.md`, incluindo exemplos de item `approved` e `rejected`.

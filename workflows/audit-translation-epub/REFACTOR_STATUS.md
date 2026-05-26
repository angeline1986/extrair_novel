# Status Do Refactor - audit-translation-epub

Atualizado em: 2026-05-25T01:08:39Z

## Fase Atual

Fase 6 - Reauditoria automatica implementada.

O workflow EPUB agora possui contrato de correcao, mapeamento XHTML, motor inicial para aplicar `auto_safe`, glossarios locais por obra, validacao automatica pos-correcao e reauditoria automatica da versao corrigida. Apos gerar o EPUB corrigido, o fluxo valida o pacote, reextrai texto, confirma correcoes, roda nova auditoria e compara antes/depois.

## Funcionalidades Concluidas

- Leitura de EPUB original e traduzido.
- Extracao textual de secoes e paragrafos.
- Leitura de `Log_Traducao.txt`.
- Auditoria estrutural basica.
- Auditoria linguistica simples.
- Deteccao de residuos em ingles.
- Geracao de relatorio JSON.
- Geracao de dashboard HTML.
- Geracao de relatorio de validacao HTML.
- Geracao de resumo TXT.
- Menu interativo.
- Estrutura de logs em subpastas:
  - `logs/json`
  - `logs/html`
  - `logs/txt`
- Aplicacao conservadora de replacements definidos no log.
- Reempacotamento EPUB com cuidado para `mimetype`.
- Versionamento basico em `input-fixed/vN`.
- `input-fixed/manifest.json`.
- `workflow-events.jsonl`.
- Documentacao inicial do refactor.
- Schema inicial de `correctionCandidates`.
- `src/correction/correctionTypes.js`.
- `src/correction/correctionPlanner.js`.
- Emissao de `correctionCandidates` no `audit-report`.
- Geracao de `logs/json/correction-plan.json`.
- Registro de `correctionCandidates` e caminho do plano em `workflow-events.jsonl`.
- `src/xhtmlMapper.js`.
- Mapeamento de spine/ordem de leitura.
- Mapeamento de arquivo XHTML, blocos/paragrafos e nos de texto.
- IDs estaveis para nos textuais.
- Enriquecimento de candidates e actions com `filePath`, `spineIndex`, `paragraphIndex`, `textNodeIndex` e `textPreview`.
- `src/correction/xhtmlCorrectionEngine.js`.
- Aplicacao exclusiva de actions `auto_safe` com confianca minima de 0.9.
- Edicao restrita a nos de texto XHTML mapeados.
- Geracao de `logs/json/correction-report.json`.
- Registro de `before`, `after`, `filePath`, `nodeId` e tipo de correcao para cada aplicacao.
- Garantia inicial de que `auto_review` e `manual_only` nao sao aplicadas.
- `input/glossary/terms.json`.
- `input/glossary/entities.json`.
- `src/correction/terminologyNormalizer.js`.
- `src/correction/entityNormalizer.js`.
- Geracao de actions `auto_safe` a partir de correspondencia exata com glossario seguro.
- Geracao de `auto_review` para entradas de glossario ambiguas.
- Aplicacao validada de normalizacao terminologica real em XHTML.
- `src/correction/postCorrectionValidator.js`.
- Validacao basica de ZIP/EPUB.
- Validacao de `mimetype`, `META-INF/container.xml`, OPF, manifest e spine.
- Reextracao de texto da versao corrigida.
- Comparacao textual entre traducao de entrada e EPUB corrigido.
- Confirmacao de correcoes aplicadas no texto final.
- Geracao de `logs/json/post-correction-validation.json`.
- Reauditoria automatica usando o EPUB corrigido como `translated`.
- Geracao de `logs/json/reaudit-report.json`.
- Geracao de `logs/json/reauditoria-summary.json`.
- Classificacao do resultado como `improvement`, `regression`, `neutral` ou `unknown`.

## Funcionalidades Em Andamento

- Alinhamento conceitual com `audit-translation-docx`.
- Separacao entre inteligencia compartilhavel e adaptadores EPUB/XHTML.
- Preparacao da proxima fase: relatorio visual consolidando correction report, validacao e reauditoria.

## Pendencias

- Refatorar `fixEpub.js` para aplicar plano de correcao.
- Criar `entityNormalizer.js`.
- Criar `genderAgreementFixer.js`.
- Criar `residualEnglishFixer.js`.
- Criar `epubValidator.js`.
- Criar `xhtmlMapper.js`.
- Criar relatorio de correcoes aplicadas/ignoradas.
- Criar `input/glossary/entities.json`.
- Criar `input/glossary/terms.json`.
- Avaliar extracao de componentes compartilhados para `workflows/shared`.

## Bloqueios

Nenhum bloqueio tecnico confirmado neste momento.

Possiveis bloqueios futuros:

- ausencia de glossario confiavel por obra;
- falsos positivos de entidades;
- dificuldade em corrigir genero sem contexto suficiente;
- necessidade de modelo local/API para correcao contextual;
- risco de quebrar XHTML em correcoes mais profundas.

## Ultimas Decisoes Arquiteturais

- O EPUB deve manter logs organizados em subpastas:
  - `logs/json`
  - `logs/html`
  - `logs/txt`
- `workflow-events.jsonl` permanece na raiz de `logs`.
- O JSON de auditoria deve manter apenas o relatorio mais recente em `logs/json`.
- O pipeline EPUB nao deve herdar regras DOCX especificas de obra.
- Inteligencia compartilhavel deve futuramente ir para `workflows/shared`.
- Correcoes devem ser dirigidas por `correctionPlan`, nao por heuristicas soltas dentro de `fixEpub.js`.
- `fixEpub.js` deve virar orquestrador de correcao, versionamento, validacao e reauditoria.
- Toda correcao automatica deve registrar origem, confianca, antes/depois e status.
- Nesta fase, `correctionPlan` e apenas planejamento: nenhuma acao e aplicada automaticamente.
- Acoes `auto_safe` entram no plano com status `pending`.
- Acoes `auto_review` entram com status `needs_review`.
- Acoes `manual_only` entram com status `manual_only`.
- `xhtmlMapper.js` e somente leitura; nao altera o EPUB.
- Localizacoes de candidates podem conter varias ocorrencias em `locations`, com uma ocorrencia primaria em `target`.
- `xhtmlCorrectionEngine.js` aplica apenas actions `auto_safe`; nao executa revisao contextual.
- `correction-report.json` e a fonte de verdade das correcoes efetivamente aplicadas.
- Glossarios ficam escopados ao workflow/obra em `input/glossary`.
- `entities.json` aplica apenas aliases declarados como seguros; aliases ambiguos viram `auto_review`.
- `post-correction-validation.json` valida tecnica EPUB e confirmacao textual, mas ainda nao substitui a reauditoria completa.
- `reauditoria-summary.json` e a fonte de verdade do comparativo antes/depois.

## Proximos Passos Recomendados

1. Atualizar relatorios HTML para exibir correction report, post-correction validation e reauditoria.
2. Criar relatorio comparativo visual antes/depois.
3. Expandir glossarios por obra com termos e aliases validados.
4. Iniciar tratamento de candidates `auto_review` sem aplicar automaticamente.

## Riscos Conhecidos

- Corrigir XHTML como string pode quebrar markup.
- Aplicar aliases sem glossario por obra pode criar falsos positivos.
- Corrigir genero por regex pura pode gerar regressao.
- Revisor assistido pode sugerir texto incorreto se nao houver validacao.
- Reempacotamento pode alterar EPUB sem melhorar texto.
- Relatorios podem indicar melhoria estrutural sem melhoria linguistica.

## Observacoes Para Continuidade

- Antes de continuar, ler `EPUB_REFACTOR_PLAN.md`.
- Conferir `refactor-state.json` para status legivel por maquina.
- Nao misturar regras herdadas do DOCX sem escopo da obra.
- Priorizar correcoes seguras e rastreaveis.
- Nao implementar reescrita ampla antes de haver mapeamento XHTML robusto.
- Manter os documentos de refactor atualizados apos cada etapa relevante.

## Processo De Atualizacao Continua

Apos cada etapa importante:

1. Atualizar este arquivo com conclusoes e proximos passos.
2. Atualizar `refactor-state.json` com status estruturado.
3. Atualizar `EPUB_REFACTOR_PLAN.md` se houver mudanca arquitetural.
4. Registrar riscos ou decisoes novas.
5. Rodar validacoes relevantes.

## Ultima Validacao Registrada

Validacoes esperadas apos alteracoes recentes:

```bash
node --check workflows/audit-translation-epub/src/audit.js
node --check workflows/audit-translation-epub/src/menu.js
node --check workflows/audit-translation-epub/src/fixEpub.js
npm run audit:translation:epub:run
```

## Ultima Mudanca Implementada

Em 2026-05-24T23:48:44Z foi implementada a primeira milestone tecnica:

- criacao de `src/correction/correctionTypes.js`;
- criacao de `src/correction/correctionPlanner.js`;
- geracao de candidates a partir de replacements do log e achados de auditoria;
- inclusao de `correctionCandidates` no JSON de auditoria;
- geracao de `logs/json/correction-plan.json`;
- atualizacao do resumo TXT com contagem de candidates por modo.

Em 2026-05-24T23:57:13Z foi implementada a milestone `m2-xhtml-mapping`:

- criacao de `src/xhtmlMapper.js`;
- mapeamento de spine, arquivos XHTML, paragrafos e text nodes;
- geracao de IDs estaveis para nos textuais;
- enriquecimento de `correctionCandidates` com localizacao XHTML;
- enriquecimento de `correction-plan.json` com as mesmas referencias;
- validacao com EPUB real: 249 itens de spine, 16876 paragrafos e 17232 nos textuais mapeados.

Em 2026-05-25T00:03:42Z foi implementada a milestone `m3-safe-terminology-application`:

- criacao de `src/correction/xhtmlCorrectionEngine.js`;
- integracao do `fixEpub.js` com `logs/json/correction-plan.json`;
- aplicacao restrita a actions `auto_safe` com confianca minima 0.9;
- geracao de `logs/json/correction-report.json`;
- geracao de EPUB corrigido em `output/`;
- validacao com o plano atual: 2 actions totais, 0 auto_safe, 0 correcoes aplicadas, 2 actions `auto_review` ignoradas corretamente.

Em 2026-05-25T00:15:38Z foi implementada a milestone `m4-terminology-glossary`:

- criacao de `input/glossary/terms.json`;
- criacao de `input/glossary/entities.json`;
- criacao de `src/correction/terminologyNormalizer.js`;
- criacao de `src/correction/entityNormalizer.js`;
- `correctionPlanner.js` passou a gerar actions `auto_safe` a partir do glossario;
- validacao real: 1 action `auto_safe` gerada para `T/N:` -> `N/T:`;
- `xhtmlCorrectionEngine.js` aplicou 4 correcoes em 4 arquivos XHTML;
- 2 actions `auto_review` continuaram ignoradas corretamente.

Em 2026-05-25T00:43:09Z foi implementada a milestone `m5-post-correction-validation`:

- criacao de `src/correction/postCorrectionValidator.js`;
- integracao ao final de `fixEpub.js`;
- geracao de `logs/json/post-correction-validation.json`;
- validacao tecnica do EPUB corrigido;
- comparacao textual entre traducao base e output corrigido;
- confirmacao das correcoes aplicadas no texto final;
- validacao real: status `OK`, EPUB tecnico valido, mudanca textual real detectada, 4 de 4 correcoes confirmadas.

Em 2026-05-25T01:08:39Z foi implementada a milestone `m6-automatic-reaudit`:

- `fixEpub.js` passou a executar reauditoria automatica com o EPUB corrigido como `translated`;
- geracao de `logs/json/reaudit-report.json`;
- geracao de `logs/json/reauditoria-summary.json`;
- comparativo antes/depois com issues, warnings e correction candidates;
- validacao real: issues 0 -> 0, warnings 3 -> 3, candidates 3 -> 2, resultado `improvement`.

Em 2026-05-25T01:32:18Z foi implementada a milestone `m7-correction-report-dashboard`:

- `audit-dashboard-latest.html` passou a exibir correcoes aplicadas, acoes ignoradas, validacao pos-correcao e reauditoria;
- `validation-report-latest.html` ganhou aba `Correcoes` com o mesmo rastreamento operacional;
- geracao de `logs/txt/correction-report-latest.md` como resumo Markdown das correcoes;
- README atualizado com as novas saidas e informacoes exibidas;
- a milestone manteve o escopo restrito a visualizacao/rastreabilidade, sem aplicar correcao contextual ampla.

Em 2026-05-25T01:57:41Z foi implementada a milestone `m8-review-queue`:

- criacao de `src/correction/reviewQueue.js`;
- geracao de `logs/json/review-queue.json` a partir de actions `auto_review` e `manual_only`;
- geracao de `logs/txt/review-queue-latest.md`;
- itens da fila incluem tipo, `filePath`, `nodeId`, `textPreview`, motivo de nao aplicar automaticamente, confianca e sugestao;
- status preparados para revisao futura: `pending`, `approved`, `rejected`, `needs_context`;
- dashboard principal e aba `Correcoes` passaram a exibir resumo da review queue;
- nenhuma aplicacao de itens aprovados, Ollama ou correcao contextual ampla foi implementada nesta etapa.

Em 2026-05-25T02:26:08Z foi implementada a milestone `m9-review-approval-application`:

- criacao de `src/correction/approvedCorrectionsReader.js`;
- `fixEpub.js` passou a ler `logs/json/review-queue.json` antes de aplicar correcoes;
- somente itens `approved` com `before`, `after` e localizacao XHTML valida sao convertidos em actions aplicaveis;
- itens `pending`, `rejected` e `needs_context` sao registrados como ignorados e nao alteram o EPUB;
- `xhtmlCorrectionEngine.js` passou a aceitar actions com origem `review_queue_approved`;
- `correction-report.json` registra `source: review_queue_approved`, `reviewQueueItemId`, `filePath`, `nodeId`, `confidence` e resumo da fila;
- dashboards e Markdown de correcoes exibem origem/status para diferenciar correcoes automaticas seguras de correcoes aprovadas manualmente;
- nenhuma aprovacao automatica, Ollama ou correcao contextual ampla foi implementada.

Em 2026-05-25T02:49:11Z foi implementada a milestone `m10-review-queue-workflow-docs`:

- criacao de `REVIEW_QUEUE_WORKFLOW.md` com fluxo manual de aprovacao/rejeicao;
- documentacao dos status `pending`, `approved`, `rejected` e `needs_context`;
- documentacao dos campos obrigatorios para `approved`;
- exemplos de item `approved` e `rejected`;
- criacao de `src/correction/reviewQueueValidator.js`;
- criacao do comando `src/validateReviewQueue.js`;
- inclusao do script `npm run review:translation:epub:validate`;
- `fixEpub.js` passou a bloquear item `approved` invalido antes da aplicacao;
- README atualizado com o comando de validacao e referencia ao guia.

Em 2026-05-25T03:12:04Z foi implementada a milestone `m11-assisted-review-suggestions`:

- criacao de `src/correction/assistedReview.js`;
- geracao de `logs/json/assisted-review-suggestions.json`;
- geracao de `logs/txt/assisted-review-suggestions-latest.md`;
- processamento restrito a itens `pending` com `mode: auto_review`;
- sugestoes estruturadas com `before`, `suggestedAfter`, `reason`, `confidence` e `requiresHumanApproval: true`;
- fallback deterministico conservador, sem dependencia obrigatoria de modelo;
- dashboards e relatorio de validacao passaram a exibir as sugestoes assistidas;
- nenhuma sugestao e aplicada automaticamente.

Em 2026-05-25T03:34:19Z foi implementada a milestone `m12-assisted-review-suggestion-quality`:

- `assistedReview.js` passou a classificar sugestoes como `suggestion_available`, `needs_human_translation` ou `insufficient_context`;
- `suggestedAfter` continua restrito a casos com `before/after` explicito ou heuristica segura;
- falsos positivos provaveis de portugues natural, como `a tempo`, `a lugar nenhum` e cliticos antes de adverbio em `-mente`, sao tratados como `insufficient_context`;
- `reason` ficou mais detalhado para explicar por que uma sugestao explicita foi ou nao gerada;
- confidence ficou mais conservadora para casos sem sugestao explicita;
- dashboards e Markdown passaram a exibir a classificacao de qualidade da sugestao;
- nenhuma sugestao e aplicada automaticamente.

Em 2026-05-25T04:08:33Z foi implementada a milestone `m13-review-context-enrichment`:

- `reviewQueue.js` passou a enriquecer itens com `previousParagraph`, `currentParagraph`, `nextParagraph` e `originalAlignedText` quando disponivel;
- `assistedReview.js` passou a propagar o contexto expandido para `assisted-review-suggestions.json`;
- os previews sao limitados para evitar relatorios grandes;
- dashboards e relatorio de validacao exibem o contexto expandido;
- a classificacao `insufficient_context` foi mantida quando o contexto ainda nao permite uma sugestao segura;
- nenhuma correcao automatica, Ollama obrigatorio ou reescrita ampla foi implementada.

Em 2026-05-25T04:37:12Z foi implementada a milestone `m14-chapter-alignment-safe`:

- criacao de `src/chapterAligner.js`;
- alinhamento de secoes priorizando numero de capitulo e titulo normalizado;
- fallback por indice marcado como `index_fallback_low_confidence`;
- `originalAlignedText` so e preenchido quando `alignmentConfidence >= 0.8`;
- review queue e assisted review passaram a incluir `alignmentConfidence` e `alignmentReason`;
- dashboards e relatorios exibem motivo/confianca do alinhamento;
- alinhamentos inseguros deixam `originalAlignedText` vazio por seguranca.

Em 2026-05-25T04:58:26Z foi implementada a milestone `m15-assisted-review-with-alignment`:

- `assistedReview.js` passou a usar `originalAlignedText` quando `alignmentConfidence` e alta;
- `suggestedAfter` pode ser gerado apenas em heuristicas locais e conservadoras com sobreposicao textual suficiente;
- a heuristica inicial cobre descompasso simples de pronomes quando original e traducao atual sustentam a sugestao;
- `requiresHumanApproval` permanece `true` em todas as sugestoes;
- `insufficient_context` e mantido quando o alinhamento e confiavel em nivel de capitulo, mas nao ha base textual segura no paragrafo;
- nenhuma aplicacao automatica, Ollama obrigatorio ou reescrita ampla foi implementada.

Em 2026-05-25T09:48:02Z foi implementada a milestone `m16-paragraph-alignment-safe`:

- `chapterAligner.js` passou a tentar alinhamento seguro de paragrafo dentro do capitulo alinhado;
- heuristicas conservadoras usam nomes proprios, numeros, perfil de pontuacao e comprimento relativo;
- review queue e assisted review passaram a incluir `paragraphAlignmentConfidence` e `paragraphAlignmentReason`;
- `originalAlignedText` so e preenchido quando o alinhamento de paragrafo passa no limiar seguro;
- casos ambiguos mantem `originalAlignedText` vazio por seguranca;
- dashboards e relatorios exibem confianca/motivo do alinhamento de paragrafo;
- nenhuma aplicacao automatica, Ollama obrigatorio ou reescrita ampla foi implementada.

Em 2026-05-25T10:17:41Z foi implementada a milestone `m17-stabilization-and-tests`:

- criacao de `src/validatePipeline.js`;
- comando `npm run validate:translation:epub`;
- validacao de contratos para `correctionTypes`, `correctionPlanner`, `xhtmlMapper`, `xhtmlCorrectionEngine`, `postCorrectionValidator`, `reviewQueueValidator` e `chapterAligner`;
- fixtures EPUB pequenas geradas em diretorio temporario durante a execucao;
- README atualizado com checklist de validacao;
- nenhuma funcionalidade linguistica nova foi implementada.

Checkpoint final da m17 em 2026-05-25T16:39:00Z:

- `npm run validate:translation:epub` executado com sucesso;
- `npm run review:translation:epub:validate` executado com sucesso;
- `npm run audit:translation:epub:run` executado com sucesso;
- `npm run fix:translation:epub` executado com sucesso, gerando validacao pos-correcao `OK` e reauditoria `improvement`;
- `input-fixed/manifest.json` revertido por conter apenas avanco operacional para `v8` gerado durante validacao local.

Em 2026-05-25T17:25:00Z foi implementada a milestone `m18-assisted-model-adapter`:

- criado contrato desacoplado de adapter em `src/correction/modelAdapter.js`;
- criado `src/correction/ollamaAdapter.js` usando o padrao local de Ollama via `/api/generate`, resposta JSON estruturada, timeout e temperatura baixa;
- o adapter Ollama fica desativado por padrao e so roda com `EPUB_AUDIT_OLLAMA=1`;
- `assistedReview.js` passou a enviar apenas itens `pending` + `auto_review` ao modelo opcional;
- prompts usam contexto limitado: `originalAlignedText`, `previousParagraph`, `currentParagraph`, `nextParagraph` e `textPreview`;
- respostas do modelo sao validadas para evitar `suggestedAfter` vazio, baixa confianca, mudanca excessiva de tamanho ou perda de nomes/termos protegidos;
- resultados aceitos continuam com `requiresHumanApproval: true` e origem `ollama`;
- falhas, baixa confianca ou sugestoes rejeitadas retornam ao fallback deterministico;
- criado `logs/json/assisted-review-model-trace.json` para registrar prompts, respostas, rejeicoes e fallback;
- dashboards e relatorios passaram a exibir origem das sugestoes, riscos, contagem de Ollama e fallback;
- nenhuma sugestao e aplicada automaticamente e nenhum EPUB e alterado nesta milestone.

Em 2026-05-25T17:45:00Z foi implementada a milestone `m19-model-output-contract`:

- prompt do Ollama atualizado para exigir `suggestedAfter` como paragrafo completo em `patchMode: full_paragraph`;
- adicionados campos opcionais `targetBefore`, `replacementAfter` e `patchMode`;
- validacao passou a aceitar dois contratos: `full_paragraph` e `localized_patch`;
- `localized_patch` so e aceito quando `targetBefore` existe literalmente em `currentParagraph`;
- `localized_patch` gera `suggestedAfter` como paragrafo completo derivado do patch, mantendo rastreabilidade de `targetBefore` e `replacementAfter`;
- trace do modelo registra `patchMode`, `targetBefore`, `replacementAfter` e motivo de rejeicao;
- README atualizado com o novo contrato;
- nenhuma sugestao e aplicada automaticamente.

Em 2026-05-25T21:05:00Z foi executada a milestone operacional `m20-manual-approved-suggestion-test`:

- analisado `logs/json/assisted-review-suggestions.json`;
- escolhida uma unica sugestao `suggestion_available`: `ars-0001`, ligada ao item `rq-0001`;
- item `rq-0001` foi marcado como `approved` em `review-queue.json` usando `targetBefore` como `before` e `replacementAfter` como `after`;
- `npm run review:translation:epub:validate` retornou `OK` com 1 approved e 1 pending;
- `npm run fix:translation:epub` aplicou 5 substituicoes no total;
- a correcao aprovada da review queue foi aplicada como `review_queue_approved`;
- item pendente `rq-0002` permaneceu ignorado com `review_queue_pending_not_applied`;
- validacao pos-correcao retornou `OK`, EPUB tecnico valido e 5/5 correcoes confirmadas;
- reauditoria retornou `improvement`, com candidates reduzidos de 3 para 2;
- `input-fixed/manifest.json` foi restaurado apos o teste para evitar registrar estado operacional local como mudanca de codigo.

Em 2026-05-25T21:30:00Z foi implementada a milestone `m21-semantic-consistency-audit`:

- criado `src/semanticConsistencyAudit.js`;
- geracao de `logs/json/semantic-candidates.json`;
- `semanticCandidates` ficam separados de `correctionCandidates` e nao alimentam automaticamente o `correctionPlan`;
- camada detecta sinais de omissao/expansao, drift semantico, repeticao anormal, literalidade, inconsistencia terminologica e tratamento inconsistente;
- candidatos usam `originalAlignedText` quando o alinhamento e confiavel, `currentParagraph`, contexto expandido, glossario e entidades;
- cada candidato recebe severidade `low`, `medium` ou `high`;
- cada candidato recebe confianca `deterministic`, `heuristic` ou `model_assisted`;
- dashboards HTML passaram a exibir a aba/secao de auditoria semantica;
- nenhuma correcao e aplicada automaticamente e nenhum EPUB e alterado nesta milestone.

Calibracao da m21:

- distribuicao inicial: 96 semanticCandidates, com 21 high, 43 medium e 32 low;
- falsos positivos reduzidos em numeros com separador PT-BR/EN, notas de rodape numericas, tratamento `Senhor` como titulo/lorde e repeticoes enfaticas curtas de dialogo;
- distribuicao apos calibracao: 40 semanticCandidates, com 0 high, 32 medium e 8 low;
- `high` passa a ficar reservado para riscos numericos realmente ausentes ou outras regras futuras de maior confianca.

Em 2026-05-25T22:25:00Z foi implementada a milestone `m22-semantic-review-integration`:

- `reviewQueue.js` passou a receber `semanticAudit`;
- apenas `semanticCandidates` com severidade `medium` e `confidenceScore >= 0.55` entram na review queue;
- itens semanticos entram com `origin: semantic_audit`, `mode: auto_review` e `status: pending`;
- itens semanticos mantem `semanticCandidateId`, severidade, tipo, confidence, reason, filePath, nodeId, currentParagraph e originalAlignedText quando disponivel;
- `semanticCandidates` continuam fora do `correctionPlan` e nunca viram `auto_safe`;
- `assistedReview.js` passou a contabilizar sugestoes de origem semantica, sempre com `requiresHumanApproval: true`;
- dashboards e relatorio de validacao separam correctionPlan, semanticCandidates e itens de review vindos da auditoria semantica;
- nenhum EPUB/output e alterado nesta milestone.

Em 2026-05-25T22:45:00Z foi executada a milestone operacional `m23-semantic-review-with-ollama`:

- auditoria executada com `EPUB_AUDIT_OLLAMA=1`, `OLLAMA_HOST=http://127.0.0.1:11434` e `OLLAMA_MODEL=qwen2.5:7b`;
- Ollama respondeu via endpoint local com 33 requisicoes no trace;
- 32 itens `semantic_audit` estavam na review queue e permaneceram `pending`;
- foram geradas 33 sugestoes assistidas no total, sendo 32 de origem `semantic_audit`;
- 19 sugestoes do Ollama foram aceitas como `suggestion_available`;
- 14 respostas foram rejeitadas pela validacao conservadora e ficaram em fallback/`insufficient_context`;
- motivos de rejeicao: `target_not_found`, `length_ratio_out_of_range` e `does_not_preserve_protected_tokens`;
- nenhuma sugestao entrou no `correctionPlan`;
- nenhum EPUB/output/input-fixed foi alterado.

Em 2026-05-26T01:10:00Z foi implementada a milestone `m24-model-validation-hardening`:

- analisado `logs/json/assisted-review-model-trace.json` gerado na m23;
- rejeicoes da m23 classificadas como mistura de protecao correta, alvo impreciso do modelo e prompt ainda ambiguo para patches localizados;
- prompt do Ollama reforcado para copiar `targetBefore` literalmente, preservar tokens protegidos, numeros, termos canonicos e evitar patches excessivamente curtos;
- validacao passou a registrar detalhes explicitos de rejeicao: token protegido faltante, trecho esperado/retornado, modo de match, ratio calculado e numeros alterados;
- `localized_patch` passou a aceitar match seguro compativel com aspas tipograficas (`"` vs `“”`) sem aceitar reticencias usadas como placeholder;
- validacao foi endurecida para rejeitar mudanca de numeros, insercao de marcador/termo ingles inseguro e justificativa puramente estilistica em achados semanticos;
- auditoria final com Ollama respondeu 33 requisicoes, aceitou 13 sugestoes e rejeitou 20;
- motivos finais de rejeicao: 8 `protected_tokens`, 5 `target_not_found`, 2 `unsafe_marker_or_english_term`, 1 `semantic_overlap_too_low`, 1 `numbers` e 3 `style_only_reason`;
- as sugestoes aceitas ficaram apenas como `suggestion_available`, sempre com `requiresHumanApproval: true`;
- nenhuma sugestao entrou no `correctionPlan`;
- nenhum EPUB/output/input-fixed foi alterado.
- decisao operacional: parar a calibracao da m24 neste ponto. A milestone melhorou diagnostico e validacao, mas novas calibracoes devem ser feitas futuramente com base em uso real e exemplos revisados manualmente, nao buscando metrica perfeita agora.

Em 2026-05-26T12:50:00Z foi executada uma validacao pratica do pipeline com lote pequeno de sugestoes aprovadas manualmente:

- itens selecionados: `ars-0026/srq-0025`, `ars-0030/srq-0029` e `ars-0011/srq-0010`;
- apenas esses itens foram marcados como `approved` na review queue; os demais itens `semantic_audit` permaneceram `pending`;
- `npm run review:translation:epub:validate` retornou `OK` com 3 approved, 31 pending, 0 rejected e 0 needs_context;
- `npm run fix:translation:epub` gerou `output/Show Me Your Stats ptbr_v10_fixed.epub`;
- foram registradas 6 substituicoes no total: 4 normalizacoes terminologicas `T/N -> N/T` e 2 correcoes semanticas aprovadas;
- correcoes semanticas confirmadas no texto final: `incrédulo -> descrente` e `espessura ideal da massa -> espessura ideal do pão`;
- a sugestao `Soble... -> Sobletz...` nao foi aplicada porque o `before` aprovado nao existia exatamente no no XHTML; o texto final ja continha `Sobletz`, portanto o skip foi seguro e evitou aplicar uma sugestao stale/truncada;
- validacao pos-correcao retornou `OK`, EPUB tecnico valido, texto alterado e 6/6 correcoes aplicadas confirmadas;
- reauditoria retornou `improvement`: issues 0 -> 0, warnings 3 -> 3, correctionCandidates 3 -> 2;
- percepcao qualitativa: as duas mudancas semanticas aplicadas ficaram naturais no paragrafo e melhoram consistencia local; a terceira reforcou a necessidade de conferir se a sugestao ainda existe literalmente no XHTML antes de aprovar.

Em 2026-05-26T15:50:00Z foi executado novo lote pratico incremental de revisao semantica:

- auditoria regenerada com Ollama habilitado para obter sugestoes atuais de `semantic_audit`;
- sugestoes aprovadas manualmente: `ars-0006/srq-0004` (`este seu senhor -> esse seu senhor`) e `ars-0016/srq-0015` (`pensando direito -> pensando com clareza`);
- sugestao rejeitada manualmente: `ars-0023/srq-0022` (`intenções assassinas -> intenção assassina`), pois a aplicacao em apenas uma ocorrencia de uma sequencia repetida deixou o trecho inconsistente;
- itens restantes permaneceram `pending`;
- `npm run review:translation:epub:validate` retornou `OK`;
- `npm run fix:translation:epub` gerou `output/Show Me Your Stats ptbr_v13_fixed.epub`;
- foram aplicadas 6 substituicoes: 4 normalizacoes `T/N -> N/T` e 2 correcoes semanticas aprovadas;
- validacao pos-correcao retornou `OK`, EPUB tecnico valido, texto alterado e 6/6 correcoes confirmadas;
- reauditoria retornou `improvement`: issues 0 -> 0, warnings 3 -> 3, correctionCandidates 3 -> 2;
- percepcao qualitativa: as duas correcoes semanticas ficaram naturais e localizadas; a rejeicao da repeticao mostrou que sugestoes em blocos repetidos precisam tratar todas as ocorrencias de forma consistente ou ficar pendentes para revisao manual mais cuidadosa.

# Status Do Refactor - audit-translation-epub

Atualizado em: 2026-05-24T23:57:13Z

## Fase Atual

Fase 2 - Mapeamento XHTML implementado.

O workflow EPUB agora possui o primeiro contrato funcional entre auditoria e correcao e uma camada de mapeamento XHTML. `correctionCandidates` e `correctionPlan` passam a referenciar localizacoes precisas no EPUB quando ha contexto suficiente.

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

## Funcionalidades Em Andamento

- Alinhamento conceitual com `audit-translation-docx`.
- Separacao entre inteligencia compartilhavel e adaptadores EPUB/XHTML.
- Preparacao da proxima fase: aplicacao controlada de plano em XHTML.

## Pendencias

- Refatorar `fixEpub.js` para aplicar plano de correcao.
- Criar `xhtmlCorrectionEngine.js`.
- Criar `terminologyNormalizer.js`.
- Criar `entityNormalizer.js`.
- Criar `genderAgreementFixer.js`.
- Criar `residualEnglishFixer.js`.
- Criar `epubValidator.js`.
- Criar `xhtmlMapper.js`.
- Criar reauditoria comparativa antes/depois.
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

## Proximos Passos Recomendados

1. Atualizar relatorios HTML para exibir resumo de candidates/plano e localizacoes XHTML.
2. Criar `xhtmlCorrectionEngine.js` sem integrar ainda ao `fixEpub.js`.
3. Refatorar `fixEpub.js` para consumir `correctionPlan`.
4. Implementar normalizacao terminologica segura para acoes `auto_safe`.
5. Rodar reauditoria automatica e medir mudanca textual real.

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

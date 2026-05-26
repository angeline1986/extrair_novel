# Plano Tecnico de Refactor - audit-translation-epub

Atualizado em: 2026-05-25T01:08:39Z

## 1. Visao Geral

O workflow `audit-translation-epub` nasceu para comparar um EPUB original em ingles com uma versao traduzida em portugues, usando tambem um arquivo `Log_Traducao.txt` como insumo. O fluxo atual ja consegue extrair texto, comparar secoes, gerar relatorios e aplicar substituicoes textuais explicitas no XHTML.

O problema principal e que o pipeline ainda nao transforma os achados da auditoria em correcoes linguisticas reais. A versao corrigida tende a ser praticamente identica a versao traduzida quando o log nao contem substituicoes diretas, pois o motor de correcao atual atua apenas como aplicador conservador de replacements.

O objetivo deste refactor e evoluir o EPUB de um validador estrutural com replacements manuais para um pipeline completo de:

```txt
auditoria -> correction candidates -> correction plan -> normalizacao -> correcao XHTML -> validacao -> reauditoria
```

## 2. Diagnostico Arquitetural Atual

O workflow EPUB atualmente possui responsabilidades principais em:

- leitura do EPUB original;
- leitura do EPUB traduzido;
- leitura do `Log_Traducao.txt`;
- comparacao de secoes e tamanhos;
- deteccao de alguns residuos em ingles;
- deteccao de padroes linguisticos simples;
- geracao de relatorios TXT, JSON e HTML;
- aplicacao de substituicoes diretas definidas no log;
- versionamento basico em `input-fixed/vN` e `output/`;
- reempacotamento EPUB preservando `mimetype` como primeira entrada.

Arquivos principais atuais:

```txt
workflows/audit-translation-epub/src/
├── audit.js
├── checks.js
├── epubReader.js
├── fixEpub.js
├── logReader.js
└── menu.js
```

## 3. Limitacoes Do Pipeline Atual

Limitacoes funcionais:

- auditoria e correcao ainda sao pouco integradas;
- `fixEpub.js` nao consome os achados da auditoria como plano de correcao;
- correcoes dependem quase exclusivamente de replacements explicitos do log;
- nao existe normalizacao canonica de entidades por obra;
- nao existe glossario estruturado por obra;
- nao existe correcao contextual real de genero/concordancia;
- residuos em ingles sao detectados, mas nao corrigidos automaticamente;
- nao ha classificacao formal entre correcao segura, correcao assistida e correcao manual;
- relatorios ainda nao apresentam um diff linguistico robusto antes/depois.

Limitacoes arquiteturais:

- `audit.js` acumula responsabilidades de orquestracao, serializacao e escrita de relatorios;
- `fixEpub.js` mistura aplicacao de replacements, empacotamento, versionamento e relatorio;
- regras linguisticamente compartilhaveis ainda nao foram extraidas para uma camada comum;
- nao ha schema formal para `correctionCandidates` e `correctionPlan`;
- nao ha camada de adaptadores para reaproveitar inteligencia entre DOCX e EPUB.

## 4. Comparacao Com audit-translation-docx

O `audit-translation-docx` possui pipeline mais completo:

- auditoria estrutural;
- deteccao de padroes tipicos de Google Tradutor;
- validacao de entidades;
- glossario canonico;
- normalizacao de aliases;
- correcao de genero/concordancia;
- versionamento incremental;
- reauditoria automatica;
- relatorios consolidados;
- eventos de workflow;
- suporte a revisao assistida.

Modulos relevantes do DOCX:

```txt
gtPatterns
ollamaReviewer
entities
versionWorkflow
reportGenerator
fix-gender
observability/workflowLog
reportWriter
```

O EPUB deve reaproveitar a inteligencia compartilhavel, mas nao deve copiar cegamente regras DOCX. EPUB exige tratamento proprio para XHTML, spine, OPF, ZIP e preservacao de markup.

## 5. Arquitetura Alvo

Arquitetura desejada:

```txt
input/source/*.epub
input/translated/*.epub
input/logs/Log_Traducao.txt
input/glossary/*.json
        ↓
epubReader + xhtmlMapper
        ↓
auditEngine
        ↓
correctionCandidates
        ↓
correctionPlanner
        ↓
correctionPlan
        ↓
xhtmlCorrectionEngine
        ↓
epubPackager + epubValidator
        ↓
versionWorkflow
        ↓
reaudit
        ↓
reports + manifest + workflow-events
```

Principio central: a auditoria deve gerar dados acionaveis. O corretor nao deve tentar adivinhar problemas sozinho; ele deve aplicar um plano rastreavel.

## 6. Fluxo Completo Do Novo Pipeline

1. Selecionar EPUB original, EPUB traduzido e log.
2. Extrair XHTML seguindo a ordem da spine do EPUB.
3. Criar um mapa estavel de documento:

```txt
sectionIndex -> xhtmlPath -> paragraphIndex -> textNodeIndex
```

4. Rodar auditoria estrutural e linguistica.
5. Gerar `correctionCandidates`.
6. Classificar candidatos:

```txt
auto_safe
auto_review
manual_only
```

7. Montar `correctionPlan`.
8. Aplicar normalizacoes seguras.
9. Aplicar correcoes contextuais aprovadas.
10. Reempacotar EPUB.
11. Validar pacote EPUB.
12. Reextrair texto da versao corrigida.
13. Comparar antes/depois.
14. Reauditar a versao corrigida.
15. Gerar relatorios, eventos e manifesto.

## 7. Correction Plan

O `correctionPlan` e o contrato entre auditoria e correcao.

Ele deve conter:

- identificador da execucao;
- origem dos dados;
- lista de acoes;
- nivel de confianca;
- risco;
- fonte da decisao;
- posicao no XHTML;
- antes/depois;
- status de aplicacao;
- motivo de rejeicao, quando houver.

### Schema Proposto

```json
{
  "schemaVersion": "1.0",
  "workflow": "audit-translation-epub",
  "createdAt": "2026-05-24T23:37:47Z",
  "source": {
    "original": "input/source/Show Me Your Stats.EPUB",
    "translated": "input/translated/Show Me Your Stats ptbr.epub",
    "log": "input/logs/Log_Traducao.txt"
  },
  "summary": {
    "totalCandidates": 12,
    "autoSafe": 7,
    "autoReview": 3,
    "manualOnly": 2
  },
  "actions": []
}
```

### Exemplo De Action

```json
{
  "id": "cp-0001",
  "type": "terminology_replace",
  "mode": "auto_safe",
  "source": "log",
  "confidence": 0.98,
  "risk": "low",
  "target": {
    "xhtmlPath": "OEBPS/Text/chapter-012.xhtml",
    "sectionIndex": 12,
    "paragraphIndex": 34,
    "textNodeIndex": 2
  },
  "before": "mana stones",
  "after": "pedras de mana",
  "status": "pending"
}
```

## 8. Correction Candidates

`correctionCandidates` sao achados da auditoria que podem virar correcoes.

Nem todo achado deve ser corrigido automaticamente. Exemplo:

- secao faltando: candidato `manual_only`;
- termo divergente: candidato `auto_safe`;
- pronome com genero suspeito: candidato `auto_review`;
- trecho residual em ingles: candidato `auto_review` ou `manual_only`.

### Exemplo De Candidate Seguro

```json
{
  "id": "cand-0001",
  "type": "terminology_mismatch",
  "severity": "WARN",
  "mode": "auto_safe",
  "from": "mana stones",
  "to": "pedras de mana",
  "source": "Log_Traducao.txt",
  "occurrences": 8
}
```

### Exemplo De Candidate Contextual

```json
{
  "id": "cand-0002",
  "type": "gender_agreement_suspicion",
  "severity": "WARN",
  "mode": "auto_review",
  "entity": "Solar",
  "context": "Solar estava cansada depois da luta.",
  "suggestion": "Solar estava cansado depois da luta.",
  "confidence": 0.72
}
```

### Exemplo De Candidate Manual

```json
{
  "id": "cand-0003",
  "type": "missing_section",
  "severity": "FAIL",
  "mode": "manual_only",
  "sourceTitle": "Chapter 42",
  "reason": "Nao e seguro reconstruir secao ausente automaticamente."
}
```

## 9. Estrategia De Normalizacao

Fontes de normalizacao, em ordem de prioridade:

1. `input/logs/Log_Traducao.txt`
2. `input/glossary/entities.json`
3. `input/glossary/terms.json`
4. biblioteca compartilhada de regras seguras

Regras:

- glossario da obra nunca deve vazar para outra obra;
- aliases devem ter origem e justificativa;
- termos ambiguos exigem modo `auto_review`;
- substituicoes devem respeitar limites de palavra;
- normalizacao deve preservar capitalizacao quando possivel;
- toda mudanca precisa aparecer no relatorio.

## 10. Estrategia De Correcao Contextual

Correcoes contextuais devem ser introduzidas em camadas:

1. padroes deterministicos seguros;
2. padroes com entidade conhecida;
3. sugestoes assistidas por modelo;
4. revisao manual para baixa confianca.

Exemplos de regras iniciais:

```txt
ele estava cansada -> ele estava cansado
ela estava cansado -> ela estava cansada
o garota -> a garota
a homem -> o homem
```

Essas regras nao devem ser globais sem contexto. Elas precisam considerar entidade, pronome, trecho local e risco.

## 11. Componentes Reutilizaveis Do DOCX

Reutilizar ou abstrair:

- `reportWriter` e assets de dashboard;
- serializers de issues/warnings;
- `workflow-events.jsonl`;
- conceito de `manifest.json`;
- versionamento incremental;
- parte de `gtPatterns`;
- parte de `entities`;
- parte de `fix-gender`;
- `ollamaReviewer`, com adaptador por documento.

Nao reutilizar diretamente:

- manipulacao de DOCX;
- assumptions de paragrafos DOCX;
- glossarios especificos de outra obra;
- regras de entidades herdadas sem escopo da obra;
- corretores que dependem de estrutura Word.

## 12. Componentes Especificos Para EPUB/XHTML

Necessarios:

- `xhtmlMapper`: mapeia spine, arquivos XHTML e text nodes;
- `xhtmlCorrectionEngine`: aplica correcoes preservando markup;
- `epubPackager`: reempacota EPUB corretamente;
- `epubValidator`: valida `mimetype`, `container.xml`, OPF e spine;
- `textDiff`: mede mudanca textual real;
- `epubReauditOrchestrator`: roda auditoria antes/depois.

## 13. Modularizacao Proposta

```txt
workflows/audit-translation-epub/src/
├── audit/
│   ├── auditEngine.js
│   ├── checks.js
│   └── candidateBuilder.js
├── correction/
│   ├── correctionPlanner.js
│   ├── correctionTypes.js
│   ├── terminologyNormalizer.js
│   ├── entityNormalizer.js
│   ├── genderAgreementFixer.js
│   ├── residualEnglishFixer.js
│   └── xhtmlCorrectionEngine.js
├── epub/
│   ├── epubReader.js
│   ├── xhtmlMapper.js
│   ├── epubPackager.js
│   └── epubValidator.js
├── reports/
│   ├── reportWriter.js
│   └── serializers.js
├── version/
│   └── epubVersionWorkflow.js
├── observability/
│   └── workflowLog.js
├── audit.js
├── fixEpub.js
└── menu.js
```

Camada compartilhada futura:

```txt
workflows/shared/
├── audit/
├── correction/
├── reports/
├── versioning/
└── observability/
```

## 14. Responsabilidades Dos Modulos

`auditEngine.js`
: orquestra checks e gera issues, warnings e candidates.

`candidateBuilder.js`
: transforma achados em `correctionCandidates`.

`correctionPlanner.js`
: classifica candidates e gera `correctionPlan`.

`terminologyNormalizer.js`
: aplica termos canonicos e replacements seguros.

`entityNormalizer.js`
: normaliza personagens, nomes e aliases por obra.

`genderAgreementFixer.js`
: corrige padroes de genero/concordancia com contexto.

`residualEnglishFixer.js`
: trata trechos residuais em ingles.

`xhtmlCorrectionEngine.js`
: aplica plano em nos de texto XHTML.

`epubPackager.js`
: monta ZIP EPUB valido.

`epubValidator.js`
: valida estrutura tecnica do EPUB.

`epubVersionWorkflow.js`
: cria `vN`, atualiza `output` e `manifest.json`.

`workflowLog.js`
: registra eventos em `workflow-events.jsonl`.

## 15. Estrutura De Diretorios Sugerida

```txt
workflows/audit-translation-epub/
├── EPUB_REFACTOR_PLAN.md
├── REFACTOR_STATUS.md
├── refactor-state.json
├── README.md
├── input/
│   ├── source/
│   ├── translated/
│   ├── logs/
│   └── glossary/
│       ├── entities.json
│       └── terms.json
├── input-fixed/
│   ├── manifest.json
│   └── vN/
├── output/
├── logs/
│   ├── workflow-events.jsonl
│   ├── json/
│   ├── html/
│   └── txt/
└── src/
```

## 16. Etapas Incrementais Do Refactor

### Fase 1 - Contratos E Estado

- criar `correctionCandidates` no audit report;
- criar schema inicial de `correctionPlan`;
- separar serializers;
- documentar estado do refactor.

### Fase 2 - Planner

- criar `correctionPlanner.js`;
- classificar candidates em `auto_safe`, `auto_review`, `manual_only`;
- gerar plano sem aplicar ainda.

### Fase 3 - Normalizacao Segura

- estruturar `input/glossary`;
- criar normalizador terminologico;
- criar normalizador de entidades;
- aplicar apenas acoes `auto_safe`.

### Fase 4 - XHTML Engine

- criar mapeamento de text nodes;
- aplicar plano preservando markup;
- registrar before/after por acao;
- validar EPUB tecnico.

### Fase 5 - Reauditoria

- reauditar EPUB corrigido;
- comparar issues/warnings antes/depois;
- calcular mudanca textual real;
- registrar ganhos e regressions.

### Fase 6 - Correcao Contextual

- implementar regras deterministicas de genero/concordancia;
- tratar residuos em ingles de baixa complexidade;
- adicionar modo assistido por modelo para candidates `auto_review`.

### Fase 7 - Compartilhamento DOCX/EPUB

- extrair utilitarios comuns para `workflows/shared`;
- adaptar DOCX e EPUB gradualmente;
- reduzir duplicacao de relatorios, versionamento e observabilidade.

## 17. Prioridades Tecnicas

Alta:

- correction candidates;
- correction plan;
- normalizacao terminologica;
- entidades por obra;
- XHTML correction engine;
- reauditoria antes/depois;
- relatorio de correcoes aplicadas.

Media:

- genero/concordancia contextual;
- residuos em ingles;
- integracao com revisor assistido;
- camada compartilhada.

Baixa:

- reescrita semantica ampla;
- reconstrucao automatica de secoes faltantes;
- correcao integral por modelo.

## 18. Riscos

- quebrar XHTML;
- alterar texto demais sem revisao;
- aplicar glossario de obra errada;
- falsos positivos em entidades;
- corrigir genero incorretamente;
- reempacotar EPUB invalido;
- gerar output estruturalmente diferente sem melhoria textual;
- aumentar custo de execucao com revisao assistida;
- introduzir dependencia excessiva entre DOCX e EPUB.

## 19. Criterios De Validacao

Um refactor bem-sucedido deve demonstrar:

- EPUB corrigido possui mudanca textual real quando existem candidates aplicaveis;
- pacote EPUB permanece valido;
- `mimetype` continua primeira entrada e sem compressao;
- `META-INF/container.xml` existe;
- OPF e spine continuam legiveis;
- relatorio mostra correcoes aplicadas e ignoradas;
- reauditoria reduz ou justifica issues/warnings;
- `manifest.json` registra versao criada;
- `workflow-events.jsonl` registra eventos relevantes;
- nenhum glossario externo vaza para outra obra.

## 20. Estrategia De Versionamento

Manter:

```txt
input-fixed/
├── manifest.json
├── v1/
├── v2/
└── v3/

output/
└── Livro_v3_fixed.epub
```

O manifesto deve registrar:

- versao;
- arquivo fonte;
- arquivo versionado;
- arquivo final;
- data;
- total de candidates;
- total de correcoes aplicadas;
- total de correcoes ignoradas;
- validacao EPUB;
- resultado da reauditoria.

## 21. Estrategia De Reauditoria

Toda correcao deve disparar:

1. auditoria antes;
2. correcao;
3. validacao EPUB;
4. auditoria depois;
5. comparacao antes/depois.

Resumo esperado:

```json
{
  "before": {
    "issues": 12,
    "warnings": 26
  },
  "after": {
    "issues": 2,
    "warnings": 9
  },
  "textChanged": true,
  "appliedCorrections": 42,
  "skippedCorrections": 8
}
```

## 22. Roadmap Sugerido

1. Congelar contratos de JSON.
2. Criar candidates.
3. Criar planner.
4. Aplicar normalizacao terminologica.
5. Aplicar normalizacao de entidades.
6. Reestruturar `fixEpub.js` como orquestrador.
7. Adicionar relatorio de correcoes.
8. Adicionar reauditoria comparativa.
9. Adicionar genero/concordancia.
10. Adicionar revisao assistida.
11. Extrair camada compartilhada com DOCX.

## 23. Processo De Atualizacao Continua

Apos cada etapa importante do refactor, atualizar obrigatoriamente:

- `EPUB_REFACTOR_PLAN.md`;
- `REFACTOR_STATUS.md`;
- `refactor-state.json`.

Cada atualizacao deve registrar:

- o que foi implementado;
- decisoes arquiteturais tomadas;
- mudancas estruturais;
- problemas encontrados;
- riscos identificados;
- pendencias;
- proximos passos.

Procedimento recomendado:

1. Antes de implementar, ler `REFACTOR_STATUS.md` e `refactor-state.json`.
2. Implementar a menor etapa coerente.
3. Rodar validacoes.
4. Atualizar os tres arquivos.
5. Registrar no `workflow-events.jsonl`, quando a mudanca afetar o fluxo.
6. Confirmar que os documentos permanecem coerentes entre si.

## 24. Regra De Continuidade

Qualquer pessoa ou IA retomando este trabalho deve considerar estes arquivos como fonte de verdade do refactor:

```txt
EPUB_REFACTOR_PLAN.md
REFACTOR_STATUS.md
refactor-state.json
```

Se houver divergencia entre codigo e documentos, a proxima tarefa deve ser reconciliar documentacao e implementacao antes de avancar.

## 25. Estado Da Primeira Milestone

Implementado em: 2026-05-24T23:48:44Z

A primeira milestone implementavel foi concluida com escopo limitado:

- schema inicial de `correctionCandidates`;
- `src/correction/correctionTypes.js`;
- `src/correction/correctionPlanner.js`;
- `audit.js` emitindo `correctionCandidates`;
- `logs/json/correction-plan.json` gerado sem aplicar correcoes;
- resumo TXT incluindo contagem de candidates por modo;
- evento `AUDIT_REPORT_CREATED` registrando caminho do correction plan.

Esta milestone nao aplica correcoes no EPUB. O objetivo foi criar o contrato entre auditoria e correcao para permitir a proxima etapa: mapeamento XHTML e aplicacao controlada de acoes `auto_safe`.

Arquivos adicionados:

```txt
src/correction/correctionTypes.js
src/correction/correctionPlanner.js
```

Saida nova:

```txt
logs/json/correction-plan.json
```

Proxima milestone recomendada:

```txt
xhtmlMapper -> xhtmlCorrectionEngine -> fixEpub consumindo correctionPlan
```

## 26. Estado Da Milestone m2-xhtml-mapping

Implementado em: 2026-05-24T23:57:13Z

A milestone `m2-xhtml-mapping` foi concluida sem aplicar correcoes no EPUB.

Entregas:

- `src/xhtmlMapper.js`;
- leitura da spine/ordem de leitura do EPUB;
- mapeamento de arquivo XHTML para paragrafos/blocos;
- mapeamento de paragrafos para nos de texto;
- identificadores estaveis de nos textuais no formato `s0000-p0000-t0000`;
- enriquecimento de `correctionCandidates.target`;
- enriquecimento de `correctionCandidates.locations`;
- enriquecimento de `correctionPlan.actions[].target`;
- enriquecimento de `correctionPlan.actions[].locations`;
- inclusao de resumo do mapa em `audit-report.epubAudit.xhtmlMap`.

Campos adicionados a candidates/actions:

```json
{
  "target": {
    "scope": "translation_text",
    "filePath": "1/OEBPS/Text/0027_Chapter_27.xhtml",
    "spineIndex": 29,
    "paragraphIndex": 56,
    "textNodeIndex": 0,
    "textPreview": "..."
  },
  "locations": []
}
```

Resultado validado com EPUB real:

```json
{
  "spineItems": 249,
  "paragraphs": 16876,
  "textNodes": 17232
}
```

Proxima milestone recomendada:

```txt
xhtmlCorrectionEngine.js sem aplicacao automatica final
```

O proximo passo deve criar a capacidade de simular ou preparar aplicacao de acoes em XHTML, ainda sem ativar correcao automatica completa no fluxo principal.

## 27. Estado Da Milestone m3-safe-terminology-application

Implementado em: 2026-05-25T00:03:42Z

A milestone `m3-safe-terminology-application` foi concluida com escopo restrito: aplicar apenas correcoes `auto_safe` de alta confianca em nos XHTML mapeados.

Entregas:

- `src/correction/xhtmlCorrectionEngine.js`;
- `fixEpub.js` consumindo `logs/json/correction-plan.json`;
- filtro de aplicacao restrito a:
  - `mode === "auto_safe"`;
  - `confidence >= 0.9`;
  - `before` e `after` presentes;
- edicao somente de nos de texto mapeados;
- preservacao de tags XHTML;
- registro de correcoes em `logs/json/correction-report.json`;
- registro de acoes ignoradas quando `mode` e `auto_review` ou `manual_only`;
- geracao de EPUB corrigido em `output/`;
- atualizacao de `input-fixed/manifest.json`.

Schema resumido do correction report:

```json
{
  "schemaVersion": "1.0",
  "appliedCorrections": [
    {
      "actionId": "cp-0001",
      "candidateId": "cand-0001",
      "type": "terminology_replace",
      "mode": "auto_safe",
      "filePath": "1/OEBPS/Text/0001.xhtml",
      "nodeId": "s0001-p0002-t0000",
      "before": "...",
      "after": "...",
      "replacements": 1
    }
  ],
  "skippedActions": [],
  "summary": {
    "totalActions": 2,
    "autoSafeActions": 0,
    "appliedCorrections": 0,
    "skippedActions": 2,
    "changedEntries": 0,
    "replacements": 0
  }
}
```

Validacao com o plano atual:

```json
{
  "totalActions": 2,
  "autoSafeActions": 0,
  "appliedCorrections": 0,
  "skippedActions": 2,
  "changedEntries": 0,
  "replacements": 0
}
```

O resultado esperado neste momento foi `0` correcoes aplicadas porque o plano atual contem somente actions `auto_review`. Isso confirma que o engine nao aplica correcoes contextuais prematuramente.

Proxima milestone recomendada:

```txt
relatorio visual de correction-report + normalizacao terminologica mais abrangente
```

## 28. Estado Da Milestone m4-terminology-glossary

Implementado em: 2026-05-25T00:15:38Z

A milestone `m4-terminology-glossary` foi concluida com glossarios locais por obra e geracao real de actions `auto_safe`.

Entregas:

- `input/glossary/terms.json`;
- `input/glossary/entities.json`;
- `src/correction/terminologyNormalizer.js`;
- `src/correction/entityNormalizer.js`;
- `correctionPlanner.js` gerando actions `auto_safe` para correspondencias exatas com glossario seguro;
- `correctionPlanner.js` mantendo `auto_review` para entradas ambiguas;
- `xhtmlCorrectionEngine.js` aplicando somente os casos seguros;
- `correction-report.json` registrando `before`, `after`, `filePath`, `nodeId` e tipo da correcao.

Glossario inicial:

```json
{
  "from": "T/N:",
  "to": "N/T:",
  "mode": "auto_safe",
  "confidence": 0.99
}
```

Resultado validado:

```json
{
  "totalActions": 3,
  "autoSafeActions": 1,
  "appliedCorrections": 4,
  "skippedActions": 2,
  "changedEntries": 4,
  "replacements": 4
}
```

As 2 actions ignoradas eram `auto_review`, mantendo a regra de seguranca do milestone.

Proxima milestone recomendada:

```txt
correction-report nos dashboards + reauditoria comparativa antes/depois
```

## 29. Estado Da Milestone m5-post-correction-validation

Implementado em: 2026-05-25T00:43:09Z

A milestone `m5-post-correction-validation` foi concluida com validacao automatica ao final de `fixEpub.js`.

Entregas:

- `src/correction/postCorrectionValidator.js`;
- validacao de ZIP/EPUB basico;
- validacao de `mimetype`;
- validacao de `META-INF/container.xml`;
- validacao de OPF;
- validacao de manifest e spine;
- reextracao de texto da versao corrigida;
- comparacao entre EPUB traduzido base e EPUB corrigido;
- deteccao de mudanca textual real;
- confirmacao de correcoes aplicadas no texto final;
- geracao de `logs/json/post-correction-validation.json`;
- integracao da validacao ao final de `fixEpub.js`.

Resultado validado:

```json
{
  "status": "OK",
  "packageValidation": {
    "zipReadable": true,
    "mimetypePresent": true,
    "mimetypeFirst": true,
    "mimetypeValid": true,
    "containerPresent": true,
    "opfPresent": true,
    "manifestValid": true,
    "spineValid": true,
    "manifestItems": 256,
    "spineItems": 249
  },
  "textComparison": {
    "textChanged": true,
    "beforeParagraphs": 17042,
    "afterParagraphs": 17042
  },
  "correctionValidation": {
    "appliedCorrections": 4,
    "confirmedCorrections": 4,
    "unconfirmedCorrections": 0
  }
}
```

Esta milestone ainda nao executa a reauditoria completa do conteudo corrigido contra o original. Ela garante que a correcao produziu um EPUB tecnicamente valido, com mudanca textual real e correcoes confirmadas.

Proxima milestone recomendada:

```txt
reauditoria automatica completa + comparativo issues/warnings antes/depois
```

## 30. Estado Da Milestone m6-automatic-reaudit

Implementado em: 2026-05-25T01:08:39Z

A milestone `m6-automatic-reaudit` foi concluida com reauditoria automatica ao final de `fixEpub.js`.

Entregas:

- `fixEpub.js` executando `audit.js --translated=<EPUB corrigido>`;
- geracao de `logs/json/reaudit-report.json`;
- geracao de `logs/json/reauditoria-summary.json`;
- comparacao entre audit report anterior e reauditoria;
- resumo com:
  - `issuesBefore`;
  - `issuesAfter`;
  - `warningsBefore`;
  - `warningsAfter`;
  - `correctionCandidatesBefore`;
  - `correctionCandidatesAfter`;
  - `appliedCorrections`;
  - `validationStatus`;
  - `result`.

Resultado validado:

```json
{
  "issuesBefore": 0,
  "issuesAfter": 0,
  "warningsBefore": 3,
  "warningsAfter": 3,
  "correctionCandidatesBefore": 3,
  "correctionCandidatesAfter": 2,
  "appliedCorrections": 4,
  "validationStatus": "OK",
  "result": "improvement"
}
```

O resultado foi classificado como `improvement` porque a quantidade de correction candidates caiu de 3 para 2 sem aumento de issues ou warnings.

Proxima milestone recomendada:

```txt
exibir correction-report, post-correction-validation e reauditoria-summary nos dashboards HTML
```

## 31. Estado Da Milestone m7-correction-report-dashboard

Implementado em: 2026-05-25T01:32:18Z

A milestone `m7-correction-report-dashboard` foi concluida como camada de rastreabilidade e visualizacao, sem ampliar o escopo de correcao automatica.

Entregas:

- secao de correcoes em `logs/html/audit-dashboard-latest.html`;
- aba `Correcoes` em `logs/html/validation-report-latest.html`;
- leitura integrada de `logs/json/correction-report.json`;
- leitura integrada de `logs/json/post-correction-validation.json`;
- leitura integrada de `logs/json/reauditoria-summary.json`;
- listagem de correcoes aplicadas com `type`, `before`, `after`, `filePath`, `nodeId` e `confidence`;
- listagem de actions ignoradas por `auto_review` ou `manual_only`;
- status final `improvement`, `regression`, `neutral` ou `unknown`;
- resumo Markdown em `logs/txt/correction-report-latest.md`.

Esta milestone nao implementa Ollama, reescrita semantica, genero/concordancia ampla ou aplicacao de actions ambiguas. Ela apenas torna visivel o que o pipeline seguro ja decidiu, aplicou, ignorou e validou.

Proxima milestone recomendada:

```txt
iniciar correcoes contextuais controladas para casos auto_review, com aprovacao ou regras conservadoras
```

## 32. Estado Da Milestone m8-review-queue

Implementado em: 2026-05-25T01:57:41Z

A milestone `m8-review-queue` foi concluida como preparacao para aprovacao manual futura de acoes inseguras ou ambiguas.

Entregas:

- `src/correction/reviewQueue.js`;
- `logs/json/review-queue.json`;
- `logs/txt/review-queue-latest.md`;
- inclusao de actions `auto_review` e `manual_only` na fila;
- campos por item: tipo, modo, status, `filePath`, `nodeId`, indices XHTML, `textPreview`, motivo, confianca, risco e sugestao;
- status permitidos: `pending`, `approved`, `rejected`, `needs_context`;
- preservacao de status anterior quando a mesma chave estavel reaparece em nova auditoria;
- resumo da fila no dashboard principal;
- resumo da fila na aba `Correcoes` do relatorio de validacao.

Esta milestone nao aplica itens aprovados, nao executa Ollama e nao faz correcao contextual ampla. A fila e apenas um contrato persistente de revisao para permitir uma etapa futura segura.

Proxima milestone recomendada:

```txt
interface/fluxo de aprovacao manual da review queue sem aplicacao automatica ampla
```

## 33. Estado Da Milestone m9-review-approval-application

Implementado em: 2026-05-25T02:26:08Z

A milestone `m9-review-approval-application` foi concluida como mecanismo controlado de aplicacao manualmente aprovada.

Entregas:

- `src/correction/approvedCorrectionsReader.js`;
- leitura de `logs/json/review-queue.json` pelo `fixEpub.js`;
- conversao apenas de itens `approved` em actions aplicaveis;
- validacao obrigatoria de `before`, `after` e localizacao XHTML antes da aplicacao;
- bloqueio explicito de itens `pending`, `rejected` e `needs_context`;
- suporte no `xhtmlCorrectionEngine.js` para actions com origem `review_queue_approved`;
- registro de `source`, `reviewQueueItemId`, `filePath`, `nodeId` e `confidence` no `correction-report.json`;
- resumo de aprovadas/ignoradas no relatorio de correcoes;
- dashboards atualizados com origem/status das actions.

Esta milestone nao cria aprovacao automatica, nao usa Ollama e nao implementa correcao contextual ampla. Ela apenas permite aplicar uma decisao manual ja registrada de forma explicita na fila.

Proxima milestone recomendada:

```txt
criar comando/interface para editar status da review queue com seguranca e trilha de auditoria
```

## 34. Estado Da Milestone m10-review-queue-workflow-docs

Implementado em: 2026-05-25T02:49:11Z

A milestone `m10-review-queue-workflow-docs` foi concluida como camada de documentacao e validacao do fluxo manual.

Entregas:

- `REVIEW_QUEUE_WORKFLOW.md`;
- documentacao dos status permitidos: `pending`, `approved`, `rejected`, `needs_context`;
- documentacao dos campos obrigatorios para item `approved`;
- exemplos de item `approved` e `rejected`;
- `src/correction/reviewQueueValidator.js`;
- `src/validateReviewQueue.js`;
- script `npm run review:translation:epub:validate`;
- validacao integrada ao `fixEpub.js` para impedir `approved` invalido.

Esta milestone nao implementa Ollama, aprovacao automatica nem interface interativa. Ela garante que a edicao manual da fila tenha regras claras e uma validacao executavel.

Proxima milestone recomendada:

```txt
criar comando assistido para aprovar/rejeitar itens sem editar JSON manualmente
```

## 35. Estado Da Milestone m11-assisted-review-suggestions

Implementado em: 2026-05-25T03:12:04Z

A milestone `m11-assisted-review-suggestions` foi concluida como camada de sugestao assistida sem aplicacao automatica.

Entregas:

- `src/correction/assistedReview.js`;
- `logs/json/assisted-review-suggestions.json`;
- `logs/txt/assisted-review-suggestions-latest.md`;
- processamento apenas de itens `pending` e `auto_review` da review queue;
- sugestoes com `before`, `suggestedAfter`, `reason`, `confidence` e `requiresHumanApproval: true`;
- fallback deterministico conservador quando nao ha `before/after` confiavel;
- visualizacao das sugestoes no dashboard principal;
- visualizacao das sugestoes na aba `Correcoes` do relatorio de validacao.

Esta milestone nao implementa Ollama obrigatorio, aprovacao automatica, aplicacao automatica ou reescrita ampla. A sugestao assistida e apenas insumo para decisao humana futura.

Proxima milestone recomendada:

```txt
criar comando assistido para aprovar/rejeitar itens usando sugestoes assistidas como insumo
```

## 36. Estado Da Milestone m12-assisted-review-suggestion-quality

Implementado em: 2026-05-25T03:34:19Z

A milestone `m12-assisted-review-suggestion-quality` foi concluida como melhoria de qualidade das sugestoes assistidas.

Entregas:

- classificacao de sugestoes em `suggestion_available`, `needs_human_translation` e `insufficient_context`;
- `suggestedAfter` explicito apenas para casos com `before/after` confiavel ou heuristica segura;
- `reason` detalhado explicando a decisao da heuristica;
- confidence conservadora para itens sem sugestao explicita;
- tratamento de provaveis falsos positivos de portugues natural como `insufficient_context`;
- atualizacao de `assisted-review-suggestions.json`;
- atualizacao de `assisted-review-suggestions-latest.md`;
- atualizacao do dashboard e relatorio de validacao com a classificacao das sugestoes.

Esta milestone nao implementa Ollama obrigatorio, aplicacao automatica ou reescrita ampla. Todas as sugestoes continuam exigindo aprovacao humana.

Proxima milestone recomendada:

```txt
criar comando assistido para aprovar/rejeitar itens usando suggestionStatus e suggestedAfter
```

## 37. Estado Da Milestone m13-review-context-enrichment

Implementado em: 2026-05-25T04:08:33Z

A milestone `m13-review-context-enrichment` foi concluida como enriquecimento de contexto para revisao humana e sugestoes futuras.

Entregas:

- `review-queue.json` enriquecido com `previousParagraph`, `currentParagraph`, `nextParagraph` e `originalAlignedText` quando disponivel;
- `assisted-review-suggestions.json` enriquecido com os mesmos campos;
- previews limitados para preservar tamanho dos relatorios;
- contexto expandido exibido no dashboard principal;
- contexto expandido exibido na aba `Correcoes` do relatorio de validacao;
- preservacao de `insufficient_context` quando o contexto ainda nao sustenta sugestao segura.

Esta milestone nao implementa aplicacao automatica, Ollama obrigatorio ou reescrita ampla. O objetivo e aumentar a qualidade dos insumos para revisao humana futura.

Proxima milestone recomendada:

```txt
usar contexto expandido para comando assistido de aprovacao/rejeicao manual
```

## 38. Estado Da Milestone m14-chapter-alignment-safe

Implementado em: 2026-05-25T04:37:12Z

A milestone `m14-chapter-alignment-safe` foi concluida como camada segura de alinhamento entre EPUB original e traduzido.

Entregas:

- `src/chapterAligner.js`;
- alinhamento por numero de capitulo quando disponivel;
- alinhamento por titulo normalizado como segunda opcao confiavel;
- fallback por indice apenas com baixa confianca;
- `originalAlignedText` vazio quando o alinhamento nao atinge o limiar confiavel;
- `alignmentConfidence` e `alignmentReason` na review queue;
- `alignmentConfidence` e `alignmentReason` nas sugestoes assistidas;
- exibicao de confianca/motivo nos dashboards e relatorios.

Esta milestone nao implementa aplicacao automatica, modelo obrigatorio ou reescrita ampla. O objetivo e evitar contexto original enganoso quando houver deslocamento entre EPUBs.

Proxima milestone recomendada:

```txt
usar alinhamento confiavel como insumo para aprovacao assistida manual
```

## 39. Estado Da Milestone m15-assisted-review-with-alignment

Implementado em: 2026-05-25T04:58:26Z

A milestone `m15-assisted-review-with-alignment` foi concluida como uso conservador do `originalAlignedText` nas sugestoes assistidas.

Entregas:

- `assistedReview.js` usando `originalAlignedText` confiavel como insumo;
- `suggestedAfter` gerado somente quando original, traducao atual e contexto sustentam uma troca local segura;
- heuristica inicial para descompasso simples de pronome;
- `reason` explicando a relacao entre original alinhado, traducao atual e sugestao;
- manutencao de `requiresHumanApproval: true` em todas as sugestoes;
- preservacao de `insufficient_context` quando o alinhamento de capitulo nao garante correspondencia de paragrafo suficiente.

Esta milestone nao implementa aplicacao automatica, Ollama obrigatorio ou reescrita ampla.

Proxima milestone recomendada:

```txt
criar aprovacao assistida manual usando suggestion_available como entrada
```

## 40. Estado Da Milestone m16-paragraph-alignment-safe

Implementado em: 2026-05-25T09:48:02Z

A milestone `m16-paragraph-alignment-safe` foi concluida como alinhamento seguro em nivel de paragrafo dentro de capitulos alinhados.

Entregas:

- alinhamento de paragrafo em `src/chapterAligner.js`;
- heuristicas conservadoras com nomes proprios, numeros, pontuacao e comprimento relativo;
- `paragraphAlignmentConfidence`;
- `paragraphAlignmentReason`;
- `originalAlignedText` preenchido apenas quando o paragrafo e confiavel;
- campos propagados para review queue e assisted review;
- dashboards e relatorios atualizados com o alinhamento de paragrafo.

Esta milestone nao implementa modelo/Ollama, aplicacao automatica ou reescrita ampla.

Proxima milestone recomendada:

```txt
usar alinhamento de paragrafo confiavel para sugestoes assistidas mais especificas
```

## 41. Estado Da Milestone m17-stabilization-and-tests

Implementado em: 2026-05-25T10:17:41Z

A milestone `m17-stabilization-and-tests` foi concluida como consolidacao do estado atual do refactor.

Entregas:

- `src/validatePipeline.js`;
- comando `npm run validate:translation:epub`;
- fixtures EPUB pequenas criadas em diretorio temporario durante a validacao;
- validacao de `correctionTypes`;
- validacao de `correctionPlanner`;
- validacao de `xhtmlMapper`;
- validacao de `xhtmlCorrectionEngine`;
- validacao de `postCorrectionValidator`;
- validacao de `reviewQueueValidator`;
- validacao de `chapterAligner`;
- checklist de validacao no README.

Esta milestone nao implementa novas funcionalidades linguisticas. O objetivo e reduzir risco de regressao no pipeline ja existente.

Proxima milestone recomendada:

```txt
criar testes automatizados formais ou integrar validate:translation:epub ao CI
```

## 42. Estado Da Milestone m18-assisted-model-adapter

Implementado em: 2026-05-25T17:25:00Z

A milestone `m18-assisted-model-adapter` foi concluida como integracao opcional de modelo local para melhorar sugestoes assistidas sem alterar EPUB.

Entregas:

- contrato desacoplado em `src/correction/modelAdapter.js`;
- adapter Ollama em `src/correction/ollamaAdapter.js`;
- ativacao opt-in por `EPUB_AUDIT_OLLAMA=1`;
- fallback deterministico preservado quando Ollama esta desativado, indisponivel ou retorna sugestao rejeitada;
- envio apenas de itens `pending` + `auto_review`;
- prompt com `originalAlignedText`, `previousParagraph`, `currentParagraph`, `nextParagraph` e `textPreview`;
- resposta estruturada com `suggestedAfter`, `reason`, `confidence`, `risks` e `requiresHumanApproval: true`;
- validacao conservadora contra sugestao vazia, baixa confianca, mudanca excessiva de tamanho e perda de nomes/termos protegidos;
- trace em `logs/json/assisted-review-model-trace.json`;
- dashboards e relatorios atualizados para exibir origem, riscos, aceite/rejeicao do modelo e fallback.

Esta milestone nao aplica sugestoes automaticamente, nao altera o EPUB e nao substitui a aprovacao humana.

Proxima milestone recomendada:

```txt
criar fluxo assistido para converter sugestoes aprovadas em itens approved da review queue
```

## 43. Estado Da Milestone m21-semantic-consistency-audit

Implementado em: 2026-05-25T21:30:00Z

A milestone `m21-semantic-consistency-audit` foi concluida como camada separada de auditoria semantica e consistencia textual.

Entregas:

- `src/semanticConsistencyAudit.js`;
- `logs/json/semantic-candidates.json`;
- `semanticCandidates` separados dos `correctionCandidates`;
- nenhum `semanticCandidate` entra automaticamente no `correctionPlan`;
- deteccao heuristica/deterministica de omissao/expansao, drift semantico, repeticao anormal, literalidade, inconsistencia terminologica e tratamento inconsistente;
- uso de `originalAlignedText`, `currentParagraph`, contexto expandido, glossario e entidades;
- severidade `low`, `medium` e `high`;
- confianca `deterministic`, `heuristic` e `model_assisted`;
- dashboard principal e relatorio de validacao com visualizacao dos candidatos semanticos.

Esta milestone nao aplica correcoes automaticamente e nao altera EPUB.

## 44. Estado Da Milestone m22-semantic-review-integration

Implementado em: 2026-05-25T22:25:00Z

A milestone `m22-semantic-review-integration` foi concluida como integracao controlada dos candidatos semanticos ao fluxo de revisao humana.

Entregas:

- leitura dos `semanticCandidates` gerados pela auditoria semantica;
- selecao apenas de candidatos `medium` com confianca suficiente;
- criacao de itens `origin: semantic_audit` na review queue;
- status inicial `pending`;
- `mode: auto_review`, nunca `auto_safe`;
- preservacao de tipo, severidade, confidence, reason, filePath, nodeId, currentParagraph e originalAlignedText;
- sugestoes assistidas continuam sendo apenas apoio e exigem aprovacao humana;
- dashboard principal e relatorio de validacao separam correctionCandidates, semanticCandidates e review items semanticos.

Esta milestone nao altera EPUB/output e nao aplica correcoes automaticamente.

## 45. Estado Da Milestone m24-model-validation-hardening

Implementado em: 2026-05-26T01:10:00Z

A milestone `m24-model-validation-hardening` estabiliza o contrato de sugestoes do modelo apos o teste real da review semantica com Ollama.

Entregas:

- prompt do Ollama reforcado para exigir `targetBefore` literal, sem reticencias/resumos, e `replacementAfter` proporcional ao alvo;
- instrucao explicita para preservar nomes proprios, numeros, termos canonicos, tags entre colchetes e marcadores como `*[T/N`;
- validacao com detalhes rastreaveis para `protected_tokens`, `target_not_found`, ratios e numeros alterados;
- localizacao segura de `localized_patch` com equivalencia entre aspas retas e aspas tipograficas;
- rejeicao de alvos truncados com reticencias quando nao encontrados literalmente;
- rejeicao de alteracoes numericas, insercao de marcador/termo ingles inseguro e sugestoes semanticas com justificativa apenas estilistica;
- `assisted-review-model-trace.json` passou a registrar `validationDetails` e `matchMode`;
- auditoria operacional com Ollama respondeu 33 requisicoes, aceitou 13 sugestoes como `suggestion_available` e rejeitou 20 com fallback conservador.

Comparativo m23 -> m24:

- m23: 19 aceitas, 14 rejeitadas;
- m24 final: 13 aceitas, 20 rejeitadas;
- rejeicoes antigas de ratio foram substituidas por motivos mais especificos;
- falsos positivos percebidos foram reduzidos ao bloquear numeros alterados, termos ingleses inseguros e sugestoes puramente estilisticas.

Esta milestone nao aplica sugestoes automaticamente, nao altera EPUB/output/input-fixed e nao coloca itens semanticos no `correctionPlan`.

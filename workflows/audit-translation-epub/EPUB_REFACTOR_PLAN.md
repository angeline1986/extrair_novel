# Plano Tecnico de Refactor - audit-translation-epub

Atualizado em: 2026-05-24T23:57:13Z

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

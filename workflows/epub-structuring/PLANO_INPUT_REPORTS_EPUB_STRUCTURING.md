Quero implementar uma nova organização de \`input/\` e \`reports/\` no módulo:

\`workflows/epub-structuring\`

A refatoração principal M0–M10 já foi concluída. Portanto, esta mudança deve ser tratada como uma evolução posterior e **\*\*não pode desfazer a arquitetura obtida\*\***, especialmente:

\* \`src/main.js\` como entrypoint fino;
\* \`runFullPipeline()\` como orquestrador;
\* services de pipeline reutilizáveis;
\* menu chamando services diretamente;
\* engines de prechapter, merge, títulos e referência isoladas;
\* \`npm start\` mantendo seu contrato legado, salvo pelas mudanças de paths explicitamente aprovadas neste escopo.

Antes de editar código, faça um diagnóstico do impacto desta mudança e apresente o resultado.

\---

**# 1. Objetivo arquitetural**

Quero estabelecer uma regra simples:

**\*\*Tudo que é insumo fica em \`input/\`.\*\***

**\*\*Tudo que é artefato produzido fica em \`output/\`.\*\***

**\*\*Tudo que é diagnóstico/relatório fica em \`reports/\` e deve poder ser apagado sem comprometer funcionalidades futuras.\*\***

A estrutura desejada é:

\`\`\`text
workflows/epub-structuring/
├── input/
│   ├── books/
│   │   ├── novel capitulos 1 a 60 - ch.epub
│   │   ├── novel capitulos 61 a 120 - ch.epub
│   │   └── ...
│   │
│   ├── reference-files/
│   │   ├── original.docx
│   │   ├── original.pdf
│   │   └── original.epub
│   │
│   └── validation-baseline/
│       └── ...
│
├── output/
│   └── ...
│
└── reports/
    └── ...
\`\`\`

Significado:

**### \`input/books/\`**

Arquivos que serão efetivamente processados pelo módulo.

Principalmente EPUBs.

As funcionalidades que hoje procuram EPUBs diretamente em \`input/\` devem passar a considerar \`input/books/\`.

**### \`input/reference-files/\`**

Arquivos usados apenas como fonte de conferência.

Pode conter:

\* EPUB;
\* PDF;
\* DOCX.

É a origem das funcionalidades de \`Reference Source\`.

Não confundir esses arquivos com os EPUBs que serão processados.

**#### Regra semântica obrigatória da fonte de referência**

A separação entre \`books/\` e \`reference-files/\` deve ser refletida também na UX.

A regra conceitual é:

\`\`\`text
input/books/
    ↓
O QUE quero analisar / auditar

input/reference-files/
    ↓
COM O QUE quero comparar
\`\`\`

Nunca usar automaticamente os arquivos de \`input/books/\` como catálogo de referências.

Um EPUB que está em \`input/books/\` é um **alvo de processamento**, não uma referência, ainda que tecnicamente também seja um arquivo EPUB.

A opção:

\`\`\`text
7. Usar fonte de referência
\`\`\`

deve separar explicitamente essas duas escolhas.

Fluxo desejado:

\`\`\`text
──────────────────────────────────────────────────────
  7. USAR FONTE DE REFERÊNCIA
──────────────────────────────────────────────────────

Selecione o EPUB que deseja auditar:

  [1] novel capitulos 1 a 60 - ch.epub
  [2] novel capitulos 61 a 120 - ch.epub
  [3] The Emperor's Strategy - Tais Mello.epub

  [0] Voltar

Selecione uma opção:
\`\`\`

Depois:

\`\`\`text
EPUB selecionado:
The Emperor's Strategy - Tais Mello.epub

Selecione a fonte usada para conferência:

  [1] The Emperor's Strategy - Original.docx
  [2] The Emperor's Strategy - Original.pdf
  [3] The Emperor's Strategy - Original Chinese.epub

  [4] Continuar sem referência
  [0] Voltar

Selecione uma opção:
\`\`\`

Regras iniciais da opção 7:

\* o EPUB alvo deve vir exclusivamente de \`input/books/\`;
\* a referência deve vir exclusivamente de \`input/reference-files/\`;
\* não oferecer o próprio EPUB alvo como fonte de referência;
\* não listar outros livros de \`input/books/\` como se fossem referências;
\* substituir o comportamento implícito \`[Enter] sem referência\` por uma opção numerada explícita;
\* a opção 7 deve trabalhar com **um EPUB alvo por vez** enquanto não existir uma semântica segura de auditoria de conjunto;
\* por isso, não exibir \`Selecionar todos\` na seleção do alvo da opção 7;
\* DOCX pode continuar aparecendo como formato previsto, mesmo enquanto o adapter real estiver pendente, desde que a interface informe claramente quando o formato ainda for \`unsupported\`.

Uma futura operação de auditoria de várias partes contra uma referência completa deve ser modelada explicitamente, por exemplo:

\`\`\`text
Auditar conjunto com fonte de referência
\`\`\`

e deverá validar que:

\* as partes pertencem à mesma obra;
\* os ranges são coerentes;
\* a referência pode ser associada ao conjunto;
\* não existe associação silenciosa entre obras diferentes.

**### \`input/validation-baseline/\`**

Dados persistentes que sejam realmente **\*\*insumo de validação/regressão\*\***.

A intenção é eliminar a dependência conceitual de arquivos descartáveis dentro de \`reports/\`.

Antes de mover qualquer JSON para cá, analise o código.

Não quero simplesmente mover \`chapter\_report.json\`, \`chapter\_resplit\_report.json\` etc.

Primeiro determine quais informações realmente constituem uma expectativa/baseline persistente e proponha uma representação canônica mínima.

Evite copiar relatórios inteiros para \`validation-baseline/\` apenas para manter compatibilidade.

\---

**# 2. Princípio fundamental de \`reports/\`**

Quero que:

\`\`\`text
rm -rf reports/\*
\`\`\`

seja conceitualmente seguro.

Apagar \`reports/\` pode remover:

\* histórico;
\* diagnósticos;
\* auditorias;
\* HTMLs;
\* JSONs técnicos.

Mas **\*\*não pode impedir que o sistema execute novamente uma feature\*\***.

Também não deve ser necessário preservar determinado relatório antigo apenas para que uma funcionalidade futura continue funcionando.

Se atualmente alguma feature depende de JSON dentro de \`reports/\`, identifique isso no diagnóstico.

Não esconda essa dependência.

\---

**# 3. Reports separados por execução**

Hoje há muitos arquivos diretamente em:

\`\`\`text
reports/
\`\`\`

Quero parar de misturar resultados de execuções diferentes.

Cada execução deve possuir uma pasta própria usando:

\`\`\`text
DDMMYYYY\_HHmmss
\`\`\`

Exemplo:

\`\`\`text
12082026\_011825
\`\`\`

Estrutura desejada:

\`\`\`text
reports/
├── 12082026\_011825/
│   ├── report.html
│   └── data/
│       ├── chapter\_report.json
│       ├── toc\_report.json
│       ├── validation\_report.json
│       ├── merge\_report.json
│       └── ...
│
├── 12082026\_014317/
│   ├── report.html
│   └── data/
│       └── ...
│
└── 12082026\_020545/
    ├── report.html
    └── data/
        └── ...
\`\`\`

O timestamp deve representar o início da execução e permanecer o mesmo durante toda aquela execução.

Não criar uma pasta diferente para cada JSON produzido dentro da mesma operação.

Também registre nos dados da execução um timestamp ISO, por exemplo:

\`\`\`text
2026-08-12T01:18:25-03:00
\`\`\`

O nome \`DDMMYYYY\_HHmmss\` é para legibilidade humana.

\---

**# 4. HTML como relatório principal**

Quero que o relatório principal para leitura humana seja:

\`\`\`text
report.html
\`\`\`

Os JSONs **\*\*não precisam desaparecer\*\***.

A arquitetura desejada é:

\`\`\`text
report.html
    ↓
interface humana

data/\*.json
    ↓
dados técnicos / diagnóstico
\`\`\`

Não quero que código interno precise fazer parsing de HTML para recuperar dados.

HTML é apresentação.

JSON continua sendo estrutura de dados quando necessário.

\---

**# 5. Relatório HTML consolidado**

Quero um relatório visual semelhante a um pequeno dashboard.

Não precisa copiar literalmente este desenho, mas deve seguir essa organização.

**## Cabeçalho**

Mostrar:

\* EPUB STRUCTURING;
\* data/hora;
\* tipo da operação;
\* status geral;
\* arquivos de entrada;
\* arquivo final, quando houver.

Exemplo conceitual:

\`\`\`text
EPUB STRUCTURING
Relatório de execução · 12/08/2026 01:18:25

Status geral
✓ SUCESSO

Entrada
novel capitulos 1 a 60 - ch.epub
novel capitulos 61 a 120 - ch.epub

Saída
Novel-capitulos-1-a-120.epub
\`\`\`

\---

**# 6. Cards de resumo**

Quando os dados existirem, mostrar cards como:

\`\`\`text
┌──────────────┐
│     120      │
│   Capítulos  │
└──────────────┘

┌──────────────┐
│     120      │
│     NAV      │
└──────────────┘

┌──────────────┐
│     120      │
│     NCX      │
└──────────────┘

┌──────────────┐
│     120      │
│    Spine     │
└──────────────┘
\`\`\`

Outros cards podem aparecer conforme a operação.

Exemplos:

\* títulos alterados;
\* gaps;
\* overlaps;
\* duplicados;
\* warnings;
\* errors;
\* fontes processadas;
\* capítulos comparados.

Não exibir cards sem significado apenas para preencher espaço.

\---

**# 7. Navegação lateral**

Quero avaliar uma sidebar no HTML.

Exemplo conceitual:

\`\`\`text
EPUB STRUCTURING

● Visão geral
  Entrada
  Capítulos
  Pré-capítulo
  Merge
  Títulos
  Referência
  Validação
  Arquivos
  Dados técnicos
\`\`\`

As seções devem aparecer apenas quando houver dados correspondentes.

Por exemplo, uma execução que apenas verifica idioma não precisa mostrar seção de merge vazia.

\---

**# 8. Seções do relatório**

O HTML deve conseguir representar, quando aplicável:

**### Visão geral**

\* status;
\* operação;
\* duração;
\* entrada;
\* saída;
\* warnings;
\* errors.

**### Entrada**

\* arquivos selecionados;
\* tamanho;
\* tipo;
\* faixa de capítulos, quando conhecida.

**### Capítulos**

\* quantidade;
\* primeiro;
\* último;
\* ausentes;
\* duplicados;
\* source selecionada;
\* confidence.

**### Pré-capítulo**

\* status por arquivo;
\* boundary source;
\* elementos removidos;
\* arquivo original/cópia efetiva.

**### Merge**

\* sources;
\* ordem;
\* ranges;
\* gaps;
\* overlaps;
\* duplicates;
\* collisions;
\* assets deduplicados/namespaced.

**### Títulos**

Mostrar resumo:

\`\`\`text
120 analisados
51 já corretos
69 normalizados
0 inconsistências restantes
\`\`\`

E, quando possível, tabela:

\`\`\`text
Cap. | Status | Antes | Depois
\`\`\`

**### Referência**

\* modo \`structural-only\` ou com referência;
\* arquivo de referência;
\* formato;
\* capítulos comparados;
\* missing;
\* duplicates;
\* boundary leaks;
\* warnings.

**### Validação**

\* EPUB 3;
\* manifest;
\* spine;
\* NAV;
\* NCX;
\* XML/XHTML;
\* regressão;
\* auditoria final.

**### Arquivos**

Listar:

\* entradas;
\* outputs;
\* relatórios técnicos relevantes.

**### Dados técnicos**

Pode conter links ou referências para os JSONs de:

\`\`\`text
data/
\`\`\`

Essa seção pode ficar recolhida por padrão.

\---

**# 9. Status visuais**

O HTML deve diferenciar claramente:

\* sucesso;
\* aviso;
\* erro;
\* indisponível/não executado.

Exemplo conceitual:

\`\`\`text
✓ SUCESSO
⚠ COM AVISOS
✕ ERRO
— NÃO EXECUTADO
\`\`\`

Não depender exclusivamente de cor.

Use também texto/ícone para acessibilidade.

\---

**# 10. HTML autocontido**

Preferência:

\`\`\`text
report.html
\`\`\`

deve ser autocontido.

CSS pode ficar dentro do próprio HTML.

Evite criar dependência de:

\* CDN;
\* Bootstrap remoto;
\* JavaScript remoto;
\* fontes web;
\* internet.

O relatório deve abrir localmente no navegador mesmo offline.

JavaScript local inline pode ser usado se realmente necessário para:

\* filtros;
\* navegação;
\* expandir/recolher;
\* busca.

Mas mantenha simples.

\---

**# 11. Responsividade**

O relatório deve continuar legível em:

\* monitor desktop;
\* notebook;
\* janela menor.

Sidebar pode virar navegação superior ou menu compacto em viewport pequena.

Tabelas grandes podem usar scroll horizontal.

\---

**# 12. Não criar HTML específico duplicado por feature**

Evite:

\`\`\`text
merge-html-builder.js
title-html-builder.js
prechapter-html-builder.js
reference-html-builder.js
...
\`\`\`

se isso significar duplicação de layout.

Prefira uma arquitetura parecida conceitualmente com:

\`\`\`text
ReportRun
    ↓
ReportSection[]
    ↓
HtmlReportRenderer
\`\`\`

Não é obrigatório usar esses nomes.

A ideia é ter um renderer compartilhado e sections/dados opcionais.

Cada feature pode fornecer dados, mas não deve recriar toda a página HTML.

\---

**# 13. Contexto de execução compartilhado**

Analise como introduzir um contexto de reports sem quebrar os services existentes.

Algo conceitualmente parecido com:

\`\`\`text
ReportContext
\- runId
\- startedAt
\- reportDir
\- dataDir
\`\`\`

Exemplo:

\`\`\`text
runId:
12082026\_011825

reportDir:
reports/12082026\_011825

dataDir:
reports/12082026\_011825/data
\`\`\`

Uma mesma execução/orquestração deve compartilhar esse contexto.

O \`runFullPipeline()\` é um candidato natural para iniciar esse contexto no processamento completo.

Features isoladas executadas pelo menu também devem gerar sua própria execução de relatório.

\---

**# 14. Menu — Ver relatórios**

A opção existente:

\`\`\`text
12\. Ver relatórios
\`\`\`

deve evoluir para um submenu.

Desejado:

\`\`\`text
──────────────────────────────────────────────────────
  12\. VER RELATÓRIOS
──────────────────────────────────────────────────────

  [1] Abrir último relatório
  [2] Selecionar relatório anterior
  [3] Abrir pasta de relatórios
  [4] Limpar relatórios

  [0] Voltar

Selecione uma opção:
\`\`\`

\---

**# 15. Abrir último relatório**

\`[1] Abrir último relatório\`

Deve localizar a execução mais recente e abrir:

\`\`\`text
report.html
\`\`\`

Use mecanismo adequado ao sistema operacional.

O projeto roda atualmente em macOS, mas prefira solução portável quando razoável.

Se não houver relatório:

\`\`\`text
Nenhum relatório disponível.
\`\`\`

Não falhar com stack trace.

\---

**# 16. Selecionar relatório anterior**

\`[2] Selecionar relatório anterior\`

Exemplo:

\`\`\`text
Relatórios encontrados:

  [1] 12/08/2026 01:18:25 — Processamento completo — SUCESSO
  [2] 12/08/2026 00:54:02 — Merge — SUCESSO
  [3] 11/08/2026 23:41:17 — Revisão de títulos — COM AVISOS

  [0] Voltar

Selecione uma opção:
\`\`\`

Ao selecionar:

\* abrir \`report.html\`;
\* ou, se abertura automática não for possível, imprimir o caminho claramente.

Não exigir que o usuário conheça nomes de pastas como \`12082026\_011825\`.

\---

**# 17. Abrir pasta de relatórios**

\`[3] Abrir pasta de relatórios\`

Abrir:

\`\`\`text
workflows/epub-structuring/reports/
\`\`\`

no gerenciador de arquivos quando suportado.

Se não for possível, imprimir o caminho absoluto.

\---

**# 18. Limpar relatórios**

Quero explicitamente uma opção para apagar os reports.

Fluxo desejado:

\`\`\`text
──────────────────────────────────────────────────────
  LIMPAR RELATÓRIOS
──────────────────────────────────────────────────────

Execuções encontradas: 14
Espaço utilizado: 38,4 MB

Esta ação removerá todo o conteúdo de:

reports/

Os arquivos de entrada e os EPUBs gerados NÃO serão afetados.

  [1] Limpar todos os relatórios
  [0] Cancelar

Escolha:
\`\`\`

Depois:

\`\`\`text
Confirma a exclusão de 14 execuções de relatório? [s/N]:
\`\`\`

Somente \`s\`/\`S\` deve confirmar.

Default deve ser NÃO.

\---

**# 19. Segurança da limpeza**

A função de limpeza deve possuir proteção forte.

Ela só pode apagar conteúdo dentro do diretório \`reports/\` do módulo.

Antes de remover:

\* resolver path absoluto;
\* confirmar que corresponde ao \`reports/\` esperado;
\* impedir \`..\`;
\* impedir path vazio;
\* impedir \`/\`;
\* impedir diretório do projeto;
\* impedir \`input/\`;
\* impedir \`output/\`.

Nunca usar comando shell montado com string do usuário.

Use APIs de filesystem.

Preservar \`.gitkeep\`, se existir e fizer sentido.

Depois da limpeza:

\`\`\`text
Relatórios removidos com sucesso.
\`\`\`

\---

**# 20. Migração dos reports atuais**

Hoje existem muitos relatórios antigos diretamente em \`reports/\`.

Exemplos:

\`\`\`text
chapter\_report.json
chapter\_resplit\_report.json
toc\_report.json
validation\_report.json
merge/
prechapter/
reference/
titles/
orchestration/
...
\`\`\`

Não quero uma migração automática destrutiva sem análise.

Primeiro classifique:

1\. relatório puramente descartável;
2\. relatório atualmente consumido por outra feature;
3\. diagnóstico manual/histórico;
4\. dado que na verdade deveria virar baseline em \`input/validation-baseline/\`.

Apresente essa classificação antes da migração.

Se algum relatório atual for usado como dependência de runtime, corrija a arquitetura antes de tornar \`reports/\` totalmente descartável.

\---

**# 21. Final regression validator**

Este ponto é crítico.

O M8 removeu o hardcode de 25 capítulos e passou a usar uma expectativa aprovada.

Agora precisamos garantir que essa expectativa **\*\*não dependa permanentemente de \`reports/\` descartáveis\*\***.

Analise:

\* \`final-regression-validator.js\`;
\* \`chapter\_report.json\`;
\* \`chapter\_resplit\_report.json\`;
\* \`toc\_report.json\`;
\* \`structure\_report.json\`;
\* \`validation\_report.json\`.

Determine quais dados são realmente baseline.

Proponha uma estrutura mínima em:

\`\`\`text
input/validation-baseline/
\`\`\`

Exemplo conceitual:

\`\`\`text
validation-baseline/
└── expected-structure.json
\`\`\`

Não assuma que precisamos manter dois JSONs separados apenas porque hoje existem dois reports.

Prefira um baseline canônico mínimo e explícito.

Também evite validação circular.

O baseline não pode simplesmente ser reconstruído a partir do EPUB final que está sendo validado.

\---

**# 22. Compatibilidade com input atual**

Hoje várias partes do sistema podem procurar arquivos diretamente em:

\`\`\`text
input/
\`\`\`

Antes de mudar para:

\`\`\`text
input/books/
input/reference-files/
input/validation-baseline/
\`\`\`

mapeie todos os usos.

Inclua:

\* \`findSingleEpub\`;
\* selectors da CLI;
\* PDF opcional;
\* reference loader;
\* merge;
\* prechapter;
\* títulos;
\* testes;
\* fixtures;
\* contratos M10.1;
\* qualquer path hardcoded.

Não faça uma substituição cega de \`input\` por \`input/books\`.

Cada tipo de arquivo deve ir para o diretório semanticamente correto.

\---

**# 23. Compatibilidade com \`npm start\`**

O comportamento funcional do pipeline deve permanecer.

Se antes:

\`\`\`text
npm start
\`\`\`

esperava exatamente um EPUB de processamento, agora esse contrato deve ser aplicado a:

\`\`\`text
input/books/
\`\`\`

e não aos arquivos de referência.

Exemplo:

\`\`\`text
input/books/
  livro.epub

input/reference-files/
  original.epub
  original.pdf
\`\`\`

Isso deve continuar sendo considerado:

\`\`\`text
1 EPUB de processamento
\`\`\`

e não 2 EPUBs.

Esse é um dos principais motivos desta reorganização.

\---

**# 24. Testes necessários**

Antes de implementar, mantenha o baseline atual.

Depois da implementação, adicionar/ajustar testes para:

**### Input**

\* \`input/books/\` com 0 EPUB;
\* \`input/books/\` com 1 EPUB;
\* \`input/books/\` com vários EPUBs;
\* EPUB em \`reference-files/\` não conta como livro;
\* PDF/DOCX em \`reference-files/\`;
\* baseline ausente;
\* baseline válido;
\* baseline inválido.

**### Reports**

\* criação de runId;
\* formato \`DDMMYYYY\_HHmmss\`;
\* criação de \`report.html\`;
\* criação de \`data/\`;
\* múltiplos JSONs da mesma execução ficam no mesmo run;
\* duas execuções geram diretórios diferentes;
\* seleção do relatório mais recente.

**### Limpeza**

\* reports vazio;
\* uma execução;
\* múltiplas execuções;
\* cálculo de espaço;
\* cancelamento;
\* confirmação;
\* preservação de \`input/\`;
\* preservação de \`output/\`;
\* proteção contra path incorreto.

**### HTML**

\* gera HTML válido;
\* funciona sem internet;
\* escapa nomes/textos para evitar HTML quebrado;
\* sections opcionais;
\* status;
\* cards;
\* tabelas;
\* links para dados técnicos.

**### Diagnóstico / interpretação**

\* resultado sem problemas produz \`✓ OK\`;
\* resultado com observação produz \`⚠ ATENÇÃO\`;
\* problema confirmado produz \`✗ PROBLEMA\`;
\* informação neutra usa \`ℹ INFORMAÇÃO\`;
\* ausência de NAV com NCX presente não vira erro automaticamente;
\* diferença entre quantidade de TOC e spine não é tratada automaticamente como corrupção;
\* recomendações são contextuais;
\* opções sugeridas correspondem ao menu existente;
\* a opção 1 não duplica a análise profunda das opções 2, 5, 6 e 10;
\* CLI e HTML recebem os mesmos findings;
\* conteúdo vindo de EPUB é escapado corretamente antes de ser exibido no HTML;
\* analyzer/service original continua com o mesmo comportamento.

**### Fonte de referência / opção 7**

\* alvo é listado somente a partir de \`input/books/\`;
\* referências são listadas somente a partir de \`input/reference-files/\`;
\* EPUB em \`reference-files/\` não aparece como livro de processamento;
\* EPUB em \`books/\` não aparece automaticamente como referência;
\* opção 7 não oferece \`Selecionar todos\` enquanto estiver em modo single;
\* continuar sem referência é uma opção explícita;
\* referência DOCX unsupported é informada de forma clara;
\* cancelar/voltar não inicia auditoria.

**### Regressão**

\* baseline externo válido;
\* baseline ausente;
\* baseline inconsistente;
\* final-regression não depende de report antigo;
\* não há validação circular.

\---

**# 25. Não quebrar funcionalidades existentes**

Depois da implementação, validar pelo menos:

\* menu;
\* análise de EPUB;
\* detecção de capítulos;
\* reestruturação;
\* revisão de títulos;
\* análise de sumário;
\* idioma;
\* reference source;
\* prechapter;
\* merge;
\* validação;
\* processamento completo;
\* reports.

Especial atenção para:

\`\`\`text
M7
Correção + merge + auditoria + normalização
\`\`\`

e:

\`\`\`text
M10
runFullPipeline()
\`\`\`

Todos devem compartilhar corretamente o novo contexto de reports quando aplicável.

\---

**# 26. Implementação em milestones**

Não faça tudo de uma vez.

Primeiro ajuste o plano existente e proponha milestones.

Sugestão inicial:

\`\`\`text
R1 — Diagnóstico de paths e dependências de reports
R2 — Nova estrutura de input
R3 — Baseline persistente de validação
R4 — ReportContext / diretório por execução
R5 — Migração dos JSONs para data/
R6 — Renderer HTML consolidado
R7 — Camada de diagnóstico, severidade e próximas ações
R8 — Integração do HTML com pipeline/features
R9 — Submenu Ver relatórios
R10 — Limpeza segura de reports
R11 — Regressão completa
\`\`\`

Você pode ajustar essa divisão se o diagnóstico mostrar uma ordem tecnicamente melhor.

\---

**# 26.1. R7 — Camada de diagnóstico, severidade e próximas ações**

Este milestone deve ser implementado depois do renderer HTML consolidado e antes da integração geral do HTML com pipeline/features.

O objetivo é fazer com que as opções analíticas deixem de mostrar apenas números e características técnicas sem contexto.

Exemplo atual:

\`\`\`text
Manifest: 30 itens
Spine: 25 itens
HTMLs lidos: 25
TOC: 50 entradas
NAV: não
NCX: sim
\`\`\`

Esse resultado informa dados, mas não ajuda o usuário a entender:

\* se há algo errado;
\* se existe apenas uma característica incomum;
\* se o EPUB parece saudável;
\* qual análise deve ser executada em seguida.

O R7 adiciona uma camada de **interpretação/apresentação**, sem criar uma nova engine de análise.

Arquitetura:

\`\`\`text
analyzer/service existente
        ↓
resultado estruturado
        ↓
diagnostic findings
        ↓
┌────────────────┬───────────────────┐
│ Terminal / CLI │ report.html       │
└────────────────┴───────────────────┘
\`\`\`

Terminal e HTML devem consumir a mesma informação semântica.

Não implementar uma regra no terminal e outra diferente no HTML.

**## Severidades padronizadas**

Usar:

\`\`\`text
✓ OK
⚠ ATENÇÃO
✗ PROBLEMA
ℹ INFORMAÇÃO
\`\`\`

Status geral possível:

\`\`\`text
Status: ✓ OK
\`\`\`

ou:

\`\`\`text
Status: ⚠ ATENÇÃO
\`\`\`

ou:

\`\`\`text
Status: ✗ PROBLEMAS ENCONTRADOS
\`\`\`

Não usar \`FAILED\` apenas porque uma característica opcional ou de outra geração de EPUB não está presente.

Exemplo:

\`\`\`text
NAV ausente
NCX presente
\`\`\`

não deve automaticamente significar:

\`\`\`text
ERRO
\`\`\`

A classificação deve respeitar o contexto e os dados produzidos pelos analyzers existentes.

**## Modelo conceitual de finding**

Cada achado pode conter conceitualmente:

\* código estável;
\* severidade;
\* resumo/mensagem;
\* evidência;
\* recomendação;
\* próxima ação relacionada.

Exemplo:

\`\`\`json
{
  "code": "TOC_SPINE_COUNT_DIFFERENCE",
  "severity": "warning",
  "message": "O TOC possui mais entradas que documentos no spine.",
  "evidence": {
    "tocEntries": 50,
    "spineItems": 25
  },
  "recommendation": "Investigar os destinos do sumário.",
  "suggestedAction": {
    "menuOption": 5,
    "label": "Analisar / reconstruir sumário"
  }
}
\`\`\`

Os nomes exatos podem ser adaptados às convenções do projeto.

**## Respeitar a responsabilidade de cada opção**

A camada de diagnóstico não deve fazer com que todas as opções passem a executar todas as análises.

Responsabilidades:

\`\`\`text
1. Analisar EPUB
→ triagem estrutural e diagnóstico superficial

2. Detectar capítulos
→ diagnóstico específico da estrutura e sequência de capítulos

5. Analisar / reconstruir sumário
→ diagnóstico específico de TOC / NAV / NCX

6. Verificar idioma
→ diagnóstico específico de idioma e coerência disponível

10. Validar EPUB
→ consolidação e validação técnica mais profunda
\`\`\`

A opção 1 pode encontrar um indício, mas deve encaminhar para a opção especializada.

Não deve duplicar a lógica das opções 2, 5, 6 ou 10.

**## Próximas ações sugeridas**

Quando houver uma funcionalidade apropriada para aprofundar um achado, apresentar:

\`\`\`text
PRÓXIMAS AÇÕES SUGERIDAS
──────────────────────────────────────────────────────

[2] Detectar capítulos
    Verificar como os capítulos estão distribuídos nos
    documentos do spine.

[5] Analisar / reconstruir sumário
    Investigar as entradas do TOC e a estrutura NAV/NCX.

[10] Validar EPUB
     Executar validação estrutural mais completa.
\`\`\`

As recomendações devem ser **contextuais**.

Não listar todas as opções indiscriminadamente.

**## Exemplo esperado — opção 1**

\`\`\`text
1. ANALISAR EPUB
──────────────────────────────────────────────────────

INFORMAÇÕES
──────────────────────────────────────────────────────
Título:              The Emperor's Strategy
Idioma metadata:     pt
Manifest:            30 itens
Spine:               25 itens
HTMLs lidos:         25
TOC:                 50 entradas
NAV:                 não
NCX:                 sim

DIAGNÓSTICO
──────────────────────────────────────────────────────

⚠ O EPUB utiliza NCX e não possui NAV XHTML.

ℹ O TOC possui 50 entradas para 25 documentos no spine.
  Isso pode ser legítimo quando múltiplas entradas apontam
  para anchors dentro do mesmo XHTML.

✓ Todos os 25 documentos do spine foram lidos.

RESULTADO
──────────────────────────────────────────────────────

Status: ⚠ ATENÇÃO

2 observações encontradas.
Nenhum erro crítico identificado nesta análise inicial.

PRÓXIMAS AÇÕES SUGERIDAS
──────────────────────────────────────────────────────

[5] Analisar / reconstruir sumário
    Investigar detalhadamente as 50 entradas do TOC.

[10] Validar EPUB
     Executar validação estrutural completa.
\`\`\`

Importante:

A diferença:

\`\`\`text
TOC = 50
Spine = 25
\`\`\`

não permite concluir automaticamente:

\`\`\`text
TOC duplicado
\`\`\`

porque várias entradas podem apontar para anchors diferentes dentro de um mesmo documento.

A opção 1 deve sinalizar o fato e recomendar a análise do sumário.

**## Aplicação incremental**

Aplicar inicialmente a:

\* opção 1 — Analisar EPUB;
\* opção 2 — Detectar capítulos;
\* opção 5 — Analisar / reconstruir sumário;
\* opção 6 — Verificar idioma;
\* opção 10 — Validar EPUB.

Depois avaliar outras operações somente se houver ganho real.

Não forçar findings em ações puramente executivas.

**## Integração com report.html**

Os findings gerados devem alimentar tanto o terminal quanto o HTML.

Exemplo:

\`\`\`text
Analyzer
   ↓
resultado
   ↓
Diagnostic Findings
   ├── Terminal Renderer
   └── HtmlReportRenderer
\`\`\`

Se o terminal disser:

\`\`\`text
⚠ O TOC possui mais entradas que documentos no spine.
\`\`\`

o \`report.html\` deve refletir a mesma severidade e o mesmo significado.

**## Regras de segurança do R7**

Não:

\* alterar detectors apenas para produzir mensagens de UX;
\* alterar builders por causa da apresentação;
\* duplicar regras de validação na CLI;
\* inferir erro sem evidência;
\* transformar warning em failure;
\* depender somente de cor;
\* criar códigos de diagnóstico instáveis a cada execução;
\* fazer HTML e terminal interpretarem o mesmo dado de formas diferentes.

**## Gate do R7**

O R7 está concluído quando:

\* opções 1, 2, 5, 6 e 10 produzem diagnóstico coerente quando aplicável;
\* severidades são padronizadas;
\* status geral é derivado dos findings;
\* recomendações são contextuais;
\* CLI e HTML usam os mesmos findings;
\* os analyzers originais continuam com o mesmo comportamento;
\* nenhuma nova engine paralela de análise foi criada.

\---

**# 27. Primeiro passo obrigatório**

NÃO comece alterando código.

Primeiro:

1\. analise o estado atual;
2\. mapeie todos os leitores e escritores de \`input/\`;
3\. mapeie todos os leitores e escritores de \`reports/\`;
4\. identifique quais reports são consumidos posteriormente;
5\. identifique quais dados precisam migrar para \`validation-baseline\`;
6\. analise impacto no \`final-regression-validator\`;
7\. analise impacto no \`runFullPipeline\`;
8\. analise impacto nas features isoladas do menu;
9\. analise especificamente a semântica atual da opção 7 e a separação alvo/referência;
10\. analise onde a nova camada de findings deve consumir resultados existentes sem duplicar analyzers;
11\. analise impacto nos testes;
12\. atualize o documento de plano com os novos milestones.

Depois apresente:

\* diagnóstico;
\* riscos;
\* classificação dos reports atuais;
\* arquitetura proposta;
\* milestones finais;
\* arquivos provavelmente afetados.

Pare nesse ponto e aguarde aprovação antes de implementar R1/R2 ou qualquer alteração executável.

Não faça commit.

---

# 28. Status final da execução R1-R11

Atualizado em 2026-08-12.

## Milestones

- R1 ✅ Diagnóstico de paths, reports e contratos.
- R2 ✅ Nova estrutura de input:
  - `input/books/`
  - `input/reference-files/`
  - `input/validation-baseline/`
  - opção 7 separando alvo e referência.
- R3 ✅ Baseline persistente de validação em `input/validation-baseline/expected-structure.json`.
- R4 ✅ `ReportContext`, `runDir`, `data/run.json` e um contexto por operação.
- R5 ✅ JSONs técnicos migrados para `reports/<runId>/data/`.
- R6 ✅ `report.html` consolidado, offline e autocontido.
- R7 ✅ Camada comum de findings, severidade e próximas ações.
- R8 ✅ Integração do HTML com pipeline/features por `ReportContext`.
- R9 ✅ Submenu "Ver relatórios" por execuções, lendo `data/run.json`.
- R10 ✅ Limpeza segura de `reports/`, com confirmação explícita e proteções de symlink.
- R11 ✅ Regressão final completa.

## Gates confirmados no R11

- `npm test`: 144/144 testes passando.
- `git diff --check`: limpo.
- Contratos de `npm start` cobrem:
  - 0 EPUB em `input/books/`;
  - 1 EPUB em `input/books/`;
  - múltiplos EPUBs em `input/books/`;
  - EPUB em `input/reference-files/` não conta como livro processável;
  - PDF opcional em `input/reference-files/`.
- `npm start` no workspace real falhou corretamente porque os EPUBs reais ainda estão diretamente em `input/`, não em `input/books/`.
- Regressão final usa baseline persistente e não depende de JSONs antigos em `reports/`.
- `reports/` pode ser limpo sem apagar `input/`, `output/` ou baseline.
- `ReportContext` gera um único `reports/<runId>/` por operação.
- `run.json` registra `runId`, `startedAt`, `finishedAt`, `operation`, `operationLabel`, `status`, `inputs` e `output`.
- JSONs técnicos são gravados em `reports/<runId>/data/`.
- `report.html` é gerado em `reports/<runId>/report.html`.
- HTML consome `run.json` e os JSONs disponíveis em `data/`, sem reanalisar EPUB.
- Findings alimentam terminal e HTML a partir da mesma camada.
- Submenu de relatórios lista execuções por `data/run.json`.
- Limpeza de reports:
  - cancelar não remove nada;
  - somente `s`/`S` confirma;
  - preserva `reports/.gitkeep`;
  - ignora symlinks dentro de `reports/`;
  - recusa `reports/` como symlink.

## Observação operacional

Os arquivos reais encontrados em 2026-08-12 ainda estão em:

```text
input/
├── The Emperor's Strategy - Tais Mello.epub
├── novel capitulos 1 a 60 - ch.epub
└── novel capitulos 61 a 120 - ch.epub
```

Pela nova semântica, eles devem ser movidos manualmente para:

```text
input/books/
```

Referências EPUB/PDF/DOCX futuras devem ficar em:

```text
input/reference-files/
```

Enquanto `input/books/` estiver vazio, `npm start` deve falhar com:

```text
Nenhum arquivo .epub encontrado em input/books/.
```

Esse comportamento foi confirmado no R11.

## Estado final

O bloco R1-R11 está concluído. As próximas evoluções ficam fora deste plano, por exemplo:

- adapter DOCX real para Reference Source;
- naming/output canônico;
- validação final com todas as partes reais já movidas para `input/books/`.

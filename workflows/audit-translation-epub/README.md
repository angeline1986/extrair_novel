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

O fluxo principal do menu executa:

```txt
1. auditoria da traducao atual
2. geracao de input-fixed/vN/*.epub com correcoes seguras
3. publicacao em output/
4. reauditoria do EPUB publicado
```

As correcoes automaticas sao conservadoras: o script edita apenas nos de texto dos XHTMLs e so aplica trocas declaradas no bloco inicial do log, como `mana stones -> pedras de mana`.

Tambem e possivel passar caminhos explicitos:

```bash
npm run audit:translation:epub -- --source=livro-en.epub --translated=livro-pt.epub --log=log-traducao.txt
```

## Formato recomendado do TXT

O log aceita texto livre, mas aproveita melhor linhas estruturadas:

```txt
Termos: Winterfield, Duke, mana, Rift
Nomes: Cael, Mirella, House Ardent
Problema: revisar tratamento formal nos dialogos do duque
mana stones -> pedras de mana
Rift -> Fenda
```

O auditor usa esse arquivo para:

- verificar termos importantes citados no log;
- conferir trocas `forma antiga -> forma recomendada`;
- registrar avisos e pendencias no relatorio;
- enriquecer o JSON final com os insumos da traducao.

## Saidas

```txt
logs/workflow-events.jsonl
logs/json/audit-report-*.json
logs/txt/epub-audit-summary-latest.txt
logs/html/audit-dashboard-latest.html
logs/html/validation-report-latest.html
input-fixed/manifest.json
```

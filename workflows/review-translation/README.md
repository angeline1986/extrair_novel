# Analyze Translation

Fluxo para análise e correção de tradução.

## Uso

- `npm run analyze:translation -- analisar --project=nome_do_projeto`
- `npm run analyze:translation -- corrigir --project=nome_do_projeto`

## Pastas

- `projects/` — configurações JSON por obra
- `input/` — arquivos originais e traduzidos para análise
- `output/` — todos os DOCX corrigidos são gerados aqui
- `reports/` — todos os relatórios de revisão são gerados aqui

## Configuração de Projeto

Cada arquivo em `projects/` deve seguir o formato:

```json
{
  "projectName": "Nome da Obra",
  "characters": [
    { "name": "Nome", "gender": "masculino" }
  ],
  "customGlossary": {
    "Termo Errado": "Termo Correto"
  },
  "expressionRules": [
    {
      "regex": "\\bexpressao literal\\b",
      "problem": "Descrição",
      "suggestion": "Correção"
    }
  ]
}
```

O script executável vive em `scripts/analyzeTranslation.js`. A pasta antiga `src/translation/` foi removida para evitar duplicação com `src/core/`.

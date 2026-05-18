# Audit Translation DOCX Tests

Esta pasta contém testes para o workflow `workflows/audit-translation-docx`.

## Estrutura

- `unit/` - testes de unidade para funções específicas do workflow.
- `regression/` - cobertura de regressão para comportamentos críticos, como evolução incremental de versões.
- `workflow/` - cenários de fluxo mais alto que verificam a execução passo a passo.

## Executar testes

No diretório raiz do repositório:

```bash
npm install
npm run test:audit
```

## Observações

- O `jest.config.js` na raiz do workflow configura Jest para ESM.
- Arquivos `*.test.js` podem ser adicionados em qualquer subpasta de `test/`.
- Use `test.todo()` para lembrar itens de teste que ainda precisam ser implementados.

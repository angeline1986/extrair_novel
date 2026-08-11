# Review Queue EPUB

Este arquivo documenta como revisar manualmente `state/review-queue.json`.

## Quando Usar

A review queue guarda itens que o pipeline nao deve aplicar sozinho: `auto_review` e `manual_only`.

Use essa fila para decidir manualmente se um item deve ser:

- mantido pendente;
- aprovado com uma troca explicita;
- rejeitado;
- marcado como precisando de mais contexto.

## Status Permitidos

```txt
pending
approved
rejected
needs_context
```

- `pending`: ainda nao revisado. Nunca e aplicado.
- `approved`: pode ser aplicado pelo `fixEpub`, desde que tenha campos obrigatorios validos.
- `rejected`: revisado e rejeitado. Nunca e aplicado.
- `needs_context`: precisa de mais contexto antes de decidir. Nunca e aplicado.

## Campos Obrigatorios Para Approved

Um item `approved` precisa ter:

```txt
before
after
filePath
nodeId
paragraphIndex
textNodeIndex
```

`before` e `after` devem ser diferentes. O `fixEpub` valida esses campos antes de aplicar qualquer item aprovado.

## Exemplo De Item Approved

```json
{
  "id": "rq-0001",
  "actionId": "cp-0002",
  "candidateId": "cand-0002",
  "type": "gender_agreement_review",
  "mode": "auto_review",
  "status": "approved",
  "filePath": "1/OEBPS/Text/0027_Chapter_27.xhtml",
  "nodeId": "s0029-p0056-t0000",
  "paragraphIndex": 56,
  "textNodeIndex": 0,
  "before": "Ele revirou os olhos",
  "after": "Ela revirou os olhos",
  "confidence": 0.55,
  "review": {
    "approvedBy": "manual",
    "reviewedAt": "2026-05-25T02:40:00Z",
    "notes": "Contexto confirma personagem feminina."
  }
}
```

## Exemplo De Item Rejected

```json
{
  "id": "rq-0002",
  "actionId": "cp-0003",
  "candidateId": "cand-0003",
  "type": "gender_agreement_review",
  "mode": "auto_review",
  "status": "rejected",
  "filePath": "1/OEBPS/Text/0054_Chapter_54.xhtml",
  "nodeId": "s0056-p0024-t0000",
  "before": null,
  "after": null,
  "confidence": 0.55,
  "review": {
    "approvedBy": "manual",
    "reviewedAt": "2026-05-25T02:42:00Z",
    "notes": "Falso positivo; trecho esta correto."
  }
}
```

## Validar A Fila

Depois de editar `state/review-queue.json`, rode:

```bash
npm run review:translation:epub:validate
```

Se houver item `approved` sem `before`, `after`, `filePath`, `nodeId` ou indices XHTML validos, o comando falha.

## Aplicar Aprovadas

Depois de validar:

```bash
npm run fix:translation:epub
```

O `fixEpub` aplica somente itens `approved` validos. Itens `pending`, `rejected` e `needs_context` continuam ignorados e aparecem no `correction-report.json`.


--------------------------------------

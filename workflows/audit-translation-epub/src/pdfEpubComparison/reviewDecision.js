function quotedOptions(value) {
  return [...String(value || '').matchAll(/"([^"]+)"/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function isManualCheck(item) {
  return /^(verificar|validar|conferir|avaliar)\b/i.test(String(item?.recommendation || '').trim());
}

function stripChapterPrefix(value) {
  return String(value || '').replace(/^\s*\d+[.)]?\s*/, '').trim();
}

function isTitleItem(item) {
  return /t[ií]tulo/i.test(`${item?.location || ''} ${item?.type || ''}`);
}

export function replacementForDecision(item, replacementText) {
  const to = String(replacementText || '').trim();
  if (!to) return null;

  if (isTitleItem(item)) {
    const chapter = String(item.chapter || '').trim();
    const title = stripChapterPrefix(to);
    return {
      from: String(item.translation || '').trim(),
      to: chapter && /^\d+$/.test(chapter) ? `${chapter}. ${title}` : title,
    };
  }

  const from = item.problematicTerm || item.sourceTerm || item.original;
  if (!from) return null;
  return { from: String(from).trim(), to };
}

export function decisionOptionsForItem(item) {
  const quoted = quotedOptions(item.recommendation);
  const options = [{ key: '1', action: 'keep', label: `Manter como esta (${item.problematicTerm || item.original || 'texto atual'})` }];

  if (quoted.length > 1 || isManualCheck(item)) {
    quoted.forEach((value, index) => {
      options.push({ key: String(index + 2), action: 'apply', label: `Trocar por "${value}"`, replacement: value });
    });
    options.push({ key: String(options.length + 1), action: 'manual', label: 'Editar manualmente' });
  } else if (quoted.length === 1) {
    options.push({ key: '2', action: 'apply', label: `Aplicar sugestao (${quoted[0]})`, replacement: quoted[0] });
    options.push({ key: '3', action: 'manual', label: 'Editar manualmente' });
  } else {
    options.push({ key: '2', action: 'manual', label: 'Editar manualmente' });
  }

  options.push({ key: 'P', action: 'skip', label: 'Pular' });
  options.push({ key: 'V', action: 'back', label: 'Voltar' });
  options.push({ key: 'S', action: 'exit', label: 'Sair' });
  return options;
}

export function applyReviewDecision(item, decision, now = new Date().toISOString()) {
  if (decision.action === 'keep') {
    item.status = 'rejected';
    item.review = { ...(item.review || {}), approvedBy: null, reviewedAt: now, notes: 'Mantido como esta pelo menu PDF x EPUB.' };
  } else if (decision.action === 'apply') {
    item.status = 'approved';
    item.review = {
      ...(item.review || {}),
      approvedBy: 'menu_pdf_epub_review',
      reviewedAt: now,
      notes: 'Correcao PDF x EPUB aprovada pelo menu.',
      replacement: replacementForDecision(item, decision.replacement),
    };
  }
  item.updatedAt = now;
}

function quotedOptions(value) {
  return [...String(value || '').matchAll(/"([^"]+)"/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function isManualCheck(item) {
  return /^(verificar|validar|conferir|avaliar)\b/i.test(String(item?.recommendation || '').trim());
}

function directRecommendation(item) {
  const value = String(item?.recommendation || '').trim();
  if (!value || isManualCheck(item)) return null;
  if (/[.!?]\s+\p{Lu}/u.test(value)) return null;
  if (value.length > 80) return null;
  return value;
}

function masculineSuggestion(item) {
  if (!/masculino/i.test(String(item?.recommendation || ''))) return null;
  const term = String(item?.problematicTerm || item?.original || '').trim().toLowerCase();
  return {
    ela: 'ele',
    dela: 'dele',
    delas: 'deles',
    nela: 'nele',
    nelas: 'neles',
    'la': 'lo',
    'lá': 'lo',
    sozinha: 'sozinho',
    preocupada: 'preocupado',
    cansada: 'cansado',
    irritada: 'irritado',
    envergonhada: 'envergonhado',
    nervosa: 'nervoso',
    focada: 'focado',
  }[term] || null;
}

function recommendationAlternatives(item) {
  const value = String(item?.recommendation || '').trim();
  const match = value.match(/\b(?:significa|pede)\s+(.+?)\.?$/iu);
  if (!match) return [];
  return match[1]
    .split(/\s*,\s*|\s+ou\s+/iu)
    .map((option) => option.replace(/^forma de tratamento$/iu, 'tratamento').trim())
    .filter((option) => option && option.length <= 40);
}

function stripChapterPrefix(value) {
  return String(value || '').replace(/^\s*\d+[.)]?\s*/, '').trim();
}

function capitalizeTitle(value) {
  return String(value || '').replace(/^(\s*)(\p{L})/u, (match, prefix, first) => `${prefix}${first.toLocaleUpperCase('pt-BR')}`);
}

function cleanTitleDecision(value) {
  const clean = String(value || '')
    .split(';')[0]
    .replace(/,\s*se o cap[ií]tulo\b.*$/iu, '')
    .replace(/\bconfirmar\b.*$/iu, '')
    .replace(/\bconforme\b.*$/iu, '')
    .trim();
  return capitalizeTitle(clean);
}

function titleTextFromItem(item) {
  const values = [item.translation, item.location, item.original];
  const titleValue = values.find((value) => /\d+[.)]\s*/.test(String(value || '')));
  return String(titleValue || item.translation || '').replace(/^.*?(\d+[.)]\s*)/u, '$1').trim();
}

function isTitleItem(item) {
  return /t[ií]tulo/i.test(`${item?.location || ''} ${item?.type || ''}`);
}

function keepLabelText(item, isTitle) {
  if (isTitle && /^\s*\d+[.)]?\s+/.test(String(item?.original || ''))) {
    return item.original;
  }
  return isTitle ? titleTextFromItem(item) : (item.translation || item.problematicTerm || item.original || 'texto atual');
}

export function replacementForDecision(item, replacementText) {
  const to = (isTitleItem(item) ? cleanTitleDecision(replacementText) : String(replacementText || '').trim());
  if (!to) return null;

  if (isTitleItem(item)) {
    const currentTitle = titleTextFromItem(item);
    const chapterMatch = currentTitle.match(/^(\d+[.)]\s*)/);
    const title = stripChapterPrefix(to);
    return {
      from: currentTitle || String(item.translation || '').trim(),
      to: chapterMatch ? `${chapterMatch[1]}${title}` : title,
    };
  }

  const from = item.problematicTerm || item.sourceTerm || item.original;
  if (!from) return null;
  return { from: String(from).trim(), to };
}

export function decisionOptionsForItem(item) {
  const isTitle = isTitleItem(item);
  const direct = directRecommendation(item) || masculineSuggestion(item);
  const explicitOptions = quotedOptions(item.recommendation);
  const alternatives = recommendationAlternatives(item);
  const quoted = (explicitOptions.length ? explicitOptions : alternatives.length ? alternatives : [direct])
    .map((value) => isTitle ? cleanTitleDecision(value) : value)
    .filter(Boolean);
  const currentText = keepLabelText(item, isTitle);
  const options = [{ key: '1', action: 'keep', label: `Manter como esta (${currentText})` }];

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

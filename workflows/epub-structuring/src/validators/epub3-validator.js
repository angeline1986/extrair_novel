export function validateEpub3(structureReport, chapterReport, tocReport, languageReport) {
  const issues = [];
  if (!structureReport.summary.opfPath) issues.push(error('MISSING_OPF', 'OPF não localizado.'));
  if (structureReport.summary.htmlItems === 0) issues.push(error('NO_HTML', 'Nenhum XHTML/HTML encontrado.'));
  if (structureReport.summary.spineItems === 0) issues.push(error('NO_SPINE', 'Spine vazio.'));
  if (chapterReport.chapterCount === 0) issues.push(error('NO_CHAPTERS', 'Nenhum capítulo válido detectado.'));
  if (!tocReport.hasNcx) issues.push(warn('NO_NCX_SOURCE', 'NCX original ausente; será criado.'));
  if (!languageReport.match) {
    issues.push(warn('LANGUAGE_MISMATCH', `Metadado ${languageReport.metadataLanguage}; detectado ${languageReport.detectedLanguage}.`));
  }
  if (chapterReport.sequence.missingChapters.length && !chapterReport.canonicalMapActive) {
    issues.push(error('MISSING_CHAPTERS', `Capítulos ausentes: ${chapterReport.sequence.missingChapters.join(', ')}.`));
  }
  if (chapterReport.canonicalMapActive && chapterReport.chapterCount !== 25) {
    issues.push(warn('CANONICAL_COUNT_MISMATCH', `Mapa canônico ativo com ${chapterReport.chapterCount} capítulos.`));
  }
  const broken = chapterReport.documents.filter((doc) => doc.role === 'broken-chapter');
  if (broken.length && !chapterReport.canonicalMapActive) {
    issues.push(error('BROKEN_CHAPTERS', `${broken.length} documentos parecem capítulos sem título válido.`));
  }
  const invalid = chapterReport.documents.filter((doc) => doc.titleQuality?.quality === 'invalid' && doc.titleSource !== 'canonical');
  if (invalid.length) issues.push(warn('INVALID_TITLES', `${invalid.length} documentos com título inválido.`));
  const suspicious = chapterReport.documents.filter((doc) => doc.titleQuality?.quality === 'suspicious' && doc.titleSource !== 'canonical');
  if (suspicious.length) issues.push(warn('SUSPICIOUS_TITLES', `${suspicious.length} documentos com título suspeito.`));
  return { generatedAt: new Date().toISOString(), target: 'EPUB 3.0', ok: !issues.some((issue) => issue.level === 'error'), issueCount: issues.length, issues };
}

function error(code, message) {
  return { level: 'error', code, message };
}

function warn(code, message) {
  return { level: 'warning', code, message };
}

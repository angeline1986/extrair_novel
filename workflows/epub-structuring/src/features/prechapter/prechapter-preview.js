export function formatPrechapterPreview(result) {
  const lines = [];
  lines.push('');
  lines.push('Arquivo:');
  lines.push(result.sourceFile);
  lines.push('');

  if (result.target) {
    lines.push('Boundary detectado:');
    lines.push(`${result.target.href}${result.target.anchor ? `#${result.target.anchor}` : ''}`);
    lines.push('');
    lines.push('Fonte do boundary:');
    lines.push(result.boundarySource || '(não identificada)');
    lines.push('');
    lines.push('Título:');
    lines.push(result.target.title || '(sem título)');
    lines.push('');
    lines.push('Capítulo detectado:');
    lines.push(result.target.chapterNumber === null || result.target.chapterNumber === undefined ? '(não identificado)' : String(result.target.chapterNumber));
    lines.push('');
  }

  lines.push('Confiança:');
  lines.push(result.confidence.toUpperCase());
  lines.push('');
  lines.push('Sinais:');
  if (result.signals.length) {
    for (const signal of result.signals) lines.push(`- ${signal}`);
  } else {
    lines.push('- nenhum');
  }
  lines.push('');
  lines.push('Conteúdo anterior ao boundary:');
  lines.push('');

  if (result.preBoundary.elements.length) {
    result.preBoundary.elements.forEach((element, index) => {
      lines.push(`[${index + 1}] ${element.html}`);
    });
  } else {
    lines.push('(nenhum)');
  }

  lines.push('');
  lines.push('Status:');
  lines.push(result.status);
  lines.push('');

  if (result.warnings.length) {
    lines.push('Avisos:');
    for (const warning of result.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }

  lines.push('Nenhuma alteração foi realizada.');
  return lines.join('\n');
}

import { formatNumber } from './htmlUtils.js';

function textLine(label, value) {
  return `${label}: ${value || '-'}`;
}

function findingToText(finding) {
  return [
    textLine('Severidade', finding.severity),
    textLine('Capitulo', finding.chapter),
    textLine('Tipo', finding.type),
    textLine('Original PDF', finding.original),
    textLine('Traducao EPUB', finding.translation),
    textLine('Problema', finding.problem),
    textLine('Recomendacao', finding.recommendation),
    textLine('Frase/local', finding.location),
  ].join('\n');
}

export function buildPdfEpubComparisonFullText(audit) {
  const lines = [];
  lines.push('RELATORIO COMPLETO PDF x EPUB');
  lines.push(`Gerado em: ${audit?.generatedAt || new Date().toISOString()}`);
  lines.push('');
  lines.push(textLine('PDF original', audit?.inputs?.pdf?.filename));
  lines.push(textLine('EPUB analisado', audit?.inputs?.epub?.filename));
  lines.push(textLine('Total de achados', formatNumber(audit?.summary?.totalFindings || 0)));
  lines.push(textLine('Capitulos PDF analisados', formatNumber(audit?.summary?.pdfChapters || 0)));
  lines.push(textLine('Capitulos EPUB analisados', formatNumber(audit?.summary?.epubChapters || 0)));
  lines.push('');
  lines.push('Observacao: este TXT lista todos os achados registrados no JSON completo.');

  for (const category of audit?.categories || []) {
    lines.push('');
    lines.push('='.repeat(80));
    lines.push(`${category.label} - ${formatNumber(category.count)} achado(s)`);
    lines.push(category.description || '');
    lines.push('='.repeat(80));

    const findings = category.findings || [];
    if (!findings.length) {
      lines.push('Nenhum achado nesta categoria.');
      continue;
    }

    findings.forEach((finding, index) => {
      lines.push('');
      lines.push(`#${index + 1}`);
      lines.push(findingToText(finding));
    });
  }

  return `${lines.join('\n')}\n`;
}

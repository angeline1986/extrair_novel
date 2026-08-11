export function formatMergePrecheck(report) {
  const lines = [];
  lines.push('');
  lines.push('PRECHECK PARA MERGE');
  lines.push('');
  lines.push('#  Arquivo  Primeiro  Último  Qtde  Fonte');
  report.orderedSources.forEach((source, index) => {
    lines.push(`${index + 1}  ${source.sourceFile}  ${value(source.firstChapter)}  ${value(source.lastChapter)}  ${source.chapterCount || 0}  ${source.rangeSource}`);
  });
  lines.push('');
  lines.push('Validação:');
  lines.push(report.errors.length ? '✗ Bloqueios encontrados' : '✓ Ordem analisada');
  lines.push(report.gaps.length ? `⚠ Gaps: ${report.gaps.length}` : '✓ Sem gaps');
  lines.push(report.overlaps.length ? `✗ Overlaps: ${report.overlaps.length}` : '✓ Sem overlaps');
  lines.push(report.duplicates.length ? `✗ Duplicados: ${report.duplicates.length}` : '✓ Sem duplicados');
  lines.push(report.metadataDifferences.length ? `⚠ Metadados: ${report.metadataDifferences.length} divergência(s)` : '✓ Metadados consistentes');
  lines.push(report.resourceCollisions.length ? `⚠ Assets: ${report.resourceCollisions.length} path(s) repetidos` : '✓ Sem colisões de assets');
  lines.push('');
  lines.push('Status:');
  lines.push(report.status.toUpperCase());
  lines.push('');
  lines.push('Nenhum EPUB foi alterado.');
  return lines.join('\n');
}

function value(input) {
  return input === null || input === undefined ? '-' : String(input);
}

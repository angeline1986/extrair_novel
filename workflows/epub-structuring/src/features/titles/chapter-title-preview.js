export function formatChapterTitlePreview(analysis, limit = 8) {
  const lines = [
    `Títulos analisados: ${analysis.chapterCount}`,
    `Consistentes: ${analysis.unchanged}`,
    `Inconsistentes: ${analysis.changed}`
  ];
  const examples = analysis.items.filter((item) => item.changed).slice(0, limit);
  if (examples.length) {
    lines.push('', 'Exemplos:');
    for (const item of examples) {
      lines.push(`${item.before}`);
      lines.push(`→ ${item.after}`);
    }
  }
  return lines.join('\n');
}

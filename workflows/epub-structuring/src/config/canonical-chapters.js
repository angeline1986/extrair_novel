export const KNOWN_CANONICAL_BOOKS = [
  {
    id: 'bebe-accidental',
    language: 'es',
    match: [/beb[eé] accidental/i, /ilide\.info-bebe-accidental/i],
    chapters: [
      ...volume(1, 1, ['Embarazo', 'Reunión', 'Malentendido', 'Náuseas matutinas', 'Viaje de negocios', 'Jeongwoon']),
      ...volume(2, 7, ['Verdad', 'Contratos', 'Rumores', 'Materiales', 'Noticias', 'Perturbación']),
      ...volume(3, 13, ['Agitación', 'Celos', 'Cambiar']),
      ...volume(4, 16, ['Introducción', 'Fuga de agua', 'Viento', 'Crack', 'Consecuencia']),
      ...volume(5, 21, ['Reconocimiento', 'Historia de amor', 'Promesa', 'Reunión', 'Matrimonio'])
    ]
  }
];

export function findKnownCanonicalBook({ epub, pdfPath, pdfText }) {
  const haystack = [epub?.opf?.metadata?.title, epub?.sourcePath]
    .filter(Boolean)
    .join('\n');
  return KNOWN_CANONICAL_BOOKS.find((book) => book.match.some((pattern) => pattern.test(haystack))) || null;
}

function volume(volumeNumber, firstChapter, titles) {
  return titles.map((title, index) => ({ volume: volumeNumber, chapterNumber: firstChapter + index, title }));
}

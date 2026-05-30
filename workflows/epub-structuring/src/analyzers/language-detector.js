const MARKERS = {
  es: [' el ', ' la ', ' los ', ' las ', ' de ', ' que ', ' embarazo ', ' capítulo ', ' una ', ' para '],
  pt: [' o ', ' a ', ' os ', ' as ', ' de ', ' que ', ' gravidez ', ' capítulo ', ' uma ', ' para '],
  en: [' the ', ' and ', ' of ', ' to ', ' chapter ', ' pregnancy ', ' with ', ' for ']
};

export function detectLanguage(epub, htmlDocs) {
  const sample = htmlDocs.map((doc) => doc.bodyTextPreview || '').join(' ').toLowerCase().slice(0, 20000);
  const scores = Object.fromEntries(Object.entries(MARKERS).map(([lang, markers]) => {
    return [lang, markers.reduce((total, marker) => total + count(sample, marker), 0)];
  }));

  const detectedLanguage = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const metadataLanguage = normalizeLang(epub.opf.metadata.language);
  const match = !metadataLanguage || !detectedLanguage || metadataLanguage === detectedLanguage;

  return { generatedAt: new Date().toISOString(), metadataLanguage, detectedLanguage, match, scores };
}

function count(text, marker) {
  return text.split(marker).length - 1;
}

function normalizeLang(value) {
  return String(value || '').toLowerCase().split('-')[0] || null;
}

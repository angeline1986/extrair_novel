export function detectLanguage(epub, htmlDocs) {
  const metadataLanguage = epub.opf.metadata.language || null;
  const sample = htmlDocs.map((doc) => doc.text).join('\n').slice(0, 50000).toLowerCase();
  const detectedLanguage = guessLanguage(sample);
  return {
    generatedAt: new Date().toISOString(),
    metadataLanguage,
    detectedLanguage,
    match: !metadataLanguage || !detectedLanguage || metadataLanguage.split('-')[0] === detectedLanguage,
    warning: metadataLanguage && detectedLanguage && metadataLanguage.split('-')[0] !== detectedLanguage
  };
}

function guessLanguage(text) {
  const es = count(text, [' que ', ' de ', ' el ', ' la ', ' los ', ' las ', ' una ', ' está ', ' dijo ', ' pero ', ' para ']);
  const pt = count(text, [' que ', ' de ', ' o ', ' a ', ' os ', ' as ', ' uma ', ' está ', ' disse ', ' mas ', ' para ']);
  if (es === 0 && pt === 0) return null;
  return es >= pt ? 'es' : 'pt';
}

function count(text, tokens) {
  return tokens.reduce((sum, token) => sum + (text.split(token).length - 1), 0);
}

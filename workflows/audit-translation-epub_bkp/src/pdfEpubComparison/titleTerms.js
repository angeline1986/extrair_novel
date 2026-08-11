import { normalizeComparable, stripChapterNumber } from './textUtils.js';

export const TITLE_TRANSLATION_HINTS = new Map([
  ['embarazo', 'gravidez'],
  ['reunion', 'Reencontro'],
  ['malentendido', 'mal-entendido'],
  ['nauseas matutinas', 'Enjoos matinais'],
  ['viaje de negocios', 'viagem de negócios'],
  ['verdad', 'A Verdade'],
  ['contrato', 'Contrato ou Contratos, conforme o conteúdo do capítulo'],
  ['contratos', 'Contrato ou Contratos, conforme o conteúdo do capítulo'],
  ['rumores', 'rumores'],
  ['tratamiento', 'Tratamento'],
  ['noticias', 'notícias'],
  ['perturbacion', 'Abalo ou Perturbação, conforme o tom emocional'],
  ['agitacion', 'Tumulto ou Agitação, conforme o tom emocional'],
  ['rimas infantiles', 'cantigas de ninar'],
  ['celos', 'ciúme'],
  ['cambiar', 'Mudança'],
  ['introduccion', 'Apresentação'],
  ['fuga de agua', 'Vazamento'],
  ['viento', 'vento'],
  ['crack', 'Ruptura, Quebra ou Rachadura; evitar manter "Crack" em português'],
  ['grieta', 'Ruptura, Quebra ou Rachadura, conforme o contexto'],
  ['conclusion', 'conclusão'],
  ['consecuencia', 'Consequências'],
  ['promesa', 'promessa'],
  ['reconocimiento', 'Aceitação, Reconciliação ou Reconhecimento; verificar contexto'],
  ['historia de amor', 'História de Amor'],
  ['matrimonio', 'casamento'],
]);

export const SPANISH_TO_PORTUGUESE_TERMS = new Map([
  ['embarazo', 'gravidez'],
  ['reunión', 'Reencontro'],
  ['reunion', 'Reencontro'],
  ['malentendido', 'mal-entendido'],
  ['náuseas', 'enjoos'],
  ['nauseas', 'enjoos'],
  ['matutinas', 'matinais'],
  ['náuseas matutinas', 'Enjoos matinais'],
  ['nauseas matutinas', 'Enjoos matinais'],
  ['viaje', 'viagem'],
  ['negocios', 'negócios'],
  ['verdad', 'A Verdade'],
  ['contratos', 'Contrato ou Contratos, conforme o conteúdo'],
  ['tratamiento', 'Tratamento'],
  ['noticias', 'notícias'],
  ['perturbación', 'Abalo ou Perturbação, conforme o tom emocional'],
  ['perturbacion', 'Abalo ou Perturbação, conforme o tom emocional'],
  ['agitación', 'Tumulto ou Agitação, conforme o tom emocional'],
  ['agitacion', 'Tumulto ou Agitação, conforme o tom emocional'],
  ['rimas', 'rimas/cantigas'],
  ['infantiles', 'infantis/de ninar'],
  ['celos', 'ciúme'],
  ['cambiar', 'Mudança'],
  ['introducción', 'Apresentação'],
  ['introduccion', 'Apresentação'],
  ['fuga de agua', 'Vazamento'],
  ['viento', 'Vento'],
  ['crack', 'Ruptura, Quebra ou Rachadura; evitar manter "Crack" em português'],
  ['grieta', 'Ruptura, Quebra ou Rachadura, conforme o contexto'],
  ['conclusión', 'conclusão'],
  ['conclusion', 'conclusão'],
  ['consecuencia', 'Consequências'],
  ['promesa', 'promessa'],
  ['reconocimiento', 'Aceitação, Reconciliação ou Reconhecimento; verificar contexto'],
  ['historia de amor', 'História de Amor'],
  ['matrimonio', 'Casamento'],
]);

export const SPANISH_PHRASE_RECOMMENDATIONS = new Map([
  ['dio un paso atras', 'deu um passo atrás'],
  ['un paso atras', 'um passo atrás'],
]);

export function expectedTitleTranslation(pdfTitle) {
  const normalized = normalizeComparable(stripChapterNumber(pdfTitle));
  for (const [source, target] of TITLE_TRANSLATION_HINTS.entries()) {
    if (normalized.includes(source)) return target;
  }
  return null;
}

export function recommendationAlternatives(recommendation) {
  return String(recommendation || '')
    .split(';')[0]
    .replace(/\bconforme\b.*$/iu, '')
    .replace(/\bconfirmar\b.*$/iu, '')
    .replace(/\bse o capítulo\b.*$/iu, '')
    .trim()
    .split(/\s+ou\s+|,/iu)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

export function titleSatisfiesRecommendation(title, recommendation) {
  const normalizedTitle = normalizeComparable(title);
  return recommendationAlternatives(recommendation)
    .some((alternative) => normalizedTitle.includes(normalizeComparable(alternative)));
}

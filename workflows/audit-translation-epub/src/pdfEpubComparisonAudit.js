import {
  findResidualSpanishPhrases,
  isCommonWord,
  isStrongLanguageMarker,
  normalizeComparableText,
  normalizeLexiconWord,
  SPANISH_STRONG_MARKERS,
  tokenizeLexiconText,
} from './languageLexicons.js';
import { normalizeEntityAliasEntries } from './correction/entityNormalizer.js';
import { normalizeTermEntries } from './correction/terminologyNormalizer.js';

const MAX_FINDINGS_PER_CATEGORY = 40;
const MAX_EXAMPLES_PER_CATEGORY = 12;

const TITLE_TRANSLATION_HINTS = new Map([
  ['embarazo', 'gravidez'],
  ['reunion', 'Reencontro'],
  ['malentendido', 'mal-entendido'],
  ['nauseas matutinas', 'Enjoos matinais'],
  ['viaje de negocios', 'viagem de negócios'],
  ['verdad', 'A Verdade'],
  ['contrato', 'Contrato ou Contratos, conforme o conteúdo do capítulo'],
  ['contratos', 'Contrato ou Contratos, conforme o conteúdo do capítulo'],
  ['rumores', 'rumores'],
  ['tratamiento', 'Tratamento; confirmar se é tratamento médico ou forma de tratamento'],
  ['noticias', 'notícias'],
  ['perturbacion', 'Abalo ou Perturbação, conforme o tom emocional'],
  ['agitacion', 'Tumulto ou Agitação, conforme o tom emocional'],
  ['rimas infantiles', 'cantigas de ninar'],
  ['celos', 'ciúme'],
  ['cambiar', 'Mudança'],
  ['introduccion', 'Apresentação, se o capítulo apresentar alguém'],
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

const SPANISH_TO_PORTUGUESE_TERMS = new Map([
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
  ['tratamiento', 'Tratamento; confirmar se é médico ou forma de tratamento'],
  ['noticias', 'notícias'],
  ['perturbación', 'Abalo ou Perturbação, conforme o tom emocional'],
  ['perturbacion', 'Abalo ou Perturbação, conforme o tom emocional'],
  ['agitación', 'Tumulto ou Agitação, conforme o tom emocional'],
  ['agitacion', 'Tumulto ou Agitação, conforme o tom emocional'],
  ['rimas', 'rimas/cantigas'],
  ['infantiles', 'infantis/de ninar'],
  ['celos', 'ciúme'],
  ['cambiar', 'Mudança'],
  ['introducción', 'Apresentação, se o capítulo apresentar alguém'],
  ['introduccion', 'Apresentação, se o capítulo apresentar alguém'],
  ['fuga', 'vazamento'],
  ['fuga de agua', 'Vazamento'],
  ['agua', 'água'],
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

const SPANISH_PHRASE_RECOMMENDATIONS = new Map([
  ['dio un paso atrás', 'deu um passo atrás'],
  ['dio un paso atras', 'deu um passo atrás'],
  ['un paso atrás', 'um passo atrás'],
  ['un paso atras', 'um passo atrás'],
]);

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function preview(value, limit = 260) {
  const text = compact(value);
  return text.length > limit ? `${text.slice(0, limit - 3).trim()}...` : text;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sentenceContaining(text, needle, limit = 320) {
  const compactText = compact(text);
  if (!needle) return preview(compactText, limit);

  const sentences = compactText
    .split(/(?<=[.!?…])\s+/u)
    .map(compact)
    .filter(Boolean);
  const normalizedNeedle = normalizeComparableText(needle);
  const sentence = sentences.find((item) => normalizeComparableText(item).includes(normalizedNeedle));
  return preview(sentence || compactText, limit);
}

function extractChapterNumber(text) {
  const match = String(text || '').match(/^(\d+)[.)]?\s+\S/);
  return match ? Number(match[1]) : null;
}

function stripChapterNumber(text) {
  return compact(String(text || '').replace(/^\d+[.)]?\s*/, ''));
}

function indexSectionsByChapter(doc) {
  const index = new Map();
  for (const section of doc?.sections || []) {
    const candidates = [
      section.chapterNumber,
      extractChapterNumber(section.title),
      ...(section.headings || []).map(extractChapterNumber),
      ...(section.paragraphs || []).slice(0, 3).map(extractChapterNumber),
    ].filter((value) => Number.isInteger(value));
    if (!candidates.length) continue;
    const chapter = candidates[0];
    if (!index.has(chapter)) index.set(chapter, section);
  }
  return index;
}

function titleForSection(section) {
  const title = compact(section?.title || '');
  if (extractChapterNumber(title)) return title;
  const heading = (section?.headings || []).find((item) => extractChapterNumber(item));
  if (heading) return heading;
  const paragraph = (section?.paragraphs || []).slice(0, 5).find((item) => extractChapterNumber(item));
  return paragraph || title || '-';
}

function chapterLabel(chapter) {
  return Number.isInteger(chapter) ? String(chapter) : '-';
}

function normalizeTitleKey(title) {
  return normalizeComparableText(stripChapterNumber(title));
}

function expectedTitleTranslation(pdfTitle) {
  const normalized = normalizeTitleKey(pdfTitle);
  for (const [source, target] of TITLE_TRANSLATION_HINTS.entries()) {
    if (normalized.includes(source)) return target;
  }
  return null;
}

function titleRecommendationAlternatives(recommendation) {
  const main = String(recommendation || '')
    .split(';')[0]
    .replace(/\bconforme\b.*$/iu, '')
    .replace(/\bconfirmar\b.*$/iu, '')
    .replace(/\bse o capítulo\b.*$/iu, '')
    .trim();

  return main
    .split(/\s+ou\s+|,/iu)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

function titleSatisfiesRecommendation(title, recommendation) {
  const normalizedTitle = normalizeComparableText(title);
  return titleRecommendationAlternatives(recommendation)
    .some((alternative) => normalizedTitle.includes(normalizeComparableText(alternative)));
}

function residualPhraseRecommendation(phrase) {
  return SPANISH_PHRASE_RECOMMENDATIONS.get(normalizeComparableText(phrase)) ||
    'Traduzir a frase residual para PT-BR conforme contexto.';
}

function termFrequency(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

function containsNormalized(text, needle) {
  if (!needle) return false;
  return normalizeComparableText(text).includes(normalizeComparableText(needle));
}

function textHasTerm(text, term) {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
  return pattern.test(String(text || ''));
}

function extractNumbers(value) {
  return [...new Set(String(value || '').match(/\d+(?:[.,]\d+)?/g) || [])];
}

function hasStandaloneNumber(text, number) {
  const pattern = new RegExp(`(^|[^\\d])${escapeRegExp(number)}(?=$|[^\\d])`, 'u');
  return pattern.test(String(text || ''));
}

function extractProperNames(value) {
  const blocked = new Set(['Era', 'Una', 'Uma', 'Ele', 'Ela', 'Para', 'Com', 'Sem', 'Mas', 'Como']);
  return [...new Set(String(value || '').match(/\b[\p{Lu}][\p{L}\p{N}'-]{2,}\b/gu) || [])]
    .filter((item) => {
      if (blocked.has(item)) return false;
      const normalized = normalizeLexiconWord(item);
      if (isCommonWord(normalized, 'es') || isCommonWord(normalized, 'pt')) return false;
      return /-|doih|hyeon|hyun|jeong|woon|taewoon|seon|yumin|yu-min/i.test(item) ||
        /^(do|seo|lee|kim|park|choi|han|kang)$/i.test(item);
    });
}

function missingItems(sourceItems, targetText) {
  const normalizedTarget = normalizeComparableText(targetText);
  return sourceItems.filter((item) => !normalizedTarget.includes(normalizeComparableText(item)));
}

function category(id, label, description, findings) {
  const shown = Math.min(findings.length, MAX_FINDINGS_PER_CATEGORY);
  return {
    id,
    label,
    description,
    count: findings.length,
    shown,
    displayLimit: MAX_FINDINGS_PER_CATEGORY,
    examples: findings.slice(0, MAX_EXAMPLES_PER_CATEGORY),
    findings,
  };
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = [
      finding.chapter,
      finding.type,
      normalizeComparableText(finding.original).slice(0, 80),
      normalizeComparableText(finding.translation).slice(0, 80),
      normalizeComparableText(finding.problem).slice(0, 80),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeFinding({
  chapter,
  type,
  original = '',
  translation = '',
  problem,
  recommendation = 'Validar manualmente no contexto.',
  location = '',
  problematicTerm = '',
  severity = 'medium',
  confidence = 'medium',
}) {
  return {
    chapter: chapterLabel(chapter),
    type,
    original: preview(original, 360),
    translation: preview(translation, 360),
    problem,
    recommendation,
    location: preview(location, 260),
    problematicTerm,
    severity,
    confidence,
    classification: 'heuristic',
  };
}

function detectSemanticIssues(pdfByChapter, epubByChapter, epubDoc) {
  const findings = [];
  const epubFullText = epubDoc?.rawText || '';
  for (const [chapter, pdfSection] of pdfByChapter.entries()) {
    const epubSection = epubByChapter.get(chapter);
    if (!epubSection) continue;
    const pdfText = pdfSection.rawText || '';
    const epubText = epubSection.rawText || '';
    const pdfNumbers = extractNumbers(pdfText).filter((number) => !/^\d$/.test(number));
    const missingNumbers = pdfNumbers
      .filter((number) => !hasStandaloneNumber(epubText, number))
      .filter((number) => !hasStandaloneNumber(epubFullText, number))
      .slice(0, 5);
    if (missingNumbers.length >= 3) {
      for (const number of missingNumbers) {
        findings.push(makeFinding({
          chapter,
          type: 'Possível alteração semântica por número ausente',
          original: sentenceContaining(pdfText, number),
          translation: 'Não encontrado no capítulo traduzido.',
          problem: `O número "${number}" aparece no PDF, mas não foi localizado no EPUB traduzido.`,
          recommendation: 'Conferir se dado, horário, idade ou quantidade foi omitido ou alterado. Números encontrados em outra parte do EPUB não entram neste alerta.',
          location: `PDF: ${sentenceContaining(pdfText, number)}`,
          problematicTerm: number,
          severity: 'high',
        }));
      }
    }
  }
  return dedupeFindings(findings);
}

function detectOmissions(pdfByChapter, epubByChapter) {
  const findings = [];
  for (const [chapter, pdfSection] of pdfByChapter.entries()) {
    const epubSection = epubByChapter.get(chapter);
    if (!epubSection) {
      findings.push(makeFinding({
        chapter,
        type: 'Capítulo ausente',
        original: titleForSection(pdfSection),
        translation: '',
        problem: 'Capítulo identificado no PDF não foi encontrado no EPUB alvo.',
        recommendation: 'Verificar se o capítulo foi omitido, mesclado ou renumerado.',
        location: 'Estrutura de capítulos',
        severity: 'high',
      }));
      continue;
    }

    const ratio = (epubSection.charCount || 0) / Math.max(pdfSection.charCount || 1, 1);
    if (pdfSection.charCount > 3000 && ratio < 0.45) {
      findings.push(makeFinding({
        chapter,
        type: 'Possível omissão estrutural',
        original: titleForSection(pdfSection),
        translation: titleForSection(epubSection),
        problem: `Capítulo do EPUB tem tamanho muito menor que o PDF equivalente (${ratio.toFixed(2)}x).`,
        recommendation: 'Conferir se cenas ou blocos narrativos foram omitidos.',
        location: titleForSection(epubSection),
        severity: 'high',
      }));
    }

    const pdfNames = extractProperNames(pdfSection.rawText).slice(0, 40);
    const missingNames = missingItems(pdfNames, epubSection.rawText || '').slice(0, 6);
    if (missingNames.length >= 4) {
      findings.push(makeFinding({
        chapter,
        type: 'Possível omissão de nomes/entidades',
        original: missingNames.join(', '),
        translation: titleForSection(epubSection),
        problem: 'Vários nomes ou entidades do PDF não aparecem no capítulo correspondente do EPUB.',
        recommendation: 'Validar se houve tradução/romanização esperada ou omissão real.',
        location: titleForSection(epubSection),
      }));
    }
  }
  return dedupeFindings(findings);
}

function detectTerminologyIssues(pdfDoc, epubDoc, glossary = {}) {
  const findings = [];
  const terms = normalizeTermEntries(glossary.terms || { terms: [] });
  const entities = normalizeEntityAliasEntries(glossary.entities || { entities: [] });
  const epubText = epubDoc.rawText || '';
  const epubSections = epubDoc.sections || [];

  for (const entry of [...terms, ...entities]) {
    const sourcePresent = containsNormalized(epubText, entry.from);
    const targetPresent = containsNormalized(epubText, entry.to);
    if (sourcePresent && !targetPresent) {
      findings.push(makeFinding({
        chapter: '-',
        type: 'Termo do glossário não normalizado',
        original: entry.from,
        translation: entry.from,
        problem: 'Forma antiga/original aparece no EPUB, mas a forma recomendada do glossário não foi encontrada.',
        recommendation: `Padronizar para "${entry.to}".`,
        location: 'EPUB completo',
        severity: entry.mode === 'auto_safe' ? 'medium' : 'low',
      }));
    }
  }

  const pdfTokens = termFrequency(tokenizeLexiconText(pdfDoc.rawText || ''));
  const epubTokens = termFrequency(tokenizeLexiconText(epubText));
  for (const [term, recommendation] of SPANISH_TO_PORTUGUESE_TERMS.entries()) {
    const normalized = normalizeLexiconWord(term);
    const epubCount = epubTokens.get(normalized) || 0;
    const pdfCount = pdfTokens.get(normalized) || 0;
    if (epubCount > 0 && pdfCount > 0 && !isCommonWord(normalized, 'pt')) {
      const sectionsWithTerm = epubSections.filter((section) => textHasTerm(section.rawText || section.paragraphs?.join('\n') || '', term));
      const targets = sectionsWithTerm.length ? sectionsWithTerm.slice(0, 6) : [null];

      for (const section of targets) {
        const sectionText = section ? (section.rawText || section.paragraphs?.join('\n') || '') : epubText;
        const chapter = section ? (extractChapterNumber(titleForSection(section)) ?? section.index + 1) : '-';
        const sectionTitle = section ? titleForSection(section) : '';
        const termIsInTitle = sectionTitle && textHasTerm(sectionTitle, term);
        const sentence = termIsInTitle ? sectionTitle : sentenceContaining(sectionText, term);
        const location = termIsInTitle
          ? `Título do capítulo ${chapter}: ${sectionTitle}`
          : sentence;
        findings.push(makeFinding({
          chapter,
          type: 'Termo espanhol ainda presente',
          original: term,
          translation: sentence,
          problem: `Termo espanhol aparece no EPUB traduzido.`,
          recommendation: `Avaliar substituição por "${recommendation}".`,
          location,
          problematicTerm: term,
          severity: isStrongLanguageMarker(normalized, 'es') ? 'high' : 'medium',
        }));
      }
    }
  }

  return dedupeFindings(findings);
}

function detectDriftIssues(pdfByChapter, epubByChapter) {
  const findings = [];
  for (const [chapter, pdfSection] of pdfByChapter.entries()) {
    const epubSection = epubByChapter.get(chapter);
    if (!epubSection) continue;

    const pdfTitle = titleForSection(pdfSection);
    const epubTitle = titleForSection(epubSection);
    const expected = expectedTitleTranslation(pdfTitle);
    if (expected && !titleSatisfiesRecommendation(epubTitle, expected)) {
      findings.push(makeFinding({
        chapter,
        type: 'Divergência de título',
        original: pdfTitle,
        translation: epubTitle,
        problem: 'Título do EPUB não corresponde à tradução esperada do título no PDF.',
        recommendation: `Verificar se o título deveria conter "${expected}".`,
        location: 'Título do capítulo',
        severity: 'high',
      }));
    }

    const ratio = (epubSection.charCount || 0) / Math.max(pdfSection.charCount || 1, 1);
    if (pdfSection.charCount > 3000 && (ratio < 0.55 || ratio > 2.3)) {
      findings.push(makeFinding({
        chapter,
        type: 'Drift estrutural de tamanho',
        original: `${pdfSection.charCount} caracteres no PDF`,
        translation: `${epubSection.charCount} caracteres no EPUB`,
        problem: `Diferença extrema de extensão entre PDF e EPUB (${ratio.toFixed(2)}x).`,
        recommendation: 'Revisar alinhamento e cobertura do capítulo.',
        location: epubTitle,
      }));
    }
  }
  return dedupeFindings(findings);
}

function detectEditorialFindings(epubDoc) {
  const findings = [];
  const seenMarkers = new Set();

  for (const section of epubDoc.sections || []) {
    const chapter = extractChapterNumber(titleForSection(section)) ?? section.index + 1;
    const sectionTitle = titleForSection(section);
    const blocks = [
      { kind: 'Título', text: sectionTitle },
      ...(section.paragraphs || [])
        .filter((text) => normalizeComparableText(text) !== normalizeComparableText(sectionTitle))
        .map((text, index) => ({ kind: `Parágrafo ${index + 1}`, text })),
    ];

    for (const block of blocks) {
      const tokens = tokenizeLexiconText(block.text);
      const markers = [...new Set(tokens.filter((token) =>
        SPANISH_STRONG_MARKERS.has(token) &&
        !isCommonWord(token, 'pt')
      ))];
      const residualPhrases = findResidualSpanishPhrases(block.text);
      if (!markers.length && !residualPhrases.length) continue;

      for (const phrase of residualPhrases) {
        const key = `${chapter}:${phrase}:${block.kind}`;
        if (seenMarkers.has(key)) continue;
        seenMarkers.add(key);
        findings.push({
          chapter: chapterLabel(chapter),
          problematicTerm: phrase,
          sourceTerm: phrase,
          recommended: residualPhraseRecommendation(phrase),
          location: `${block.kind}: ${preview(block.text, 220)}`,
          type: 'Expressão em espanhol residual',
          severity: 'high',
          confidence: 'high',
          classification: 'informative',
        });
      }

      for (const marker of markers) {
        const key = `${chapter}:${marker}:${block.kind}`;
        if (seenMarkers.has(key)) continue;
        seenMarkers.add(key);
        const recommendation = SPANISH_TO_PORTUGUESE_TERMS.get(marker) || SPANISH_TO_PORTUGUESE_TERMS.get(normalizeLexiconWord(marker)) || 'Traduzir para PT-BR conforme contexto.';
        findings.push({
          chapter: chapterLabel(chapter),
          problematicTerm: marker,
          sourceTerm: marker,
          recommended: recommendation,
          location: `${block.kind}: ${preview(block.text, 220)}`,
          type: block.kind === 'Título' ? 'Título em espanhol' : 'Espanhol residual',
          severity: block.kind === 'Título' ? 'high' : 'medium',
          confidence: 'high',
          classification: 'informative',
        });
      }
    }
  }

  return findings;
}

export function buildPdfEpubComparisonAudit({
  pdfDoc,
  epubDoc,
  glossary = {},
  epubTarget = null,
} = {}) {
  const pdfByChapter = indexSectionsByChapter(pdfDoc);
  const epubByChapter = indexSectionsByChapter(epubDoc);

  const semanticFindings = detectSemanticIssues(pdfByChapter, epubByChapter, epubDoc);
  const omissionFindings = detectOmissions(pdfByChapter, epubByChapter);
  const terminologyFindings = detectTerminologyIssues(pdfDoc, epubDoc, glossary);
  const driftFindings = detectDriftIssues(pdfByChapter, epubByChapter);
  const editorialFindings = detectEditorialFindings(epubDoc);

  const categories = [
    category('semantic_issues', 'Semânticos', 'Possíveis alterações de significado entre PDF original e EPUB traduzido.', semanticFindings),
    category('omissions', 'Omissões', 'Possíveis capítulos, blocos ou entidades do PDF ausentes no EPUB.', omissionFindings),
    category('terminology_inconsistency', 'Inconsistência terminológica', 'Termos do glossário ou espanhol residual que ainda aparecem no EPUB.', terminologyFindings),
    category('semantic_drift', 'Drift de sentido', 'Divergências fortes de título, tamanho ou cobertura por capítulo.', driftFindings),
    category('editorial_findings', 'Achados editoriais', 'Termos espanhóis residuais e títulos suspeitos encontrados no EPUB PT-BR.', editorialFindings),
  ];

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    inputs: {
      pdf: pdfDoc ? {
        filePath: pdfDoc.filePath,
        filename: pdfDoc.filename,
        pageCount: pdfDoc.pageCount,
        sections: pdfDoc.sections?.length || 0,
        textBlocks: pdfDoc.textBlockCount || pdfDoc.paragraphCount || 0,
      } : null,
      epub: epubDoc ? {
        filePath: epubDoc.filePath,
        filename: epubDoc.filename,
        sections: epubDoc.sections?.length || 0,
        paragraphs: epubDoc.paragraphCount || 0,
      } : null,
      epubTarget,
    },
    summary: {
      totalFindings: categories.reduce((sum, item) => sum + item.count, 0),
      categories: Object.fromEntries(categories.map((item) => [item.id, item.count])),
      pdfChapters: pdfByChapter.size,
      epubChapters: epubByChapter.size,
    },
    categories,
  };
}

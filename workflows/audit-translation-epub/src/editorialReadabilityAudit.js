import { getLanguageConfig } from './languageConfig.js';

function normalizeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWord(word) {
  return String(word || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function normalizeForCompare(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return String(text || '')
    .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)
    ?.map(normalizeWord)
    .filter(Boolean) || [];
}

function extractChapterNumber(heading) {
  const match = String(heading || '').match(/^(\d+)[.\s]/);
  return match ? match[1] : null;
}

function extractChapterTitle(heading) {
  return normalizeText(String(heading || '').replace(/^\d+[.)]?\s*/, ''));
}

const PORTUGUESE_COMMON_WORDS = new Set(`
a ao aos as o os um uma uns umas de da das do dos em na nas no nos por para com sem sob sobre entre
e ou mas que se como quando enquanto porque pois então tambem também nao não sim ja já ate até apos após antes depois
ele ela eles elas eu tu voce você voces vocês meu minha meus minhas seu sua seus suas dele dela deles delas
este esta estes estas esse essa esses essas aquele aquela aqueles aquelas isto isso aquilo todo toda todos todas cada
muito muita muitos muitas pouco pouca poucos poucas mais menos maior menor melhor pior mesmo mesma mesmos mesmas outro outra outros outras
era eram foi foram ser estar esta está estão estava estavam estou estamos teria teriam tinha tinham tenho tem têm tendo tenha
há havia fazer faz fez fazem feito ir vai vou vamos foi vem veio vir ver viu saber sabe sabia poder pode podia
dizer disse dizem falar falou olhar olhou sentir sentiu querer queria deixar deixou ficar ficou dar deu tomar tomou
amor hora vez empresa forma todos todo todas nada algo alguem alguém coisa coisas pessoa pessoas gerente finalmente geralmente raramente certamente
pelo pela pelos pelas pele para porque quando onde aqui ali agora hoje ontem amanha amanhã sempre nunca apenas quase talvez
trabalho tempo dia noite manha manhã tarde ano anos casa escritorio escritório sala porta mesa rosto olhos mao mão maos mãos
cabeca cabeça corpo voz sorriso silêncio silencio problema lugar momento maneira lado frente atras atrás dentro fora vida nome
nariz unico único seria perder eficiente ineficiente dificil difícil facil fácil estranho estranha grande pequeno pequena novo nova
claro clara escuro escura branco branca preto preta vermelho vermelha azul certo certa errado errada
gravidez reuniao reunião mal-entendido reconhecimento promessa viagem negocios negócios verdade contrato rumores tratamento noticias notícias
perturbacao perturbação ciume ciúme mudanca mudança introducao introdução vazamento agua água rachadura consequencia consequência conclusao conclusão
historia história casamento materiais enjoo matinal cantigas ninar
`.split(/\s+/).filter(Boolean));

const PORTUGUESE_NAME_STOPWORDS = new Set([
  ...PORTUGUESE_COMMON_WORDS,
  'todos', 'todo', 'todas', 'pelo', 'pela', 'pele', 'tenho', 'tenha', 'tendo', 'venho',
  'gerente', 'finalmente', 'geralmente', 'raramente', 'certamente', 'lider', 'líder',
  'equipe', 'empresa', 'senhor', 'senhora', 'voce', 'você', 'capitulo', 'capítulo',
  'ele', 'ela', 'eu', 'voce', 'você', 'seu', 'sua', 'no', 'na', 'um', 'uma',
]);

const KOREAN_FAMILY_NAMES = new Set(['do', 'seo', 'lee', 'kim', 'park', 'choi', 'han', 'kang']);

const SOURCE_STOPWORDS = new Set([
  'the', 'and', 'with', 'that', 'this', 'would', 'could', 'should', 'have', 'been', 'from', 'they', 'their', 'there', 'while', 'after', 'before', 'because',
  'el', 'la', 'los', 'las', 'que', 'con', 'para', 'una', 'uno', 'unos', 'unas', 'no', 'de', 'del', 'por', 'como', 'más', 'mas', 'pero', 'muy', 'todo', 'toda',
  'todos', 'todas', 'año', 'años', 'hasta', 'solo', 'aunque', 'donde', 'cuando', 'siempre', 'era', 'fue', 'son', 'estaba', 'habia', 'había',
]);

const SPANISH_RESIDUAL_MARKERS = new Set([
  'embarazo', 'reunión', 'reunion', 'malentendido', 'náuseas', 'nauseas', 'matutinas', 'jeongun',
  'viaje', 'negocios', 'verdad', 'contrato', 'tratamiento', 'noticias', 'perturbación', 'perturbacion',
  'rimas', 'infantiles', 'celos', 'cambiar', 'introducción', 'introduccion', 'fuga', 'viento',
  'grieta', 'conclusión', 'conclusion', 'promesa', 'matrimonio',
]);

const TITLE_TRANSLATION_HINTS = new Map([
  ['embarazo', ['gravidez']],
  ['reunion', ['reuniao', 'reunião']],
  ['malentendido', ['mal-entendido']],
  ['nauseas matutinas', ['enjoo matinal']],
  ['viaje negocios', ['viagem negocios', 'viagem de negocios', 'viagem de negócios']],
  ['verdad', ['verdade']],
  ['contrato', ['contrato', 'contratos']],
  ['rumores', ['rumores']],
  ['tratamiento', ['tratamento']],
  ['noticias', ['noticias', 'notícias']],
  ['perturbacion', ['perturbacao', 'perturbação']],
  ['rimas infantiles', ['cantigas ninar', 'cantigas de ninar']],
  ['celos', ['ciume', 'ciúme']],
  ['cambiar', ['mudanca', 'mudança']],
  ['introduccion', ['introducao', 'introdução']],
  ['fuga agua', ['vazamento agua', 'vazamento de agua', 'vazamento de água']],
  ['grieta', ['rachadura']],
  ['conclusion', ['conclusao', 'conclusão']],
  ['promesa', ['promessa']],
  ['matrimonio', ['casamento']],
]);

function isPortugueseCommonWord(word) {
  const normalized = normalizeWord(word);
  if (!normalized) return true;
  if (PORTUGUESE_COMMON_WORDS.has(normalized)) return true;
  if (normalized.endsWith('mente')) return true;
  if (/(aria|eria|iria|asse|esse|isse|ando|endo|indo|ado|ido|ava|iam|ou|ei)$/.test(normalized) && normalized.length > 5) return true;
  return false;
}

function isLikelyNameToken(word) {
  const normalized = normalizeWord(word);
  if (KOREAN_FAMILY_NAMES.has(normalized)) return true;
  if (normalized.length < 4) return false;
  if (PORTUGUESE_NAME_STOPWORDS.has(normalized)) return false;
  return /[yhkw]/i.test(word) || /-/.test(word);
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function extractSourceVocabulary(sourceDoc, sourceLanguage) {
  const config = getLanguageConfig(sourceLanguage);
  const markerSet = new Set([...(config.residualMarkers || []), ...SPANISH_RESIDUAL_MARKERS].map(normalizeWord));
  const vocabulary = new Map();
  for (const word of tokenize(sourceDoc.rawText || '')) {
    if (word.length < 4) continue;
    if (SOURCE_STOPWORDS.has(word)) continue;
    if (isPortugueseCommonWord(word) && !markerSet.has(word)) continue;
    if (/^\d+$/.test(word)) continue;
    vocabulary.set(word, (vocabulary.get(word) || 0) + 1);
  }

  return new Map(
    [...vocabulary.entries()]
      .filter(([word, count]) => markerSet.has(word) || (count >= 2 && count <= 80))
      .map(([word, count]) => [word, { count, marker: markerSet.has(word) }])
  );
}

function titleCandidatesFromDoc(doc) {
  const candidates = [];
  const seen = new Set();

  function add(section, text, source, order) {
    const normalized = normalizeText(text);
    const number = extractChapterNumber(normalized);
    if (!number) return;
    if (normalized.length > 90) return;
    const key = `${section.index}:${normalized.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      sectionIndex: section.index,
      sectionTitle: section.title,
      path: section.path,
      text: normalized,
      title: extractChapterTitle(normalized),
      number,
      source,
      order,
    });
  }

  for (const section of doc.sections || []) {
    add(section, section.title, 'sectionTitle', -1);
    (section.headings || []).forEach((heading, index) => add(section, heading, 'heading', index));
    (section.paragraphs || []).slice(0, 8).forEach((paragraph, index) => add(section, paragraph, 'paragraph', index));
  }

  return candidates.sort((a, b) => a.sectionIndex - b.sectionIndex || a.order - b.order);
}

function titleLanguageScore(title) {
  const words = tokenize(title);
  const sourceHits = words.filter((word) => SPANISH_RESIDUAL_MARKERS.has(word)).length;
  const portugueseHits = words.filter((word) => PORTUGUESE_COMMON_WORDS.has(word)).length;
  return { sourceHits, portugueseHits };
}

function detectDuplicatedTitles(sourceDoc, translationDoc) {
  const sourceByNumber = new Map(titleCandidatesFromDoc(sourceDoc).map((item) => [item.number, item]));
  const translationByNumber = new Map();

  for (const candidate of titleCandidatesFromDoc(translationDoc)) {
    if (!translationByNumber.has(candidate.number)) translationByNumber.set(candidate.number, []);
    translationByNumber.get(candidate.number).push(candidate);
  }

  const findings = [];
  const seen = new Set();

  for (const [number, candidates] of translationByNumber.entries()) {
    const unique = [];
    for (const candidate of candidates) {
      if (unique.some((item) => normalizeForCompare(item.title) === normalizeForCompare(candidate.title))) continue;
      unique.push(candidate);
    }
    if (unique.length < 2) continue;

    const sourceTitle = sourceByNumber.get(number)?.title || '';
    for (let i = 0; i < unique.length - 1; i++) {
      const current = unique[i];
      const next = unique[i + 1];
      if (Math.abs(current.sectionIndex - next.sectionIndex) > 1) continue;
      const currentScore = titleLanguageScore(current.title);
      const nextScore = titleLanguageScore(next.title);
      const currentLooksSource = currentScore.sourceHits > currentScore.portugueseHits || similarity(normalizeForCompare(current.title), normalizeForCompare(sourceTitle)) >= 0.72;
      const nextLooksSource = nextScore.sourceHits > nextScore.portugueseHits || similarity(normalizeForCompare(next.title), normalizeForCompare(sourceTitle)) >= 0.72;
      if (currentLooksSource === nextLooksSource && !sourceTitle) continue;

      const original = currentLooksSource ? current : next;
      const translated = currentLooksSource ? next : current;
      const key = `${number}:${original.text}:${translated.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        chapter: number,
        sectionIndex: translated.sectionIndex,
        originalTitle: original.text,
        translatedTitle: translated.text,
        example: `Capítulo ${number}: original "${original.text}" + traduzido "${translated.text}"`
      });
    }
  }

  return {
    id: 'duplicated_source_target_titles',
    label: 'Títulos duplicados origem/tradução',
    classification: 'confirmed',
    severity: 'high',
    confidence: 'high',
    count: findings.length,
    description: 'Capítulos que mantêm duas linhas de título para o mesmo número, geralmente o original e a tradução.',
    examples: findings.slice(0, 12).map(f => f.example)
  };
}

function detectResidualSourceLanguage(sourceDoc, translationDoc, sourceLanguage) {
  const sourceVocabulary = extractSourceVocabulary(sourceDoc, sourceLanguage);
  const targetFrequency = new Map();
  for (const word of tokenize(translationDoc.rawText || '')) {
    targetFrequency.set(word, (targetFrequency.get(word) || 0) + 1);
  }
  const findings = [];
  const seen = new Set();

  function shouldFlag(word, context = 'paragraph') {
    const normalized = normalizeWord(word);
    const sourceEntry = sourceVocabulary.get(normalized);
    if (!sourceEntry) return false;
    if (PORTUGUESE_COMMON_WORDS.has(normalized)) return false;
    if (isLikelyNameToken(normalized) && !sourceEntry.marker) return false;
    if ((targetFrequency.get(normalized) || 0) > (context === 'heading' ? 30 : 12) && !sourceEntry.marker) return false;
    return sourceEntry.marker || SPANISH_RESIDUAL_MARKERS.has(normalized) || sourceEntry.count <= 25;
  }

  function pushFinding(finding) {
    const key = `${finding.type}:${finding.sectionIndex}:${finding.word || finding.words?.join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(finding);
  }
  
  for (const section of translationDoc.sections || []) {
    const titleTexts = [
      section.title,
      ...(section.headings || []),
      ...(section.paragraphs || []).slice(0, 4).filter((paragraph) => extractChapterNumber(paragraph)),
    ];
    for (const heading of titleTexts) {
      const words = tokenize(heading).filter(w => w.length >= 4);
      for (const word of words) {
        if (shouldFlag(word, 'heading')) {
          pushFinding({
            type: 'heading',
            sectionIndex: section.index,
            sectionTitle: section.title,
            word,
            example: `"${word}" (heading, capítulo ${section.index + 1})`
          });
        }
      }
    }
  }
  
  for (const section of translationDoc.sections || []) {
    const paragraphs = section.paragraphs || [];
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      if (paragraph.length < 20) continue;
      const foundWords = [...new Set(tokenize(paragraph).filter(w => w.length >= 4 && shouldFlag(w, 'paragraph')))];
      const strongWords = foundWords.filter((word) => SPANISH_RESIDUAL_MARKERS.has(word) || sourceVocabulary.get(word)?.marker);
      
      if (strongWords.length >= 1) {
        pushFinding({
          type: 'paragraph',
          sectionIndex: section.index,
          sectionTitle: section.title,
          words: strongWords,
          example: `"...${strongWords.slice(0, 3).join(', ')}..." (parágrafo ${i + 1}, capítulo ${section.index + 1})`
        });
      }
    }
  }

  findings.sort((a, b) => {
    const weight = (item) => item.type === 'heading' ? 0 : 1;
    return weight(a) - weight(b) || a.sectionIndex - b.sectionIndex;
  });
  
  return {
    id: 'residual_source_language',
    label: 'Resquícios do idioma original',
    classification: 'confirmed',
    severity: 'high',
    confidence: 'high',
    count: findings.length,
    description: 'Termos/frases em espanhol que permaneceram no EPUB traduzido, priorizando títulos e palavras raras.',
    examples: findings.slice(0, 25).map(f => f.example)
  };
}

function detectTitleMismatch(sourceDoc, translationDoc) {
  const findings = [];
  const sourceCandidates = titleCandidatesFromDoc(sourceDoc);
  const translationCandidates = titleCandidatesFromDoc(translationDoc);
  const translationByNumber = new Map();
  for (const candidate of translationCandidates) {
    if (!translationByNumber.has(candidate.number)) translationByNumber.set(candidate.number, []);
    translationByNumber.get(candidate.number).push(candidate);
  }

  for (const sourceTitle of sourceCandidates) {
    const translations = translationByNumber.get(sourceTitle.number) || [];
    if (!translations.length) continue;
    const primary = translations[0];
    const sourceNorm = normalizeForCompare(sourceTitle.title);
    const primaryNorm = normalizeForCompare(primary.title);
    const directSim = similarity(sourceNorm, primaryNorm);
    const hint = [...TITLE_TRANSLATION_HINTS.entries()].find(([sourceKey]) => sourceNorm.includes(sourceKey));
    const primaryHintMatch = hint ? hint[1].some((target) => primaryNorm.includes(normalizeForCompare(target))) : false;
    const alternateHintMatch = hint ? translations.slice(1).some((item) => hint[1].some((target) => normalizeForCompare(item.title).includes(normalizeForCompare(target)))) : false;
    const relativeLength = Math.min(sourceNorm.length, primaryNorm.length) / Math.max(sourceNorm.length, primaryNorm.length);
    const sharedWords = tokenize(sourceNorm).filter((word) => tokenize(primaryNorm).includes(word)).length;

    if ((!primaryHintMatch && alternateHintMatch) || (!hint && directSim < 0.35 && relativeLength < 0.65 && sharedWords === 0)) {
      findings.push({
        chapter: sourceTitle.number,
        sectionIndex: primary.sectionIndex,
        sourceTitle: sourceTitle.text,
        translationTitle: primary.text,
        similarity: directSim.toFixed(2),
        example: `Original: "${sourceTitle.text}" → Traduzido: "${primary.text}" (capítulo ${sourceTitle.number})`
      });
    }
  }
  
  return {
    id: 'chapter_title_translation_mismatch',
    label: 'Possível divergência de tradução em títulos',
    classification: 'heuristic',
    severity: 'high',
    confidence: 'medium',
    count: findings.length,
    description: 'Títulos de capítulo onde a tradução parece não corresponder ao significado do original. Requer validação humana.',
    examples: findings.slice(0, 12).map(f => f.example)
  };
}

function detectNameInconsistency(translationDoc) {
  const text = translationDoc.rawText || '';
  
  const names = new Map();

  for (const paragraph of text.split(/\n+/)) {
    const sentences = paragraph.split(/[.!?…“”"()]+/);
    for (const sentence of sentences) {
      const rawTokenMatches = [...sentence.matchAll(/[\p{Lu}][\p{L}]+(?:-[\p{L}]+)?/gu)];
      for (let i = 0; i < rawTokenMatches.length; i++) {
        const single = rawTokenMatches[i][0];
        const nextMatch = rawTokenMatches[i + 1] || null;
        const next = nextMatch?.[0] || '';
        const candidates = [single];
        const nextNormalized = normalizeWord(next);
        const betweenTokens = nextMatch
          ? sentence.slice(rawTokenMatches[i].index + single.length, nextMatch.index)
          : '';
        const canPair =
          next &&
          /^[\s]+$/.test(betweenTokens) &&
          !PORTUGUESE_NAME_STOPWORDS.has(nextNormalized) &&
          !normalizeWord(next).startsWith(normalizeWord(single)) &&
          (isLikelyNameToken(single) || KOREAN_FAMILY_NAMES.has(normalizeWord(single))) &&
          isLikelyNameToken(next);
        if (canPair) candidates.push(`${single} ${next}`);

        for (const name of candidates) {
          const normalizedName = normalizeText(name);
          const parts = normalizedName.split(/\s+/);
          const normalizedParts = parts.map(normalizeWord);
          if (normalizedName.length < 4) continue;
          if (normalizedParts.every((part) => PORTUGUESE_NAME_STOPWORDS.has(part))) continue;
          if (normalizedParts.some((part) => part.endsWith('mente'))) continue;
          if (!parts.some((part) => isLikelyNameToken(part)) && parts.length < 2) continue;
          names.set(normalizedName, (names.get(normalizedName) || 0) + 1);
        }
      }
    }
  }

  for (const section of translationDoc.sections || []) {
    for (const heading of [...(section.headings || []), section.title]) {
      const title = extractChapterTitle(heading);
      const parts = title.split(/\s+/);
      if (parts.some((part) => isLikelyNameToken(part))) {
        names.set(title, (names.get(title) || 0) + 1);
      }
    }
  }
  
  const nameList = [...names.entries()]
    .filter(([name, count]) => count >= 2 || /[-\s]/.test(name))
    .sort((a, b) => b[1] - a[1]);
  const groups = [];
  
  for (let i = 0; i < nameList.length; i++) {
    const [name] = nameList[i];
    if (groups.some(g => g.variants.includes(name))) continue;
    
    const variants = [name];
    for (let j = i + 1; j < nameList.length; j++) {
      const [otherName] = nameList[j];
      const a = normalizeForCompare(name).replace(/\s+/g, '');
      const b = normalizeForCompare(otherName).replace(/\s+/g, '');
      const lengthGap = Math.abs(a.length - b.length);
      if (lengthGap <= 6 && similarity(a, b) >= 0.78) {
        variants.push(otherName);
      }
    }
    
    if (variants.length >= 2) {
      variants.sort((a, b) => names.get(b) - names.get(a));
      const total = variants.reduce((sum, v) => sum + names.get(v), 0);
      if (total < 4) continue;
      groups.push({
        canonical: variants[0],
        variants: variants,
        count: total
      });
    }
  }
  
  return {
    id: 'name_romanization_inconsistency',
    label: 'Inconsistência de nomes e romanização',
    classification: 'confirmed',
    severity: 'medium',
    confidence: 'high',
    count: groups.length,
    description: 'Variantes diferentes do mesmo nome ao longo do texto traduzido.',
    examples: groups.slice(0, 10).map(g => `Grupo: ${g.canonical} (${g.variants.length} variantes: ${g.variants.slice(0, 5).join(', ')})`)
  };
}

function detectLiteralTranslation(translationDoc) {
  const findings = [];
  const paragraphs = translationDoc.paragraphs || [];
  
  // Heurística: uso de termos em inglês em contexto português
  const englishTerms = /\b(CEO|CFO|CTO|HR|IT|AI|ML|DNA|GDP|USA|UK|EU|UN|NASA|FBI|CIA)\b/g;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const matches = paragraph.match(englishTerms);
    
    if (matches && matches.length >= 1) {
      findings.push({
        paragraphIndex: i,
        terms: [...new Set(matches)],
        example: `"...${matches.slice(0, 3).join(', ')}..." (parágrafo ${i + 1})`
      });
    }
  }
  
  return {
    id: 'excessive_literal_translation',
    label: 'Tradução excessivamente literal',
    classification: 'heuristic',
    severity: 'medium',
    confidence: 'medium',
    count: findings.length,
    description: 'Estruturas pouco naturais em português, possivelmente traduções literais do espanhol. Requer validação humana.',
    examples: findings.slice(0, 10).map(f => f.example)
  };
}

function detectStyleIssues(translationDoc) {
  const findings = [];
  const text = translationDoc.rawText || '';
  
  // Aspas mal formatadas
  const quoteIssues = text.match(/"[^"]*"|'[^']*'/g);
  if (quoteIssues && quoteIssues.length > 0) {
    findings.push({
      type: 'quotes',
      count: quoteIssues.length,
      example: `${quoteIssues.length} ocorrências de aspas`
    });
  }
  
  // Espaços duplicados
  const doubleSpaces = text.match(/  +/g);
  if (doubleSpaces && doubleSpaces.length > 10) {
    findings.push({
      type: 'spaces',
      count: doubleSpaces.length,
      example: `${doubleSpaces.length} ocorrências de espaços duplicados`
    });
  }
  
  // Reticências inconsistentes
  const ellipsis = text.match(/\.{2,}/g);
  if (ellipsis && ellipsis.length > 5) {
    findings.push({
      type: 'ellipsis',
      count: ellipsis.length,
      example: `${ellipsis.length} ocorrências de reticências`
    });
  }
  
  return {
    id: 'minor_style_issues',
    label: 'Pequenos problemas de estilo',
    classification: 'heuristic',
    severity: 'low',
    confidence: 'high',
    count: findings.length,
    description: 'Pontuação estranha, aspas mal formatadas, espaços duplicados, reticências inconsistentes. Requer validação humana.',
    examples: findings.slice(0, 10).map(f => f.example)
  };
}

function detectUnnaturalLocalization(translationDoc) {
  const findings = [];
  const paragraphs = translationDoc.paragraphs || [];
  const seen = new Set();
  
  for (let i = 0; i < paragraphs.length - 1; i++) {
    const current = paragraphs[i];
    const next = paragraphs[i + 1];
    const currentClean = normalizeText(current);
    const key = currentClean.toLowerCase();
    
    if (currentClean.length >= 8 && currentClean.length < 40 && /[.!?…:”"]$/.test(currentClean) && next.length > 280 && !seen.has(key)) {
      seen.add(key);
      findings.push({
        paragraphIndex: i,
        currentLength: current.length,
        nextLength: next.length,
        example: `Parágrafo ${i + 1} (${current.length} chars) → ${i + 2} (${next.length} chars)`
      });
    }
  }
  
  return {
    id: 'unnatural_localization',
    label: 'Localização pouco natural',
    classification: 'heuristic',
    severity: 'low',
    confidence: 'low',
    count: Math.min(findings.length, 40),
    description: 'Trechos que parecem pouco naturais em português, exigindo revisão manual. Requer validação humana.',
    examples: findings.slice(0, 20).map(f => f.example)
  };
}

export function buildEditorialReadabilityAudit({ sourceDoc, translationDoc, sourceLanguage = 'en' }) {
  const categories = [];
  
  // 1. Títulos duplicados (confirmed, high)
  const duplicatedTitles = detectDuplicatedTitles(sourceDoc, translationDoc);
  if (duplicatedTitles.count > 0) categories.push(duplicatedTitles);
  
  // 2. Resquícios do idioma original (confirmed, high)
  const residualLanguage = detectResidualSourceLanguage(sourceDoc, translationDoc, sourceLanguage);
  if (residualLanguage.count > 0) categories.push(residualLanguage);
  
  // 3. Divergência de título (heuristic, high, medium confidence)
  const titleMismatch = detectTitleMismatch(sourceDoc, translationDoc);
  if (titleMismatch.count > 0) categories.push(titleMismatch);
  
  // 4. Inconsistência de nomes (confirmed, medium)
  const nameInconsistency = detectNameInconsistency(translationDoc);
  if (nameInconsistency.count > 0) categories.push(nameInconsistency);
  
  // 5. Tradução literal (heuristic, medium)
  const literalTranslation = detectLiteralTranslation(translationDoc);
  if (literalTranslation.count > 0) categories.push(literalTranslation);
  
  // 6. Problemas de estilo (heuristic, low)
  const styleIssues = detectStyleIssues(translationDoc);
  if (styleIssues.count > 0) categories.push(styleIssues);
  
  // 7. Localização pouco natural (heuristic, low)
  const unnaturalLocalization = detectUnnaturalLocalization(translationDoc);
  if (unnaturalLocalization.count > 0) categories.push(unnaturalLocalization);
  
  // Calcular summary
  const totalFindings = categories.reduce((sum, cat) => sum + cat.count, 0);
  const confirmed = categories.filter(c => c.classification === 'confirmed').reduce((sum, cat) => sum + cat.count, 0);
  const heuristic = categories.filter(c => c.classification === 'heuristic').reduce((sum, cat) => sum + cat.count, 0);
  const high = categories.filter(c => c.severity === 'high').reduce((sum, cat) => sum + cat.count, 0);
  const medium = categories.filter(c => c.severity === 'medium').reduce((sum, cat) => sum + cat.count, 0);
  const low = categories.filter(c => c.severity === 'low').reduce((sum, cat) => sum + cat.count, 0);
  
  return {
    summary: {
      totalFindings,
      confirmed,
      heuristic,
      high,
      medium,
      low
    },
    categories
  };
}

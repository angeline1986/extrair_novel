import { getLanguageConfig } from './languageConfig.js';

function normalizeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractChapterNumber(heading) {
  const match = String(heading || '').match(/^(\d+)[.\s]/);
  return match ? match[1] : null;
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
  const text = sourceDoc.rawText || '';
  const words = text
    .toLowerCase()
    .replace(/[^\w\s\u00C0-\u017F\u0400-\u04FF]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3);
  
  // Remove stopwords comuns (simplificado)
  const stopwords = new Set(['the', 'and', 'with', 'that', 'this', 'would', 'could', 'should', 'have', 'been', 'from', 'they', 'their', 'there', 'while', 'after', 'before', 'because', 'el', 'la', 'los', 'las', 'que', 'con', 'para', 'una', 'no', 'de', 'por', 'como', 'más', 'pero', 'muy', 'todo', 'año', 'años', 'hasta', 'solo', 'aunque', 'donde', 'cuando', 'siempre']);
  
  const vocabulary = new Map();
  for (const word of words) {
    if (stopwords.has(word)) continue;
    if (/^\d+$/.test(word)) continue;
    vocabulary.set(word, (vocabulary.get(word) || 0) + 1);
  }
  
  // Retorna palavras que aparecem pelo menos 2 vezes
  return new Map([...vocabulary.entries()].filter(([_, count]) => count >= 2).map(([word, _]) => [word, true]));
}

function detectDuplicatedTitles(translationDoc) {
  const findings = [];
  const sections = translationDoc.sections || [];
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const headings = section.headings || [];
    
    for (let j = 0; j < headings.length - 1; j++) {
      const current = headings[j];
      const next = headings[j + 1];
      
      const currentNum = extractChapterNumber(current);
      const nextNum = extractChapterNumber(next);
      
      if (currentNum && nextNum && currentNum === nextNum) {
        // Verifica se são idiomas diferentes (espanhol vs português)
        const spanishMarkers = /\b(el|la|los|las|que|con|para|una|no|de|por|como|más|pero|muy|todo|año|años|hasta|solo|aunque|donde|cuando|siempre|embarazo|reunión|malentendido|reconocimiento|promesa|viaje)\b/i;
        const portugueseMarkers = /\b(que|com|para|uma|não|nao|ele|ela|dos|das|por|como|mais|muito|quando|gravidez|reunião|mal-entendido|reconhecimento|promessa|viagem)\b/i;
        
        const hasSpanish = spanishMarkers.test(current);
        const hasPortuguese = portugueseMarkers.test(next);
        
        if (hasSpanish && hasPortuguese) {
          findings.push({
            sectionIndex: section.index,
            sectionTitle: section.title,
            current,
            next,
            example: `"${current}" → "${next}" (capítulo ${section.index + 1})`
          });
        }
      }
    }
  }
  
  return {
    id: 'duplicated_source_target_titles',
    label: 'Títulos duplicados origem/tradução',
    classification: 'confirmed',
    severity: 'high',
    confidence: 'high',
    count: findings.length,
    description: 'Capítulos que mantêm o título original em espanhol junto do título traduzido em português.',
    examples: findings.slice(0, 10).map(f => f.example)
  };
}

function detectResidualSourceLanguage(sourceDoc, translationDoc, sourceLanguage) {
  const sourceVocabulary = extractSourceVocabulary(sourceDoc, sourceLanguage);
  const findings = [];
  
  // Detectar em headings (alta criticidade)
  for (const section of translationDoc.sections || []) {
    for (const heading of section.headings || []) {
      const words = heading.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      for (const word of words) {
        if (sourceVocabulary.has(word)) {
          findings.push({
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
  
  // Detectar em parágrafos (média criticidade)
  for (const section of translationDoc.sections || []) {
    const paragraphs = section.paragraphs || [];
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const words = paragraph.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      const foundWords = words.filter(w => sourceVocabulary.has(w));
      
      if (foundWords.length >= 2) {
        findings.push({
          type: 'paragraph',
          sectionIndex: section.index,
          sectionTitle: section.title,
          words: foundWords,
          example: `"...${foundWords.slice(0, 3).join(', ')}..." (parágrafo ${i + 1}, capítulo ${section.index + 1})`
        });
      }
    }
  }
  
  return {
    id: 'residual_source_language',
    label: 'Resquícios do idioma original',
    classification: 'confirmed',
    severity: 'high',
    confidence: 'high',
    count: findings.length,
    description: 'Termos/frases em espanhol que permaneceram no EPUB traduzido, detectados a partir do vocabulário do original.',
    examples: findings.slice(0, 10).map(f => f.example)
  };
}

function detectTitleMismatch(sourceDoc, translationDoc) {
  const findings = [];
  const sourceSections = sourceDoc.sections || [];
  const translationSections = translationDoc.sections || [];
  const max = Math.min(sourceSections.length, translationSections.length);
  
  for (let i = 0; i < max; i++) {
    const sourceHeadings = sourceSections[i].headings || [];
    const translationHeadings = translationSections[i].headings || [];
    
    if (sourceHeadings.length > 0 && translationHeadings.length > 0) {
      const sourceTitle = normalizeText(sourceHeadings[0]);
      const translationTitle = normalizeText(translationHeadings[0]);
      
      // Verifica se são muito diferentes (baixa similaridade)
      const sim = similarity(sourceTitle.toLowerCase(), translationTitle.toLowerCase());
      
      if (sim < 0.3) {
        findings.push({
          sectionIndex: i,
          sourceTitle,
          translationTitle,
          similarity: sim.toFixed(2),
          example: `Original: "${sourceTitle}" → Traduzido: "${translationTitle}" (capítulo ${i + 1})`
        });
      }
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
    examples: findings.slice(0, 10).map(f => f.example)
  };
}

function detectNameInconsistency(translationDoc) {
  const findings = [];
  const text = translationDoc.rawText || '';
  
  // Extrair nomes próprios (capitalizados, possivelmente coreanos)
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  const names = new Map();
  
  let match;
  while ((match = namePattern.exec(text)) !== null) {
    const name = match[1];
    if (name.length < 2) continue;
    if (/^(O|A|Os|As|Em|De|Para|Com|Por|Como|Mais|Muito|Quando|Não|Nao|Ele|Ela|Dos|Das)$/.test(name)) continue;
    
    names.set(name, (names.get(name) || 0) + 1);
  }
  
  // Agrupar variantes por similaridade
  const nameList = [...names.entries()].filter(([_, count]) => count >= 2);
  const groups = [];
  
  for (let i = 0; i < nameList.length; i++) {
    const [name, count] = nameList[i];
    if (groups.some(g => g.includes(name))) continue;
    
    const variants = [name];
    for (let j = i + 1; j < nameList.length; j++) {
      const [otherName, _] = nameList[j];
      if (similarity(name, otherName) >= 0.7) {
        variants.push(otherName);
      }
    }
    
    if (variants.length >= 3) {
      // Ordena por frequência e usa o mais comum como canônico
      variants.sort((a, b) => names.get(b) - names.get(a));
      groups.push({
        canonical: variants[0],
        variants: variants,
        count: variants.reduce((sum, v) => sum + names.get(v), 0)
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
  
  // Heurística: frases muito curtas seguidas de frases muito longas (possível calque)
  for (let i = 0; i < paragraphs.length - 1; i++) {
    const current = paragraphs[i];
    const next = paragraphs[i + 1];
    
    if (current.length < 50 && next.length > 200) {
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
    count: findings.length,
    description: 'Trechos que parecem pouco naturais em português, exigindo revisão manual. Requer validação humana.',
    examples: findings.slice(0, 10).map(f => f.example)
  };
}

export function buildEditorialReadabilityAudit({ sourceDoc, translationDoc, sourceLanguage = 'en' }) {
  const categories = [];
  
  // 1. Títulos duplicados (confirmed, high)
  const duplicatedTitles = detectDuplicatedTitles(translationDoc);
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

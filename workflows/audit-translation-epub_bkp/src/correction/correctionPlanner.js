import path from 'path';
import {
  findLocationByContext,
  findLocationByGlobalIndex,
  findTextLocations,
} from '../xhtmlMapper.js';
import {
  actionId,
  candidateId,
  CorrectionMode,
  CorrectionRisk,
  CorrectionStatus,
} from './correctionTypes.js';
import {
  loadTermsGlossary,
  normalizeTermEntries,
} from './terminologyNormalizer.js';
import {
  loadEntitiesGlossary,
  normalizeEntityAliasEntries,
} from './entityNormalizer.js';

function escapedRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termBoundaryRegex(value) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedRegex(value)})(?=[^\\p{L}\\p{N}]|$)`, 'giu');
}

function countOccurrences(text, term) {
  if (!term) return 0;
  return [...String(text || '').matchAll(termBoundaryRegex(term))].length;
}

function relativeTo(root, filePath) {
  if (!filePath) return null;
  const relative = path.relative(root, filePath).replaceAll('\\', '/');
  return relative && !relative.startsWith('..') ? relative : filePath;
}

function examplesFromFinding(finding) {
  return (finding.examples || []).slice(0, 5).map((example) => ({
    match: example.match || null,
    context: example.context || null,
    index: typeof example.index === 'number' ? example.index : null,
  }));
}

function defaultTarget(scope = 'translation_text') {
  return {
    scope,
    filePath: null,
    spineIndex: null,
    paragraphIndex: null,
    textNodeIndex: null,
    textPreview: null,
  };
}

function targetFromLocation(location, scope = 'translation_text') {
  if (!location) return defaultTarget(scope);

  return {
    scope,
    filePath: location.filePath,
    spineIndex: location.spineIndex,
    paragraphIndex: location.paragraphIndex,
    textNodeIndex: location.textNodeIndex,
    textPreview: location.textPreview,
  };
}

function locationsFromExamples(xhtmlMap, examples) {
  const locations = [];

  for (const example of examples || []) {
    const byIndex = findLocationByGlobalIndex(xhtmlMap, example.index);
    const location = byIndex || findLocationByContext(xhtmlMap, example.context);
    if (!location) continue;
    if (locations.some((item) => item.id === location.id)) continue;
    locations.push(location);
  }

  return locations;
}

function pushCandidate(candidates, data) {
  candidates.push({
    id: candidateId(candidates.length),
    schemaVersion: '1.0',
    ...data,
  });
}

function buildLogReplacementCandidates(candidates, { logInfo, translationDoc, xhtmlMap }) {
  for (const replacement of logInfo.replacements || []) {
    const occurrences = countOccurrences(translationDoc.rawText, replacement.from);
    if (occurrences <= 0) continue;
    const locations = findTextLocations(xhtmlMap, replacement.from);
    const primaryLocation = locations[0] || null;

    pushCandidate(candidates, {
      type: 'terminology_replace',
      severity: 'WARN',
      mode: CorrectionMode.AUTO_SAFE,
      source: 'Log_Traducao.txt',
      confidence: 0.98,
      risk: CorrectionRisk.LOW,
      from: replacement.from,
      to: replacement.to,
      occurrences,
      reason: 'Forma antiga indicada no log ainda aparece na traducao.',
      target: targetFromLocation(primaryLocation),
      locations,
    });
  }
}

function buildGlossaryCandidates(candidates, { glossaryEntries, translationDoc, xhtmlMap }) {
  for (const entry of glossaryEntries || []) {
    const occurrences = countOccurrences(translationDoc.rawText, entry.from);
    if (occurrences <= 0) continue;
    const locations = findTextLocations(xhtmlMap, entry.from);
    const primaryLocation = locations[0] || null;
    const autoSafe = entry.mode === CorrectionMode.AUTO_SAFE && entry.confidence >= 0.9;

    pushCandidate(candidates, {
      type: entry.source === 'glossary:entities' ? 'entity_alias_replace' : 'terminology_replace',
      severity: autoSafe ? 'INFO' : 'WARN',
      mode: autoSafe ? CorrectionMode.AUTO_SAFE : CorrectionMode.AUTO_REVIEW,
      source: entry.source,
      confidence: entry.confidence,
      risk: autoSafe ? CorrectionRisk.LOW : CorrectionRisk.MEDIUM,
      from: entry.from,
      to: entry.to,
      occurrences,
      reason: autoSafe
        ? 'Correspondencia exata com glossario seguro.'
        : 'Correspondencia com glossario exige revisao antes da aplicacao.',
      details: {
        note: entry.note,
        entity: entry.entity || null,
      },
      target: targetFromLocation(primaryLocation),
      locations,
    });
  }
}

function buildFindingCandidates(candidates, findings, xhtmlMap) {
  for (const finding of findings) {
    if (finding.type === 'epub_residual_english_block') {
      const examples = examplesFromFinding(finding);
      const locations = locationsFromExamples(xhtmlMap, examples);
      const primaryLocation = locations[0] || null;
      pushCandidate(candidates, {
        type: 'residual_english_review',
        severity: finding.severity || 'WARN',
        mode: CorrectionMode.AUTO_REVIEW,
        source: 'audit',
        confidence: 0.65,
        risk: CorrectionRisk.MEDIUM,
        occurrences: finding.occurrences || finding.examples?.length || 1,
        reason: finding.description || 'Possivel trecho residual em ingles exige revisao contextual.',
        examples,
        target: targetFromLocation(primaryLocation),
        locations,
      });
      continue;
    }

    if (finding.type === 'epub_gender_suspicion') {
      const examples = examplesFromFinding(finding);
      const locations = locationsFromExamples(xhtmlMap, examples);
      const primaryLocation = locations[0] || null;
      pushCandidate(candidates, {
        type: 'gender_agreement_review',
        severity: finding.severity || 'WARN',
        mode: CorrectionMode.AUTO_REVIEW,
        source: 'audit',
        confidence: 0.55,
        risk: CorrectionRisk.MEDIUM,
        occurrences: finding.occurrences || finding.examples?.length || 1,
        reason: finding.description || 'Possivel problema de genero/concordancia exige contexto.',
        examples,
        target: targetFromLocation(primaryLocation),
        locations,
      });
      continue;
    }

    if (
      finding.type === 'missing_sections' ||
      finding.type === 'epub_section_too_short' ||
      finding.type === 'epub_translation_too_short'
    ) {
      pushCandidate(candidates, {
        type: 'structural_manual_review',
        severity: finding.severity || 'FAIL',
        mode: CorrectionMode.MANUAL_ONLY,
        source: 'audit',
        confidence: 0,
        risk: CorrectionRisk.HIGH,
        occurrences: finding.occurrences || 1,
        reason: finding.description || 'Problema estrutural nao deve ser corrigido automaticamente nesta fase.',
        details: finding.details || null,
        target: {
          scope: 'document_structure',
          filePath: null,
          spineIndex: finding.details?.sourceIndex ?? null,
          paragraphIndex: null,
          textNodeIndex: null,
          textPreview: null,
        },
        locations: [],
      });
    }
  }
}

export function buildCorrectionCandidates({
  issues = [],
  warnings = [],
  logInfo,
  translationDoc,
  xhtmlMap,
  glossary = {},
}) {
  const candidates = [];
  buildLogReplacementCandidates(candidates, { logInfo, translationDoc, xhtmlMap });
  buildGlossaryCandidates(candidates, {
    glossaryEntries: [
      ...normalizeTermEntries(glossary.terms),
      ...normalizeEntityAliasEntries(glossary.entities),
    ],
    translationDoc,
    xhtmlMap,
  });
  buildFindingCandidates(candidates, [...issues, ...warnings], xhtmlMap);
  return candidates;
}

export function loadCorrectionGlossary({ termsPath, entitiesPath }) {
  return {
    terms: loadTermsGlossary(termsPath),
    entities: loadEntitiesGlossary(entitiesPath),
  };
}

function actionStatusForMode(mode) {
  if (mode === CorrectionMode.AUTO_SAFE) return CorrectionStatus.PENDING;
  if (mode === CorrectionMode.AUTO_REVIEW) return CorrectionStatus.NEEDS_REVIEW;
  return CorrectionStatus.MANUAL_ONLY;
}

function summarize(candidates) {
  return {
    totalCandidates: candidates.length,
    autoSafe: candidates.filter((candidate) => candidate.mode === CorrectionMode.AUTO_SAFE).length,
    autoReview: candidates.filter((candidate) => candidate.mode === CorrectionMode.AUTO_REVIEW).length,
    manualOnly: candidates.filter((candidate) => candidate.mode === CorrectionMode.MANUAL_ONLY).length,
  };
}

export function buildCorrectionPlan({
  workflowRoot,
  sourceDoc,
  translationDoc,
  logInfo,
  candidates,
  createdAt = new Date().toISOString(),
}) {
  const actions = candidates.map((candidate, index) => ({
    id: actionId(index),
    candidateId: candidate.id,
    type: candidate.type,
    mode: candidate.mode,
    source: candidate.source,
    confidence: candidate.confidence,
    risk: candidate.risk,
    target: candidate.target,
    locations: candidate.locations || [],
    before: candidate.from || null,
    after: candidate.to || null,
    status: actionStatusForMode(candidate.mode),
    reason: candidate.reason,
    occurrences: candidate.occurrences || null,
    examples: candidate.examples || null,
    details: candidate.details || null,
  }));

  return {
    schemaVersion: '1.0',
    workflow: 'audit-translation-epub',
    createdAt,
    source: {
      original: relativeTo(workflowRoot, sourceDoc.filePath),
      translated: relativeTo(workflowRoot, translationDoc.filePath),
      log: relativeTo(workflowRoot, logInfo.filePath),
    },
    summary: summarize(candidates),
    actions,
  };
}

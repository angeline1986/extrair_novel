import fs from 'fs';
import path from 'path';
import { refreshPdfEpubReviewQueueSummary } from './reviewQueue.js';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function candidateDirs(workflowRoot) {
  return [
    path.join(process.env.HOME || '', 'Downloads'),
    path.join(workflowRoot, 'reports/json'),
    workflowRoot,
  ];
}

export function findLatestDecisionExport(workflowRoot) {
  const candidates = [];
  for (const dir of candidateDirs(workflowRoot)) {
    if (!dir || !fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/^pdf-epub-decisions-export.*\.json$/i.test(name)) continue;
      const filePath = path.join(dir, name);
      candidates.push({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs });
    }
  }
  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.filePath || null;
}

function replacementFromDecision(item, decision) {
  if (!decision.to) return null;
  return {
    from: String(decision.from || item.problematicTerm || item.sourceTerm || item.original || '').trim(),
    to: String(decision.to || '').trim(),
  };
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function replacementKey(from, to, chapter = '', type = '', context = '', occurrenceIndex = null) {
  const occurrence = Number.isInteger(occurrenceIndex) ? occurrenceIndex : '-';
  return `${chapter || '-'}::${normalize(type)}::${normalize(from)}::${normalize(to)}::${normalize(context)}::${occurrence}`;
}

function itemReplacementKey(item, decision) {
  if (!decisionMatchesItem(item, decision)) return null;
  const replacement = replacementFromDecision(item, decision);
  if (!replacement?.from || !replacement?.to) return null;
  return replacementKey(
    replacement.from,
    replacement.to,
    item.chapter,
    item.type,
    decision.context,
    decision.occurrenceIndex
  );
}

function matchingItemForDecision(items, decision) {
  return items.find((item) => decisionMatchesItem(item, decision)) || null;
}

function cloneItemForDecision(item, decision, now) {
  const from = String(decision.from || item.problematicTerm || '').trim();
  return {
    ...item,
    id: decision.id,
    stableKey: `${item.stableKey || item.id || 'pdf-epub'}::decision::${replacementKey(from, decision.to || decision.decision || '', decision.chapter, decision.type, decision.context, decision.occurrenceIndex)}`,
    dedupeKey: null,
    status: 'pending',
    original: from || item.original,
    problematicTerm: from || item.problematicTerm,
    review: { approvedBy: null, reviewedAt: null, notes: null },
    application: null,
    createdAt: now,
    updatedAt: now,
  };
}

function decisionMatchesItem(item, decision) {
  if (decision.chapter && String(item.chapter) !== String(decision.chapter)) return false;
  if (decision.type && item.type && String(item.type) !== String(decision.type)) return false;
  const from = normalize(decision.from);
  if (!from) return false;
  return [
    item.original,
    item.translation,
    item.location,
    item.problematicTerm,
    item.sourceTerm,
  ].some((value) => normalize(value).includes(from));
}

function itemIndexes(items, decisions) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const byReplacement = new Map();
  for (const item of items) {
    for (const decision of decisions) {
      const key = itemReplacementKey(item, decision);
      if (key && !byReplacement.has(key)) byReplacement.set(key, item);
    }
  }
  return { byId, byReplacement };
}

function applyDecision(item, decision, now) {
  const scope = decision.context ? {
    context: decision.context,
    occurrenceIndex: Number.isInteger(decision.occurrenceIndex) ? decision.occurrenceIndex : 0,
  } : null;
  if (decision.decision === 'keep') {
    item.status = 'rejected';
    item.review = {
      ...(item.review || {}),
      reviewedAt: now,
      notes: 'Mantido via importacao do relatorio PDF x EPUB.',
      scope,
    };
    item.updatedAt = now;
    return 'kept';
  }
  if (decision.decision !== 'apply') return 'skipped';
  const replacement = replacementFromDecision(item, decision);
  if (!replacement?.from || !replacement?.to) return 'skipped';
  item.status = 'approved';
  item.review = {
    ...(item.review || {}),
    approvedBy: 'pdf_epub_report_import',
    reviewedAt: now,
    notes: 'Correcao aprovada via importacao do relatorio PDF x EPUB.',
    replacement,
    scope,
  };
  item.application = null;
  item.updatedAt = now;
  return 'approved';
}

export function importPdfEpubDecisions({ decisionsPath, queuePath }) {
  const payload = readJson(decisionsPath);
  const queue = readJson(queuePath);
  const decisions = payload.decisions || [];
  const { byId, byReplacement } = itemIndexes(queue.items || [], decisions);
  const summary = { approved: 0, kept: 0, skipped: 0, missing: 0 };
  const now = new Date().toISOString();

  for (const decision of decisions) {
    let item = byId.get(decision.id);
    if (!item) {
      const matchedItem = byReplacement.get(replacementKey(
        decision.from,
        decision.to,
        decision.chapter,
        decision.type,
        decision.context,
        decision.occurrenceIndex
      ))
        || matchingItemForDecision(queue.items || [], decision);
      if (matchedItem && decision.id && decision.id !== matchedItem.id) {
        item = cloneItemForDecision(matchedItem, decision, now);
        queue.items.push(item);
        byId.set(item.id, item);
      } else {
        item = matchedItem;
      }
    }
    if (!item) {
      summary.missing += 1;
      continue;
    }
    const result = applyDecision(item, decision, now);
    summary[result] = (summary[result] || 0) + 1;
  }

  refreshPdfEpubReviewQueueSummary(queue);
  writeJson(queuePath, queue);
  return { decisionsPath, source: payload.source || null, exportedAt: payload.exportedAt || null, summary };
}

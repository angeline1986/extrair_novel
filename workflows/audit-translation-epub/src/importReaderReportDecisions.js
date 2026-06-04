import fs from 'fs';
import path from 'path';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function countStatuses(items) {
  return {
    totalItems: items.length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
    pending: items.filter((item) => item.status === 'pending').length,
    needsContext: items.filter((item) => item.status === 'needs_context').length,
  };
}

export function findLatestReaderDecisionExport(workflowRoot) {
  const dirs = [
    path.join(process.env.HOME || '', 'Downloads'),
    path.join(workflowRoot, 'reports/json'),
    workflowRoot,
  ];
  const candidates = [];
  for (const dir of dirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/^reader-report-decisions-export.*\.json$/i.test(name)) continue;
      const filePath = path.join(dir, name);
      candidates.push({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs });
    }
  }
  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.filePath || null;
}

function applyDecision(item, decision, now) {
  if (decision.decision === 'keep') {
    item.status = 'rejected';
    item.review = { ...(item.review || {}), reviewedAt: now, notes: 'Mantido via importacao do reader report.' };
    item.updatedAt = now;
    return 'kept';
  }
  if (decision.decision !== 'apply' || !decision.before || !decision.after) return 'skipped';
  item.status = 'approved';
  item.before = String(decision.before).trim();
  item.after = String(decision.after).trim();
  item.review = {
    ...(item.review || {}),
    source: 'reader_report_import',
    suggestionId: decision.id || null,
    approvedAt: now,
    reviewedAt: now,
    notes: 'Aprovado via importacao do reader report.',
  };
  item.updatedAt = now;
  return 'approved';
}

export function importReaderReportDecisions({ decisionsPath, reviewQueuePath }) {
  const payload = readJson(decisionsPath);
  const reviewQueue = readJson(reviewQueuePath);
  const items = reviewQueue.items || [];
  const itemById = new Map(items.map((item) => [item.id, item]));
  const summary = { approved: 0, kept: 0, skipped: 0, missing: 0 };
  const now = new Date().toISOString();

  for (const decision of payload.decisions || []) {
    const item = itemById.get(decision.reviewQueueItemId || decision.id);
    if (!item) {
      summary.missing += 1;
      continue;
    }
    const result = applyDecision(item, decision, now);
    summary[result] = (summary[result] || 0) + 1;
  }

  reviewQueue.summary = { ...(reviewQueue.summary || {}), ...countStatuses(items) };
  writeJson(reviewQueuePath, reviewQueue);
  return { decisionsPath, source: payload.source || null, exportedAt: payload.exportedAt || null, summary };
}

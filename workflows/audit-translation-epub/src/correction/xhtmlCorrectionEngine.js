import * as cheerio from 'cheerio';

const MIN_AUTO_SAFE_CONFIDENCE = 0.9;
const TEXT_BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,blockquote,li';

function normalizeText(text) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapedRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacementRegex(from) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedRegex(from)})(?=[^\\p{L}\\p{N}]|$)`, 'giu');
}

function isHighConfidenceAutoSafe(action) {
  return (
    action.mode === 'auto_safe' &&
    Number(action.confidence || 0) >= MIN_AUTO_SAFE_CONFIDENCE &&
    action.before &&
    action.after
  );
}

function actionLocations(action) {
  const locations = Array.isArray(action.locations) ? action.locations : [];
  const target = action.target && action.target.filePath ? [action.target] : [];
  const merged = [...locations, ...target];
  const seen = new Set();

  return merged.filter((location) => {
    const key = [
      location.filePath,
      location.spineIndex,
      location.paragraphIndex,
      location.textNodeIndex,
    ].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return location.filePath && Number.isInteger(location.paragraphIndex) && Number.isInteger(location.textNodeIndex);
  });
}

function collectTextNodes($, block) {
  const nodes = [];

  $(block).find('*').addBack().contents().each((_, node) => {
    if (node.type !== 'text') return;
    const text = normalizeText(node.data);
    if (!text || text.length < 2) return;
    nodes.push(node);
  });

  return nodes;
}

function findMappedTextNode($, location) {
  const blocks = $(TEXT_BLOCK_SELECTOR).toArray().filter((block) => {
    const text = normalizeText($(block).text());
    return text && text.length >= 2;
  });
  const block = blocks[location.paragraphIndex];
  if (!block) return null;

  const textNodes = collectTextNodes($, block);
  return textNodes[location.textNodeIndex] || null;
}

function replaceInTextNode(node, action) {
  const beforeText = String(node.data || '');
  const regex = replacementRegex(action.before);
  let replacements = 0;
  const afterText = beforeText.replace(regex, (match, prefix) => {
    replacements += 1;
    return `${prefix}${action.after}`;
  });

  if (replacements <= 0 || beforeText === afterText) return null;

  node.data = afterText;
  return {
    before: beforeText,
    after: afterText,
    replacements,
  };
}

function actionSkipReason(action) {
  if (action.mode !== 'auto_safe') return `mode_${action.mode || 'unknown'}_not_applied`;
  if (Number(action.confidence || 0) < MIN_AUTO_SAFE_CONFIDENCE) return 'confidence_below_auto_safe_threshold';
  if (!action.before || !action.after) return 'missing_before_after';
  return null;
}

export function applySafeCorrectionsToZip(zip, correctionPlan) {
  const appliedCorrections = [];
  const skippedActions = [];
  const changedEntries = [];
  const actions = correctionPlan?.actions || [];
  const actionsByFile = new Map();

  for (const action of actions) {
    const skipReason = actionSkipReason(action);
    if (skipReason) {
      skippedActions.push({
        actionId: action.id,
        candidateId: action.candidateId,
        type: action.type,
        mode: action.mode,
        reason: skipReason,
      });
      continue;
    }

    const locations = actionLocations(action);
    if (!locations.length) {
      skippedActions.push({
        actionId: action.id,
        candidateId: action.candidateId,
        type: action.type,
        mode: action.mode,
        reason: 'no_mapped_locations',
      });
      continue;
    }

    for (const location of locations) {
      if (!actionsByFile.has(location.filePath)) actionsByFile.set(location.filePath, []);
      actionsByFile.get(location.filePath).push({ action, location });
    }
  }

  for (const [filePath, items] of actionsByFile.entries()) {
    const entry = zip.getEntry(filePath);
    if (!entry) {
      for (const item of items) {
        skippedActions.push({
          actionId: item.action.id,
          candidateId: item.action.candidateId,
          type: item.action.type,
          mode: item.action.mode,
          reason: 'xhtml_file_not_found',
          filePath,
        });
      }
      continue;
    }

    const html = entry.getData().toString('utf8');
    const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });
    const fileCorrections = [];

    for (const { action, location } of items) {
      const node = findMappedTextNode($, location);
      if (!node) {
        skippedActions.push({
          actionId: action.id,
          candidateId: action.candidateId,
          type: action.type,
          mode: action.mode,
          reason: 'text_node_not_found',
          filePath,
          nodeId: location.id || null,
        });
        continue;
      }

      const result = replaceInTextNode(node, action);
      if (!result) {
        skippedActions.push({
          actionId: action.id,
          candidateId: action.candidateId,
          type: action.type,
          mode: action.mode,
          reason: 'before_text_not_found_in_node',
          filePath,
          nodeId: location.id || null,
        });
        continue;
      }

      const correction = {
        actionId: action.id,
        candidateId: action.candidateId,
        type: action.type,
        mode: action.mode,
        confidence: action.confidence,
        filePath,
        nodeId: location.id || null,
        spineIndex: location.spineIndex,
        paragraphIndex: location.paragraphIndex,
        textNodeIndex: location.textNodeIndex,
        before: result.before,
        after: result.after,
        replacements: result.replacements,
      };
      appliedCorrections.push(correction);
      fileCorrections.push(correction);
    }

    if (fileCorrections.length > 0) {
      zip.updateFile(filePath, Buffer.from($.xml(), 'utf8'));
      changedEntries.push({
        entry: filePath,
        corrections: fileCorrections.length,
        replacements: fileCorrections.reduce((sum, item) => sum + item.replacements, 0),
      });
    }
  }

  return {
    schemaVersion: '1.0',
    appliedCorrections,
    skippedActions,
    changedEntries,
    summary: {
      totalActions: actions.length,
      autoSafeActions: actions.filter(isHighConfidenceAutoSafe).length,
      appliedCorrections: appliedCorrections.length,
      skippedActions: skippedActions.length,
      changedEntries: changedEntries.length,
      replacements: appliedCorrections.reduce((sum, item) => sum + item.replacements, 0),
    },
  };
}

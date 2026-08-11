import crypto from 'node:crypto';
import { normalizeLanguageTag } from '../../utils/language-utils.js';

export function buildMergeMetadata(precheck, options = {}) {
  const sources = precheck.orderedSources || [];
  const title = options.title || suggestMergeTitle(precheck) || 'Livro unido';
  return {
    title,
    creator: consistentValue(sources, 'author') || sources[0]?.author || '',
    language: normalizeLanguageTag(consistentValue(sources, 'language') || sources[0]?.language || 'pt-BR'),
    identifier: options.identifier || `urn:uuid:${crypto.randomUUID()}`,
    modified: options.modified || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  };
}

export function suggestMergeTitle(precheck) {
  const titles = [...new Set((precheck.orderedSources || []).map((source) => source.title).filter(Boolean))];
  if (titles.length === 1) return stripRangeSuffix(titles[0]);
  const common = longestCommonPrefix(titles).trim().replace(/[-–—:,\s]+$/, '');
  return common.length >= 4 ? stripRangeSuffix(common) : titles[0] || 'Livro unido';
}

function consistentValue(sources, field) {
  const values = [...new Set(sources.map((source) => source[field]).filter(Boolean))];
  return values.length === 1 ? values[0] : null;
}

function stripRangeSuffix(title) {
  return String(title || '')
    .replace(/\s*[-–—:]\s*(cap[ií]tulos?|chapters?)?\s*\d+\s*(?:a|to|-|–|—)\s*\d+\s*$/i, '')
    .trim();
}

function longestCommonPrefix(values) {
  if (!values.length) return '';
  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (prefix && !String(value).startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

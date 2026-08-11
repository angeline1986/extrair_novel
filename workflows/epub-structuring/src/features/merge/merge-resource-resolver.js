import crypto from 'node:crypto';
import path from 'node:path';
import { normalizeZipPath } from '../../utils/zip-utils.js';

const OPF_DIR = 'OEBPS';
const RESOURCE_RE = /^(image\/|.*css|.*font|.*opentype|.*truetype)/i;

export function resolveMergeResources(precheck, sourceEpubs) {
  const sourceByPath = new Map(sourceEpubs.map((source) => [source.inventory.sourcePath, source]));
  const collisionTypes = new Map((precheck.resourceCollisions || []).map((collision) => [collision.path, collision.type]));
  const byHashPath = new Map();
  const resources = [];
  const mappings = [];
  const stats = { deduplicated: 0, namespaced: 0, collisions: precheck.resourceCollisions || [] };

  for (const [sourceIndex, inventory] of (precheck.orderedSources || []).entries()) {
    const source = sourceByPath.get(inventory.sourcePath);
    if (!source) throw new Error(`Fonte não carregada para recursos: ${inventory.sourcePath}`);
    for (const item of source.epub.manifestItems.filter((manifestItem) => isResource(manifestItem.mediaType))) {
      const entry = source.epub.zip.getEntry(item.fullPath);
      if (!entry) continue;
      const data = entry.getData();
      const hash = sha256(data);
      const collisionType = collisionTypes.get(item.fullPath);
      const outputPath = chooseOutputPath(item, sourceIndex, collisionType);
      const dedupeKey = collisionType === 'samePathSameHash' ? `${item.fullPath}|${hash}` : `${outputPath}|${hash}`;
      const existing = byHashPath.get(dedupeKey);
      const resolvedPath = existing?.outputPath || outputPath;

      const mapping = {
        sourcePath: inventory.sourcePath,
        sourceFile: inventory.sourceFile,
        sourceFullPath: item.fullPath,
        outputFullPath: resolvedPath,
        outputHref: relativeToOpf(resolvedPath),
        mediaType: item.mediaType,
        hash,
        collisionType: collisionType || 'unique'
      };

      if (existing) stats.deduplicated++;
      else {
        byHashPath.set(dedupeKey, { outputPath: resolvedPath, hash });
        resources.push({
          id: uniqueResourceId(resources.length + 1, item),
          href: relativeToOpf(resolvedPath),
          fullPath: resolvedPath,
          mediaType: item.mediaType,
          properties: item.properties || '',
          data,
          hash,
          mapping
        });
      }

      if (collisionType === 'samePathDifferentHash') stats.namespaced++;
      mappings.push(mapping);
    }
  }

  return { resources, mappings, stats };
}

export function rewriteCssUrls(css, cssMapping, resourceMappings) {
  return String(css || '').replace(/url\(([^)]+)\)/g, (match, rawValue) => {
    const unquoted = rawValue.trim().replace(/^['"]|['"]$/g, '');
    if (!unquoted || isExternalHref(unquoted) || unquoted.startsWith('#') || unquoted.startsWith('data:')) return match;
    const [pathname, suffix] = splitHref(unquoted);
    const sourceFullPath = normalizeZipPath(path.posix.join(path.posix.dirname(cssMapping.sourceFullPath), pathname));
    const target = resourceMappings.find((mapping) => mapping.sourcePath === cssMapping.sourcePath && mapping.sourceFullPath === sourceFullPath);
    if (!target) return match;
    const relative = path.posix.relative(path.posix.dirname(cssMapping.outputFullPath), target.outputFullPath);
    return `url("${relative}${suffix}")`;
  });
}

export function relativeToOpf(fullPath) {
  return path.posix.relative(OPF_DIR, fullPath);
}

function chooseOutputPath(item, sourceIndex, collisionType) {
  const clean = normalizeZipPath(item.fullPath).replace(/^OEBPS\//, '').replace(/^OPS\//, '');
  if (collisionType === 'samePathDifferentHash') {
    return normalizeZipPath(path.posix.join(OPF_DIR, 'assets', `part_${String(sourceIndex + 1).padStart(3, '0')}`, clean));
  }
  return normalizeZipPath(path.posix.join(OPF_DIR, clean));
}

function uniqueResourceId(index, item) {
  const base = String(item.id || path.posix.basename(item.href, path.posix.extname(item.href)) || 'resource')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'resource';
  return `res-${String(index).padStart(3, '0')}-${base}`;
}

function isResource(mediaType) {
  return RESOURCE_RE.test(String(mediaType || ''));
}

function isExternalHref(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}

function splitHref(href) {
  const match = String(href).match(/^([^?#]*)(.*)$/);
  return [match?.[1] || '', match?.[2] || ''];
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

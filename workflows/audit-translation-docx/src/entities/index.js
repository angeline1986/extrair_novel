import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractEntitiesFromSource } from './entityExtractor.js';
import { auditEntities } from './entityAudit.js';
import { normalizeEntities, normalizeEntitiesInDocx } from './entityNormalizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultGlossaryPath = path.join(__dirname, 'entityGlossary.json');

export function loadEntityGlossary(glossaryPath = defaultGlossaryPath) {
  return JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));
}

export {
  extractEntitiesFromSource,
  auditEntities,
  normalizeEntities,
  normalizeEntitiesInDocx,
};

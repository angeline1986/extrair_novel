import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const workflowEventsFile = path.join(projectRoot, 'logs', 'workflow-events.jsonl');
const events = fs.readFileSync(workflowEventsFile, 'utf8')
  .split('\n')
  .filter(l => l.trim())
  .map(l => JSON.parse(l));

// Extract version numbers from FILE_WRITE events
const versionWriteEvents = events.filter(e => 
  e.event === 'FILE_WRITE' && 
  e.action === 'create' && 
  e.destination && 
  e.destination.includes('input-fixed/v')
);

console.log('Found FILE_WRITE create events:', versionWriteEvents.length);

const versionsCreated = new Set();
for (const event of versionWriteEvents) {
  console.log('Event destination:', event.destination);
  const match = event.destination.match(/input-fixed\/v(\d+)\//);
  if (match) {
    console.log('  → extracted version:', `v${match[1]}`);
    versionsCreated.add(`v${match[1]}`);
  }
}

console.log('\nVersions created:', Array.from(versionsCreated).sort().join(', ') || 'nenhuma');

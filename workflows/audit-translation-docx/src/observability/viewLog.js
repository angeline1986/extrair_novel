import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logFile = path.join(__dirname, '../../logs', 'workflow-events.jsonl');

if (!fs.existsSync(logFile)) {
  console.log('Nenhum log encontrado.');
  process.exit(0);
}

const events = fs.readFileSync(logFile, 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const lastRun = events.filter((e) => e.event === 'WORKFLOW_STARTED').slice(-5);

console.log('\n=== ÚLTIMAS EXECUÇÕES ===\n');
for (const run of lastRun) {
  console.log(`📅 ${run.time}`);
  console.log(`   Step: ${run.currentStep}`);
  console.log(`   Modo: ${run.mode}`);
  console.log(`   Args: ${(run.argv || []).join(' ')}`);
  console.log('');
}

console.log('=== EVENTOS DE VERSÃO ===\n');
const versionEvents = events.filter((e) => e.event.includes('VERSION'));
for (const event of versionEvents.slice(-20)) {
  console.log(`[${event.time.substring(11, 19)}] ${event.event}`);
  if (event.details) {
    if (event.details.missingVersions) console.log(`   ⚠️  Ausentes: ${event.details.missingVersions.join(', ')}`);
    if (event.details.explanation) console.log(`   📝 ${event.details.explanation}`);
  }
  console.log('');
}

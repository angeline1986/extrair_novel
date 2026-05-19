// src/observability/workflowLog.js
// Log simples de eventos do workflow (JSON Lines)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const logFile = path.join(projectRoot, 'logs', 'workflow-events.jsonl');

// Garantir que o diretório logs existe
const logsDir = path.dirname(logFile);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Registrar um evento no log (JSON Lines)
 * @param {string} eventName - Nome do evento
 * @param {object} payload - Dados do evento
 */
export function logWorkflowEvent(eventName, payload) {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const event = {
    time: new Date().toISOString(),
    event: eventName,
    ...payload
  };
  
  // Escrever no arquivo (append)
  fs.appendFileSync(logFile, JSON.stringify(event) + '\n');
  
  // Eventos internos ficam no JSONL; no console só aparecem em modo debug explícito.
  if (process.env.AUDIT_DEBUG_EVENTS === '1' || process.argv.includes('--debug-events')) {
    console.log(`  📝 [EVENT] ${eventName}:`, JSON.stringify(payload, null, 2).substring(0, 200));
  }
}

#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  formatReviewQueueValidation,
  validateReviewQueue,
} from './correction/reviewQueueValidator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(__dirname, '..');
const defaultQueuePath = path.join(workflowRoot, 'state/review-queue.json');

function parseArgs(argv) {
  const args = { file: defaultQueuePath };

  for (const arg of argv) {
    if (arg.startsWith('--file=')) args.file = path.resolve(arg.slice('--file='.length));
  }

  return args;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo nao encontrado: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const reviewQueue = readJson(args.file);
  const validation = validateReviewQueue(reviewQueue);

  console.log(`Review queue: ${args.file}`);
  console.log(formatReviewQueueValidation(validation));

  if (!validation.ok) process.exit(1);
}

main();

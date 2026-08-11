import fs from 'fs-extra';
import path from 'node:path';

export async function listEpubs(inputDir) {
  const entries = await fs.readdir(inputDir);
  return entries
    .filter((entry) => entry.toLowerCase().endsWith('.epub'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((name, index) => ({
      index: index + 1,
      name,
      path: path.join(inputDir, name)
    }));
}

export async function selectSingleEpub(terminal, inputDir) {
  const epubs = await listEpubs(inputDir);
  if (epubs.length === 0) {
    return { selected: null, epubs, error: 'Nenhum arquivo .epub encontrado em input/.' };
  }

  printEpubList(epubs);
  const answer = await terminal.ask('Selecione um EPUB ou 0 para voltar: ');
  const selectedIndex = Number(String(answer || '').trim());
  if (selectedIndex === 0) return { selected: null, epubs, cancelled: true };

  const selected = epubs.find((epub) => epub.index === selectedIndex);
  if (!selected) {
    return { selected: null, epubs, error: 'Seleção inválida.' };
  }

  return { selected, epubs };
}

export async function selectMultipleEpubs(terminal, inputDir) {
  const epubs = await listEpubs(inputDir);
  if (epubs.length === 0) {
    return { selected: [], epubs, error: 'Nenhum arquivo .epub encontrado em input/.' };
  }

  printEpubList(epubs);
  const answer = await terminal.ask('Selecione EPUBs (ex: 1,2, 1-4, todos) ou 0 para voltar: ');
  const parsed = parseEpubSelection(answer, epubs.length);
  if (parsed.cancelled) return { selected: [], epubs, cancelled: true };
  if (parsed.error) return { selected: [], epubs, error: parsed.error };

  const selected = parsed.indexes.map((index) => epubs[index - 1]);
  return { selected, epubs };
}

export function parseEpubSelection(value, max) {
  const input = String(value || '').trim().toLowerCase();
  if (!input || input === '0') return { indexes: [], cancelled: input === '0', error: input ? null : 'Seleção vazia.' };
  if (!Number.isInteger(max) || max < 1) return { indexes: [], error: 'Nenhum EPUB disponível.' };
  if (input === 'todos' || input === 'all') {
    return { indexes: Array.from({ length: max }, (_, index) => index + 1) };
  }

  const selected = new Set();
  for (const part of input.split(',').map((item) => item.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (!validIndex(start, max) || !validIndex(end, max) || start > end) return { indexes: [], error: `Intervalo inválido: ${part}` };
      for (let index = start; index <= end; index++) selected.add(index);
      continue;
    }

    if (!/^\d+$/.test(part)) return { indexes: [], error: `Seleção inválida: ${part}` };
    const index = Number(part);
    if (!validIndex(index, max)) return { indexes: [], error: `Índice fora da lista: ${index}` };
    selected.add(index);
  }

  return { indexes: [...selected].sort((a, b) => a - b) };
}

function validIndex(index, max) {
  return Number.isInteger(index) && index >= 1 && index <= max;
}

function printEpubList(epubs) {
  process.stdout.write('\nEPUBs encontrados:\n\n');
  for (const epub of epubs) {
    process.stdout.write(`[${epub.index}] ${epub.name}\n`);
  }
  process.stdout.write('\n');
}

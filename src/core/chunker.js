const MIN_SAFE_MAX_CHARS = 1000;

export function chunkText(text, maxChars = 3000) {
  if (!text || !text.trim()) return [];

  maxChars = normalizeMaxChars(maxChars);

  const normalizedText = normalizeLineBreaks(text);
  const blocks = splitIntoBlocks(normalizedText);

  const chunks = [];
  let current = "";

  for (const block of blocks) {
    if (!block.trim()) continue;

    if (block.length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }

      chunks.push(...splitLargeBlock(block, maxChars));
      continue;
    }

    const candidate = current ? `${current}\n\n${block}` : block;

    if (candidate.length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
      }

      current = block;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

function normalizeLineBreaks(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeMaxChars(maxChars) {
  const parsed = Number(maxChars);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 3000;
  }

  return Math.max(parsed, MIN_SAFE_MAX_CHARS);
}

function splitIntoBlocks(text) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function splitLargeBlock(block, maxChars) {
  if (isSystemBlock(block)) {
    return splitSystemBlock(block, maxChars);
  }

  const sentences = splitIntoSentences(block);

  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }

      chunks.push(...splitBySize(sentence, maxChars));
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
      }

      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

function splitIntoSentences(text) {
  return text
    .split(/(?<=[.!?。！？…]["”’』」)]?)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitSystemBlock(block, maxChars) {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return splitBySize(block, maxChars);
  }

  const chunks = [];
  let current = "";

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;

    if (candidate.length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
      }

      current = line;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function splitBySize(text, maxChars) {
  const chunks = [];

  for (let i = 0; i < text.length; i += maxChars) {
    const chunk = text.slice(i, i + maxChars).trim();

    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

function isSystemBlock(text) {
  const trimmed = text.trim();

  return (
    /^\[.*?\]/.test(trimmed) ||
    /^【.*?】/.test(trimmed) ||
    /^[-—]*\s*(Nome|Idade|Profissão|Status|Espectadores|Sala|Nível|Grau|Progresso|Valor|Relacionado|Alocação|Pontos|Item|Produto)/i.test(trimmed) ||
    /^\|/.test(trimmed) ||
    trimmed.includes("|")
  );
}
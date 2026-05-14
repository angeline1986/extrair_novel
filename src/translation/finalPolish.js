import { translateWithOllama, cleanModelOutput } from "./ollamaClient.js";
import { chunkText } from "./chunker.js";
import { glossary } from "./glossary.js";
import {
  validateModelOutput,
  normalizeSystemBlocks,
  findResidualEnglish,
  findSuspiciousPortuguese,
} from "./validator.js";

function buildFinalPolishPrompt(text) {
  const glossaryText = Object.entries(glossary)
    .map(([en, pt]) => `- ${en} = ${pt}`)
    .join("\n");

  return `
Você é um editor literário profissional especializado em português brasileiro.

Sua tarefa é fazer o POLIMENTO FINAL do texto abaixo.

IMPORTANTE:
- NÃO resuma.
- NÃO corte conteúdo.
- NÃO omita frases.
- NÃO simplifique.
- NÃO reescreva cenas.
- NÃO reduza parágrafos.
- NÃO altere significado.
- NÃO remova diálogos.
- NÃO adicione comentários.
- NÃO use markdown.
- NÃO explique nada.
- NÃO altere nomes próprios.
- NÃO altere tokens §§NAME_0001§§, §§NAME_0002§§, etc.
- Responda SOMENTE com o texto final polido.

Seu trabalho é SOMENTE:
- melhorar fluidez
- corrigir português robótico
- corrigir concordância
- corrigir pontuação
- suavizar traduções literais
- corrigir inglês residual
- corrigir termos inconsistentes
- normalizar blocos de sistema, interface e cartão

Exemplos:
- "Este era uma sala" → "Esta era uma sala"
- "um contagem regressiva" → "uma contagem regressiva"
- "bordo da mesa" → "borda da mesa"
- "milhares de solos" → "milhares de sóis"
- "tela de tamanho palmilhado" → "tela do tamanho da palma da mão"
- "marron" → "marrom"
- "psicologia do streamer" → "controle psicológico do streamer"
- "live broadcast" → "transmissão ao vivo"
- "barrage" → "comentários"
- "instance" → "instância"
- "viewing value" → "valor de audiência"
- "luz de spot" → "holofote"
- "prisionões" → "prisioneiros"
- "distresse" → "angústia"
- "párpados" → "pálpebras"
- "que compositor" → "que compostura"
- "esquinas dos olhos" → "cantos dos olhos"
- "esquinas da boca" → "cantos da boca"
- "789.326qwk" → "789326qwk"
- "Escola Secundária Decai" → "Decai Middle School"

Termos fixos:
- anchor = streamer
- anchors = streamers
- rookie anchor = streamer novato
- new anchor = streamer novato
- novice anchor = streamer novato
- old anchor = streamer veterano
- senior anchor = streamer veterano
- live broadcast = transmissão ao vivo
- live broadcast room = sala de transmissão
- live room = sala de transmissão
- live broadcasting backstage = bastidores da transmissão
- live broadcast square = praça de transmissões ao vivo
- broadcast interface = interface da transmissão
- barrage = comentários
- instance = instância
- instance difficulty level = nível de dificuldade da instância
- viewing value = valor de audiência
- online viewers = espectadores online
- online audience = espectadores online
- identity card = cartão de identidade
- product name = nome do item
- novice gift = presente de iniciante
- novice gift package = pacote de presente de iniciante
- apple seedling = muda de maçã
- countdown = contagem regressiva
- streamer soul quality = qualidade da alma do streamer
- hidden item = item oculto
- prop = item
- props = itens
- reward points = pontos de recompensa
- plot modification = modificação da trama
- collection degree = grau de coleta
- collection progress = progresso de coleta
- completion degree = grau de conclusão

Blocos de sistema e interface:
- Preserve colchetes como [04:25], [Status: Ao vivo], 【...】.
- Traduza o conteúdo dentro dos colchetes quando for frase comum.
- Não traduza códigos como 789326qwk.
- Em cartões de identidade, coloque campos em linhas separadas:
[Cartão de Identidade]
Nome: ...
Idade: ...
Profissão: ...
Relacionado à Trama: ...
- Se o original vier grudado, normalize a formatação sem remover informação.

Mantenha:
- tom de webnovel
- suspense
- humor
- ritmo narrativo
- formatação
- parágrafos
- diálogos
- Preserve EXATAMENTE a mesma quantidade de parágrafos do texto original.
- Nunca remova linhas.
- Nunca combine parágrafos.

Ruídos proibidos:
- Nunca inclua /think.
- Nunca inclua <think>, </think>, <thinking>, </thinking>, <reasoning> ou </reasoning>.
- Nunca inclua "Claro", "Aqui está", "Segue", "Texto final" ou comentários do modelo.

Nomes próprios protegidos:
- Não traduza títulos de arco como Decai Middle School, Fukang Hospital, Antai Community, Fantasy Amusement Park, Ping An Asylum, Changsheng Building, Xingwang Hotel, Yuying University, Lucky Cruise Ship e Infinite Train.
- Não traduza Nightmare, Nightmare Live Studio, Oracle, Dark Fire, Integrity First ou Anchor Hall.

Glossário obrigatório:
${glossaryText}

Texto:
${text}
`.trim();
}

function countParagraphs(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function hasSameParagraphCount(original, polished) {
  return countParagraphs(original) === countParagraphs(polished);
}

function hasSuspiciousShrink(original, polished, ratio = 0.8) {
  return polished.length < original.length * ratio;
}

function hasSuspiciousExpansion(original, polished, ratio = 1.8) {
  return polished.length > original.length * ratio;
}

function hasLostNameTokens(original, polished) {
  const originalTokens = original.match(/§§NAME_\d+§§/g) ?? [];
  const polishedTokens = polished.match(/§§NAME_\d+§§/g) ?? [];

  return originalTokens.some((token) => !polishedTokens.includes(token));
}

function hasAssistantNoise(text) {
  const lowered = text.trim().toLowerCase();

  return (
    lowered.startsWith("claro") ||
    lowered.startsWith("aqui está") ||
    lowered.startsWith("segue") ||
    lowered.startsWith("texto polido") ||
    lowered.startsWith("texto final") ||
    lowered.startsWith("versão polida") ||
    text.includes("```") ||
    text.includes("/think") ||
    /<\/?think>/i.test(text) ||
    /<\/?thinking>/i.test(text) ||
    /<\/?reasoning>/i.test(text)
  );
}

function isProbablyInvalidPolish(original, polished) {
  if (!polished || !polished.trim()) return true;

  if (hasSuspiciousShrink(original, polished)) return true;

  if (hasSuspiciousExpansion(original, polished)) return true;

  if (hasLostNameTokens(original, polished)) return true;

  if (hasAssistantNoise(polished)) return true;

  return false;
}

function logValidationWarnings(blockIndex, validation) {
  if (validation.warnings?.length > 0) {
    console.warn(`⚠️ Avisos no polimento do bloco ${blockIndex}.`);
    console.warn(validation.warnings.join("\n"));
  }

  if (validation.severeErrors?.length > 0) {
    console.warn(`🚨 Erros graves no polimento do bloco ${blockIndex}.`);
    console.warn(validation.severeErrors.join("\n"));
  }
}

function logResidualEnglish(blockIndex, text) {
  const residual = findResidualEnglish(text);

  if (residual.length > 0) {
    console.warn(
      `⚠️ Inglês residual no bloco ${blockIndex}: ${residual.join(", ")}`
    );
  }
}

function logSuspiciousPortuguese(blockIndex, text) {
  const suspicious = findSuspiciousPortuguese(text);

  if (suspicious.length > 0) {
    console.warn(
      `⚠️ Português suspeito no bloco ${blockIndex}: ${suspicious.join(", ")}`
    );
  }
}

function shouldKeepOriginalBecauseOfStructure(originalChunk, polished, blockIndex) {
  if (!hasSameParagraphCount(originalChunk, polished)) {
    console.warn(
      `⚠️ Bloco ${blockIndex} mudou a quantidade exata de parágrafos. Mantendo original.`
    );

    return true;
  }

  return false;
}

function shouldKeepOriginalBecauseInvalid(originalChunk, polished, blockIndex) {
  if (isProbablyInvalidPolish(originalChunk, polished)) {
    console.warn(
      `⚠️ Bloco ${blockIndex} parece inválido no polimento. Mantendo original.`
    );

    return true;
  }

  return false;
}

export async function finalPolish(text, options = {}) {
  const model = options.model ?? "qwen2.5:7b";

  // chunks maiores para qwen2.5:7b e menos fragmentação
  const maxChars = options.maxChars ?? 2600;

  const numPredict = options.numPredict ?? 3072;

  console.log("✨ Polimento final da tradução...");

  const chunks = chunkText(text, maxChars);

  console.log(`✅ Total de blocos para polimento: ${chunks.length}`);

  const polishedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    const blockIndex = i + 1;

    console.log(`✨ Polindo bloco ${blockIndex}/${chunks.length}...`);

    const originalChunk = chunks[i];

    const prompt = buildFinalPolishPrompt(originalChunk);

    let polished = "";

    try {
      polished = await translateWithOllama(prompt, model, {
        temperature: options.temperature ?? 0.05,
        numPredict,
      });

      polished = cleanModelOutput(polished);
      polished = normalizeSystemBlocks(polished);
    } catch (error) {
      console.warn(
        `⚠️ Erro ao polir bloco ${blockIndex}. Mantendo texto original do bloco.`
      );
      console.warn(error.message);

      polishedChunks.push(originalChunk);
      continue;
    }

    const validation = validateModelOutput({
      original: originalChunk,
      output: polished,
      stage: "finalPolish",
      minLengthRatio: options.minLengthRatio ?? 0.6,
      maxLengthRatio: options.maxLengthRatio ?? 1.8,
      minParagraphRatio: options.minParagraphRatio ?? 0.6,
      requireSameNameTokens: true,
      checkResidualEnglish: true,
      checkSuspiciousPortuguese: true,
      checkCodes: true,
      checkProtectedTitles: true,
    });

    logValidationWarnings(blockIndex, validation);
    logResidualEnglish(blockIndex, polished);
    logSuspiciousPortuguese(blockIndex, polished);

    if (!validation.ok) {
      console.warn(
        `⚠️ Bloco ${blockIndex} falhou em validação grave no polimento. Mantendo original.`
      );

      polishedChunks.push(originalChunk);
      continue;
    }

    polished = normalizeSystemBlocks(polished);

    polishedChunks.push(polished);
  }

  return polishedChunks.join("\n\n");
}
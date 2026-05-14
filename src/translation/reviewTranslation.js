import { translateWithOllama, cleanModelOutput } from "./ollamaClient.js";
import { chunkText } from "./chunker.js";
import { glossary } from "./glossary.js";
import {
  validateModelOutput,
  normalizeSystemBlocks,
  findResidualEnglish,
  findSuspiciousPortuguese,
} from "./validator.js";

function buildReviewPrompt(text) {
  const glossaryText = Object.entries(glossary)
    .map(([en, pt]) => `- ${en} = ${pt}`)
    .join("\n");

  return `
Você é um revisor literário profissional de português brasileiro.

Sua tarefa é revisar a tradução abaixo, comparando sentido, fluidez e naturalidade.

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
- Responda SOMENTE com o texto revisado.

Seu trabalho é SOMENTE:
- corrigir erros de português
- corrigir concordância
- corrigir pontuação
- corrigir fluidez robótica
- remover literalismos
- corrigir termos inconsistentes
- corrigir inglês residual
- corrigir frases sem sentido

Correções obrigatórias:
- "milhares de solos" → "milhares de sóis"
- "tela de tamanho palmilhado" → "tela do tamanho da palma da mão"
- "bordo da mesa" → "borda da mesa"
- "marron" → "marrom"
- "psicologia do streamer" → "controle psicológico do streamer"
- "sentimento de iminência" → "sensação de inquietação iminente"
- "presente de iniciância" → "presente de iniciante"
- "valor de visualização" → "valor de audiência"
- "live broadcast" → "transmissão ao vivo"
- "barrage" → "comentários"
- "instance" → "instância"
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
- Nunca inclua "Claro", "Aqui está", "Segue", "Texto revisado" ou comentários do modelo.

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

function hasSameParagraphCount(original, reviewed) {
  return countParagraphs(original) === countParagraphs(reviewed);
}

function hasSuspiciousShrink(original, reviewed, ratio = 0.75) {
  return reviewed.length < original.length * ratio;
}

function hasSuspiciousExpansion(original, reviewed, ratio = 1.9) {
  return reviewed.length > original.length * ratio;
}

function hasLostNameTokens(original, reviewed) {
  const originalTokens = original.match(/§§NAME_\d+§§/g) ?? [];
  const reviewedTokens = reviewed.match(/§§NAME_\d+§§/g) ?? [];

  return originalTokens.some((token) => !reviewedTokens.includes(token));
}

function hasAssistantNoise(text) {
  const lowered = text.trim().toLowerCase();

  return (
    lowered.startsWith("claro") ||
    lowered.startsWith("aqui está") ||
    lowered.startsWith("segue") ||
    lowered.startsWith("texto revisado") ||
    lowered.startsWith("versão revisada") ||
    lowered.startsWith("revisão") ||
    text.includes("```") ||
    text.includes("/think") ||
    /<\/?think>/i.test(text) ||
    /<\/?thinking>/i.test(text) ||
    /<\/?reasoning>/i.test(text)
  );
}

function isProbablyInvalidReview(original, reviewed) {
  if (!reviewed || !reviewed.trim()) return true;

  if (hasSuspiciousShrink(original, reviewed)) return true;

  if (hasSuspiciousExpansion(original, reviewed)) return true;

  if (hasLostNameTokens(original, reviewed)) return true;

  if (hasAssistantNoise(reviewed)) return true;

  return false;
}

function logValidationWarnings(blockIndex, validation) {
  if (validation.warnings?.length > 0) {
    console.warn(`⚠️ Avisos na revisão do bloco ${blockIndex}.`);
    console.warn(validation.warnings.join("\n"));
  }

  if (validation.severeErrors?.length > 0) {
    console.warn(`🚨 Erros graves na revisão do bloco ${blockIndex}.`);
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

function shouldKeepOriginalBecauseInvalid(originalChunk, reviewed, blockIndex) {
  if (isProbablyInvalidReview(originalChunk, reviewed)) {
    console.warn(
      `⚠️ Bloco ${blockIndex} parece inválido na revisão. Mantendo original.`
    );

    return true;
  }

  return false;
}

function shouldKeepOriginalBecauseOfStructure(originalChunk, reviewed, blockIndex) {
  if (!hasSameParagraphCount(originalChunk, reviewed)) {
    console.warn(
      `⚠️ Bloco ${blockIndex} mudou a quantidade exata de parágrafos. Mantendo original.`
    );

    return true;
  }

  return false;
}

export async function reviewTranslation(text, options = {}) {
  const model = options.model ?? "qwen2.5:7b";

  // menor para reduzir risco de resumo/corte
  const maxChars = options.maxChars ?? 1500;

  const numPredict = options.numPredict ?? 2048;

  console.log("🔎 Revisando tradução...");

  const chunks = chunkText(text, maxChars);

  console.log(`✅ Total de blocos para revisão: ${chunks.length}`);

  const reviewedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    const blockIndex = i + 1;

    console.log(`🔎 Revisando bloco ${blockIndex}/${chunks.length}...`);

    const originalChunk = chunks[i];

    const prompt = buildReviewPrompt(originalChunk);

    let reviewed = "";

    try {
      reviewed = await translateWithOllama(prompt, model, {
        temperature: options.temperature ?? 0.08,
        numPredict,
      });

      reviewed = cleanModelOutput(reviewed);
      reviewed = normalizeSystemBlocks(reviewed);
    } catch (error) {
      console.warn(
        `⚠️ Erro ao revisar bloco ${blockIndex}. Mantendo texto original do bloco.`
      );
      console.warn(error.message);

      reviewedChunks.push(originalChunk);
      continue;
    }

    const validation = validateModelOutput({
      original: originalChunk,
      output: reviewed,
      stage: "reviewTranslation",
      minLengthRatio: options.minLengthRatio ?? 0.6,
      maxLengthRatio: options.maxLengthRatio ?? 1.9,
      minParagraphRatio: options.minParagraphRatio ?? 0.6,
      requireSameNameTokens: true,
      checkResidualEnglish: true,
      checkSuspiciousPortuguese: true,
      checkCodes: true,
      checkProtectedTitles: true,
    });

    logValidationWarnings(blockIndex, validation);
    logResidualEnglish(blockIndex, reviewed);
    logSuspiciousPortuguese(blockIndex, reviewed);

    if (validation.severity === "critical") {
      console.warn(
        `🚨 Bloco ${blockIndex} falhou em validação crítica na revisão. Mantendo versão anterior do bloco.`
      );

      reviewedChunks.push(originalChunk);
      continue;
    }

    if (validation.severity === "warning") {
      console.warn(
        `⚠️ Bloco ${blockIndex} com warning leve na revisão; mantendo revisão gerada.`
      );
    }

    reviewed = normalizeSystemBlocks(reviewed);

    reviewedChunks.push(reviewed);
  }

  return reviewedChunks.join("\n\n");
}
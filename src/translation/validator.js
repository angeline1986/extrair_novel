const PROTECTED_TITLES = [
  "Decai Middle School",
  "Fukang Hospital",
  "Fukang Private General Hospital",
  "Antai Community",
  "Fantasy Amusement Park",
  "Ping An Asylum",
  "Ping'an Asylum",
  "Changsheng Building",
  "Xingwang Hotel",
  "Yuying University",
  "Lucky Cruise Ship",
  "Infinite Train",
  "Nightmare Live Studio",
  "Nightmare",
  "Oracle",
  "Dark Fire",
  "Integrity First",
  "Anchor Hall",
];

const BAD_TITLE_TRANSLATIONS = [
  { regex: /Escola Secundária Decai/i, message: "Decai Middle School foi traduzido como Escola Secundária Decai" },
  { regex: /Hospital Fukang/i, message: "Fukang Hospital foi traduzido" },
  { regex: /Hospital Geral Privado Fukang/i, message: "Fukang Private General Hospital foi traduzido" },
  { regex: /Comunidade Antai/i, message: "Antai Community foi traduzido" },
  { regex: /Parque de Diversões Fantasia/i, message: "Fantasy Amusement Park foi traduzido" },
  { regex: /Asilo Ping An/i, message: "Ping An Asylum foi traduzido" },
  { regex: /Edifício Changsheng/i, message: "Changsheng Building foi traduzido" },
  { regex: /Hotel Xingwang/i, message: "Xingwang Hotel foi traduzido" },
  { regex: /Universidade Yuying/i, message: "Yuying University foi traduzido" },
  { regex: /Cruzeiro da Sorte/i, message: "Lucky Cruise Ship foi traduzido" },
  { regex: /Trem Infinito/i, message: "Infinite Train foi traduzido" },
  { regex: /sala de transmissão Nightmare/i, message: "Nightmare live broadcast room deve manter padrão definido" },
];

const ALLOWED_ENGLISH_TERMS = [
  "Nightmare",
  "Nightmare Live Studio",
  "Decai Middle School",
  "Fukang Hospital",
  "Fukang Private General Hospital",
  "Antai Community",
  "Fantasy Amusement Park",
  "Ping An Asylum",
  "Ping'an Asylum",
  "Changsheng Building",
  "Xingwang Hotel",
  "Yuying University",
  "Lucky Cruise Ship",
  "Infinite Train",
  "Oracle",
  "Dark Fire",
  "Integrity First",
  "Anchor Hall",
  "Wen Jianyan",
  "Su Cheng",
  "Wu Zhu",
  "Orange Candy",
  "Hugo",
  "Blond",
  "Chen Mo",
  "Yun Bilan",
  "Wen Ya",
  "Qi Qian",
  "Bai Xue",
  "Dan Zhu",
  "An Xin",
  "Ji Guan",
  "Tong Yao",
  "Zhang Yu",
  "Kong Shixing",
  "Xu Yuan",
  "Xiao Jie",
  "Cheng Wei",
  "Dean Shen",
  "Teacher Yang",
  "Wang Ping",
  "Mason",
  "Xiao Wen",
];

const RESIDUAL_ENGLISH_TERMS = [
  "live room",
  "live broadcast",
  "live broadcasting",
  "broadcasting",
  "broadcast interface",
  "live broadcast interface",
  "live broadcast square",
  "online viewers",
  "online audience",
  "survival time allocation completed",
  "initial survival time allocation",
  "identity card",
  "id card",
  "product name",
  "apple seedling",
  "viewing value",
  "rookie anchor",
  "new anchor",
  "novice anchor",
  "old anchor",
  "senior anchor",
  "anchor",
  "anchors",
  "host",
  "barrage",
  "instance",
  "instance difficulty level",
  "reward points",
  "collection degree",
  "collection progress",
  "completion degree",
  "plot modification",
  "plot deviation",
  "hidden item",
  "hidden items",
  "prop",
  "props",
  "system store",
  "renaming card",
  "status: on air",
  "on air",
  "chapter",
  "arc",
  "teacher",
  "student",
  "main task",
  "live broadcast task",
  "audience rewards",
  "highest unlocking progress",
  "instance exploration",
  "initial survival time",
  "gift package",
  "flower pot",
  "hey",
  "lol",
  "lmao",
  "wtf",
];

const SUSPICIOUS_PORTUGUESE_PATTERNS = [
  ["este era uma sala", /\bEste era uma sala\b/i],
  ["um contagem regressiva", /\bum contagem regressiva\b/i],
  ["o contagem regressiva", /\bo contagem regressiva\b/i],
  ["chegou ao zero", /\bchegou ao zero\b/i],
  ["backstage literal", /\bbackstage\b/i],
  ["luz de spot", /\bluz de spot\b/i],
  ["prisionões", /\bprisionões\b/i],
  ["serei seu servidor", /\bserei seu servidor\b/i],
  ["distresse", /\bdistresse\b/i],
  ["párpados", /\bpárpados\b/i],
  ["compositor usado no lugar de compostura", /\bque compositor\b/i],
  ["cesta de cimento", /\bcesta de cimento\b/i],
  ["maior ordem", /\bmaior ordem\b/i],
  ["ambiente infestado", /\bambiente infestado\b/i],
  ["esquinas dos olhos/boca", /\besquinas? d[ao]s? (olhos|boca)\b/i],
  ["pequeno sombra", /\bpequen[oa] sombra\b/i],
  ["presos/prisionões inconsistentes", /\bprisionões\b/i],
  ["qualidade da alma do streamer", /\bqualidade da alma do streamer\b/i],
  ["texto de sistema em inglês", /【[A-Za-z ,.!?;:'"-]+】/],
  ["solos usado como tradução provável de suns", /\bsolos\b/i],
  ["bordo da mesa", /\bbordo da mesa\b/i],
  ["tamanho palmilhado", /\btamanho palmilhado\b/i],
  ["marron", /\bmarron\b/i],
  ["um pequena", /\bum pequena\b/i],
  ["uma pequeno", /\buma pequeno\b/i],
  ["cantos das lábios", /\bcantos das lábios\b/i],
  ["psicologia do streamer", /\bpsicologia do streamer\b/i],
  ["presente de iniciância", /\bpresente de iniciância\b/i],
  ["valor de visualização", /\bvalor de visualização\b/i],
  ["relógio de contagem regressiva", /\brelógio de contagem regressiva\b/i],
  ["vidraça usado para glass/wall", /\bvidraça\b/i],
  ["faces familiares", /\bfaces familiares\b/i],
  ["camas para deitar", /\bcamas para deitar\b/i],
  ["esquinas da boca", /\besquinas da boca\b/i],
  ["esquinas dos olhos", /\besquinas dos olhos\b/i],
  ["desvencilhar uma quantia", /\bdesvencilhar uma quantia\b/i],
  ["inacreditavelmente estranho", /\binacreditavelmente estranho\b/i],
  ["seda longa sedosa", /\bseda longa sedosa\b/i],
  ["ficou em repouso", /\bficou em repouso\b/i],
  ["reflexão do rosto", /\breflexão do (seu )?rosto\b/i],
  ["se estreitavam gradualmente", /\bse estreitavam gradualmente\b/i],
  ["início da verdadeira inferno", /\binício da verdadeira inferno\b/i],
  ["luz brilhante demais literal", /\bluz brilhante\b/i],
  ["servidor usado para assistant", /\bservidor\b/i],
  ["carta usado para card", /\bcarta na mão\b/i],
  ["reflexão usado no lugar de reflexo", /\breflexão\b/i],
  ["seu histórico de vida", /\bseu histórico de vida\b/i],
];

const MODEL_CONTAMINATION_PATTERNS = [
  /here is the translation/i,
  /i translated/i,
  /segue a tradução/i,
  /aqui está a tradução/i,
  /thinking/i,
  /reasoning/i,
  /```/i,
];

function hasModelContamination(text) {
  return MODEL_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function validateModelOutput({
  original,
  output,
  stage = "unknown",
  minLengthRatio = 0.55,
  maxLengthRatio = 1.8,
  minParagraphRatio = 0.55,
  requireSameNameTokens = true,
  checkResidualEnglish = true,
  checkSuspiciousPortuguese = true,
  checkCodes = true,
  checkProtectedTitles = true,
} = {}) {
  const warnings = [];
  const criticalErrors = [];

  const messageEmpty = `[${stage}] Resposta vazia.`;
  if (!output || !output.trim()) {
    warnings.push(messageEmpty);
    criticalErrors.push(messageEmpty);
    return {
      ok: false,
      severity: "critical",
      warnings,
      errors: criticalErrors,
      severeErrors: criticalErrors,
    };
  }

  if (hasThinkingLeak(output) || hasModelContamination(output)) {
    const message = `[${stage}] Contaminação do modelo detectada.`;
    warnings.push(message);
    criticalErrors.push(message);
  }

  const originalLength = original.length;
  const outputLength = output.length;

  if (outputLength < originalLength * minLengthRatio) {
    const message = `[${stage}] Resposta muito curta: ${outputLength}/${originalLength} caracteres.`;
    if (outputLength < originalLength * 0.35) {
      criticalErrors.push(message);
    } else {
      warnings.push(message);
    }
  }

  if (outputLength > originalLength * maxLengthRatio) {
    const message = `[${stage}] Resposta muito longa: ${outputLength}/${originalLength} caracteres.`;
    warnings.push(message);
  }

  const originalParagraphs = countParagraphs(original);
  const outputParagraphs = countParagraphs(output);

  if (outputParagraphs < originalParagraphs * 0.5) {
    const message = `[${stage}] Perda significativa de parágrafos: ${outputParagraphs}/${originalParagraphs}.`;
    criticalErrors.push(message);
  } else if (outputParagraphs < originalParagraphs * minParagraphRatio) {
    const message = `[${stage}] Poucos parágrafos: ${outputParagraphs}/${originalParagraphs}.`;
    warnings.push(message);
  }

  if (hasAssistantPreamble(output)) {
    const message = `[${stage}] A resposta contém comentário ou prévia do modelo.`;
    warnings.push(message);
    criticalErrors.push(message);
  }

  if (requireSameNameTokens) {
    const missingTokens = findMissingNameTokens(original, output);

    if (missingTokens.length > 0) {
      const message = `[${stage}] Tokens de nomes ausentes: ${missingTokens.join(", ")}`;
      if (hasSignificantMissingNameTokens(original, output)) {
        criticalErrors.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  if (checkResidualEnglish) {
    const residualEnglish = findResidualEnglish(output);

    if (residualEnglish.length > 0) {
      const message = `[${stage}] Inglês residual detectado: ${residualEnglish.join(", ")}`;
      if (hasMajorEnglishResidual(output, residualEnglish)) {
        criticalErrors.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  if (checkSuspiciousPortuguese) {
    const suspiciousPatterns = findSuspiciousPortuguese(output);

    if (suspiciousPatterns.length > 0) {
      warnings.push(
        `[${stage}] Português suspeito: ${suspiciousPatterns.join(", ")}`
      );
    }
  }

  if (checkCodes) {
    const changedCodes = findChangedCodes(original, output);

    if (changedCodes.length > 0) {
      const message = `[${stage}] Códigos possivelmente alterados: ${changedCodes.join(", ")}`;
      warnings.push(message);
      criticalErrors.push(message);
    }
  }

  if (checkProtectedTitles) {
    const titleIssues = findProtectedTitleIssues(output);

    if (titleIssues.length > 0) {
      warnings.push(
        `[${stage}] Títulos próprios alterados: ${titleIssues.join(", ")}`
      );
    }
  }

  const severity = criticalErrors.length > 0 ? "critical" : warnings.length > 0 ? "warning" : "ok";

  return {
    ok: severity !== "critical",
    severity,
    warnings,
    errors: criticalErrors,
    severeErrors: criticalErrors,
  };
}

export function countParagraphs(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export function findNameTokens(text) {
  return [...new Set(text.match(/§§NAME_\d+§§/g) ?? [])];
}

export function findMissingNameTokens(original, output) {
  const originalTokens = findNameTokens(original);
  const outputTokens = findNameTokens(output);

  return originalTokens.filter((token) => !outputTokens.includes(token));
}

function hasSignificantMissingNameTokens(original, output) {
  const missing = findMissingNameTokens(original, output);
  const originalTokens = findNameTokens(original);

  if (missing.length === 0) return false;
  if (missing.length >= 3) return true;

  return originalTokens.length > 0 && missing.length / originalTokens.length > 0.2;
}

export function hasThinkingLeak(text) {
  return (
    text.includes("/think") ||
    /<\/?think>/i.test(text) ||
    /<\/?thinking>/i.test(text) ||
    /<\/?reasoning>/i.test(text)
  );
}

export function hasAssistantPreamble(text) {
  const trimmed = text.trim().toLowerCase();

  const badStarts = [
    "claro",
    "aqui está",
    "segue",
    "aqui está a tradução",
    "here is the translation",
    "i translated",
    "tradução:",
    "texto traduzido:",
    "texto revisado:",
    "versão revisada:",
    "texto final:",
    "polimento final:",
    "resultado:",
  ];

  const badContains = [
    /<think>/i,
    /<thinking>/i,
    /<reasoning>/i,
    /\/think/i,
    /```/i,
    /thinking/i,
    /reasoning/i,
    /análise/i,
    /explicação/i,
    /analysis/i,
    /explanation/i,
  ];

  return (
    badStarts.some((start) => trimmed.startsWith(start)) ||
    badContains.some((pattern) => pattern.test(text)) ||
    hasThinkingLeak(text)
  );
}

export function findResidualEnglish(text) {
  const cleaned = removeAllowedEnglishTerms(text).toLowerCase();

  return RESIDUAL_ENGLISH_TERMS.filter((term) =>
    cleaned.includes(term.toLowerCase())
  );
}

function hasMajorEnglishResidual(text, residualTerms) {
  if (residualTerms.length > 5) return true;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const englishLines = lines.filter((line) =>
    RESIDUAL_ENGLISH_TERMS.some((term) =>
      line.toLowerCase().includes(term.toLowerCase())
    )
  );

  return englishLines.length >= 2 ||
    lines.some((line) => /\bthis\b|\bthat\b|\bhere\b|\bwill\b|\bwould\b/i.test(line));
}

function removeAllowedEnglishTerms(text) {
  let cleaned = text;

  for (const term of ALLOWED_ENGLISH_TERMS) {
    cleaned = cleaned.replaceAll(term, "");
  }

  return cleaned;
}

export function findSuspiciousPortuguese(text) {
  return SUSPICIOUS_PORTUGUESE_PATTERNS
    .filter(([, regex]) => regex.test(text))
    .map(([label]) => label);
}

export function findChangedCodes(original, output) {
  const originalCodes = extractCodes(original);
  const outputCodes = extractCodes(output);

  const issues = [];

  for (const code of originalCodes) {
    if (!outputCodes.includes(code)) {
      issues.push(code);
    }
  }

  return issues;
}

function extractCodes(text) {
  const matches = text.match(/\b[a-zA-Z0-9]{5,}[a-zA-Z0-9]*\b/g) ?? [];

  return [...new Set(matches)].filter((item) => {
    if (/^\d+$/.test(item)) return false;
    if (/^[A-Z][a-z]+$/.test(item)) return false;
    if (/^[A-Z]{2,}$/.test(item)) return false;

    return /\d/.test(item) && /[a-zA-Z]/.test(item);
  });
}

export function findProtectedTitleIssues(text) {
  const issues = [];

  for (const { regex, message } of BAD_TITLE_TRANSLATIONS) {
    if (regex.test(text)) {
      issues.push(message);
    }
  }

  return issues;
}

export function normalizeSystemBlocks(text) {
  return text
    .replace(/\/think/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/<\/?thinking>/gi, "")
    .replace(/<\/?reasoning>/gi, "")

    .replace(/\[Live room ([^\]]+)\]/gi, "[Sala de transmissão $1]")
    .replace(/\[Live broadcast room ([^\]]+)\]/gi, "[Sala de transmissão $1]")
    .replace(/\[Online viewers:\s*(\d+)\]/gi, "[Espectadores online: $1]")
    .replace(/\[Online audience:\s*(\d+)\]/gi, "[Espectadores online: $1]")
    .replace(/\[Status:\s*On air\]/gi, "[Status: Ao vivo]")
    .replace(/\[Status:\s*Live\]/gi, "[Status: Ao vivo]")

    .replace(
      /【Survival time allocation completed\.?】/gi,
      "【Alocação do tempo de sobrevivência concluída.】"
    )
    .replace(
      /【Initial survival time allocation\.?】/gi,
      "【Alocação inicial do tempo de sobrevivência.】"
    )
    .replace(/【Collection Degree:\s*([^\】]+)】/gi, "【Grau de coleta: $1】")
    .replace(/【Collection Progress:\s*([^\】]+)】/gi, "【Progresso de coleta: $1】")
    .replace(/【Completion Degree:\s*([^\】]+)】/gi, "【Grau de conclusão: $1】")
    .replace(/【Reward points:\s*([^\】]+)】/gi, "【Pontos de recompensa: $1】")
    .replace(/【Plot Modification:\s*([^\】]+)】/gi, "【Modificação da trama: $1】")

    .replace(/\[Product Name:\s*Apple Seedling\]/gi, "[Nome do item: Muda de maçã]")
    .replace(/\[Product Name:\s*/gi, "[Nome do item: ")
    .replace(/\[Identity Card\]/gi, "[Cartão de Identidade]")
    .replace(/\[ID Card\]/gi, "[Cartão de Identidade]")

    .replace(/\[Cartão de Identidade\]\s*Nome:/g, "[Cartão de Identidade]\nNome:")
    .replace(/Nome:\s*([^\n]+?)Idade:/g, "Nome: $1\nIdade:")
    .replace(/Idade:\s*([^\n]+?)Profissão:/g, "Idade: $1\nProfissão:")
    .replace(/Profissão:\s*([^\n]+?)Relacionado à Trama:/g, "Profissão: $1\nRelacionado à Trama:")
    .replace(/Relacionado à Trama:\s*([^\n]+?)Alocação/g, "Relacionado à Trama: $1\nAlocação")

    .replace(/\b789\.326qwk\b/g, "789326qwk")

    .replace(/\bEscola Secundária Decai\b/g, "Decai Middle School")
    .replace(/\bHospital Fukang\b/g, "Fukang Hospital")
    .replace(/\bHospital Geral Privado Fukang\b/g, "Fukang Private General Hospital")
    .replace(/\bComunidade Antai\b/g, "Antai Community")
    .replace(/\bParque de Diversões Fantasia\b/g, "Fantasy Amusement Park")
    .replace(/\bAsilo Ping An\b/g, "Ping An Asylum")
    .replace(/\bEdifício Changsheng\b/g, "Changsheng Building")
    .replace(/\bHotel Xingwang\b/g, "Xingwang Hotel")
    .replace(/\bUniversidade Yuying\b/g, "Yuying University")
    .replace(/\bCruzeiro da Sorte\b/g, "Lucky Cruise Ship")
    .replace(/\bTrem Infinito\b/g, "Infinite Train")

    .replace(/\bHey\b/g, "Ei")
    .replace(/\bLol\b/g, "Hahaha")
    .replace(/\blol\b/g, "hahaha")
    .replace(/\bLmao\b/g, "Hahaha")
    .replace(/\blmao\b/g, "hahaha")
    .replace(/\bWTF\b/g, "Que diabos")
    .replace(/\bwtf\b/g, "que diabos")

    .replace(/\blive room\b/gi, "sala de transmissão")
    .replace(/\blive broadcast room\b/gi, "sala de transmissão")
    .replace(/\blive broadcast\b/gi, "transmissão ao vivo")
    .replace(/\blive broadcasting\b/gi, "transmissão ao vivo")
    .replace(/\bbroadcast interface\b/gi, "interface da transmissão")
    .replace(/\bonline viewers\b/gi, "espectadores online")
    .replace(/\bonline audience\b/gi, "espectadores online")
    .replace(/\bviewing value\b/gi, "valor de audiência")
    .replace(/\bidentity card\b/gi, "cartão de identidade")
    .replace(/\bid card\b/gi, "cartão de identidade")
    .replace(/\bproduct name\b/gi, "nome do item")
    .replace(/\bapple seedling\b/gi, "muda de maçã")
    .replace(/\brookie anchor\b/gi, "streamer novato")
    .replace(/\bnew anchor\b/gi, "streamer novato")
    .replace(/\bnovice anchor\b/gi, "streamer novato")
    .replace(/\bold anchor\b/gi, "streamer veterano")
    .replace(/\bsenior anchor\b/gi, "streamer veterano")
    .replace(/\banchors\b/gi, "streamers")
    .replace(/\banchor\b/gi, "streamer")
    .replace(/\bbarrage\b/gi, "comentários")
    .replace(/\binstance\b/gi, "instância")
    .replace(/\breward points\b/gi, "pontos de recompensa")
    .replace(/\bcollection degree\b/gi, "grau de coleta")
    .replace(/\bcollection progress\b/gi, "progresso de coleta")
    .replace(/\bcompletion degree\b/gi, "grau de conclusão")
    .replace(/\bplot modification\b/gi, "modificação da trama")
    .replace(/\bplot deviation\b/gi, "desvio da trama")
    .replace(/\bhidden items\b/gi, "itens ocultos")
    .replace(/\bhidden item\b/gi, "item oculto")
    .replace(/\bprops\b/gi, "itens")
    .replace(/\bprop\b/gi, "item")
    .replace(/\bsystem store\b/gi, "loja do sistema")
    .replace(/\brenaming card\b/gi, "cartão de renomeação")
    .replace(/\bmain task\b/gi, "tarefa principal")
    .replace(/\blive broadcast task\b/gi, "tarefa da transmissão ao vivo")
    .replace(/\baudience rewards\b/gi, "recompensas da audiência")
    .replace(/\bhighest unlocking progress\b/gi, "maior progresso de desbloqueio")
    .replace(/\binstance exploration\b/gi, "exploração da instância")
    .replace(/\binitial survival time\b/gi, "tempo de sobrevivência inicial")
    .replace(/\bgift package\b/gi, "pacote de presente")
    .replace(/\bflower pot\b/gi, "vaso de flores")

    .replace(/\bluz de spot\b/gi, "holofote")
    .replace(/\bprisionões\b/gi, "prisioneiros")
    .replace(/\bserei seu servidor\b/gi, "vou servi-lo")
    .replace(/\bdistresse\b/gi, "angústia")
    .replace(/\bpárpados\b/gi, "pálpebras")
    .replace(/\bque compositor\b/gi, "que compostura")
    .replace(/\bcesta de cimento\b/gi, "tambor de cimento")
    .replace(/\bmaior ordem\b/gi, "maior golpe")
    .replace(/\bambiente infestado\b/gi, "ambiente opressivo")
    .replace(/\besquinas dos olhos\b/gi, "cantos dos olhos")
    .replace(/\besquinas da boca\b/gi, "cantos da boca")
    .replace(/\bpequeno sombra\b/gi, "pequena sombra")
    .replace(/\bqualidade da alma do streamer\b/gi, "qualidade da alma")
    .replace(/\brelógio de contagem regressiva\b/gi, "contagem regressiva")
    .replace(/\bfaces familiares\b/gi, "rostos familiares")
    .replace(/\bcamas para deitar\b/gi, "beliches")
    .replace(/\bdesvencilhar uma quantia\b/gi, "arrancar uma quantia")
    .replace(/\binacreditavelmente estranho\b/gi, "indescritivelmente estranho")
    .replace(/\bseda longa sedosa\b/gi, "longa fita de seda")
    .replace(/\bficou em repouso\b/gi, "estava pousado")
    .replace(/\breflexão do seu rosto\b/gi, "reflexo do seu rosto")
    .replace(/\breflexão do rosto\b/gi, "reflexo do rosto")
    .replace(/\bse estreitavam gradualmente\b/gi, "se alargavam gradualmente")
    .replace(/\binício da verdadeira inferno\b/gi, "verdadeiro começo infernal")
    .replace(/\bluz brilhante\b/gi, "luz intensa")
    .replace(/\bcarta na mão\b/gi, "cartão na mão")
    .replace(/\bseu histórico de vida\b/gi, "sua história de vida")

    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getValidatorConfigSummary() {
  return {
    protectedTitles: PROTECTED_TITLES.length,
    allowedEnglishTerms: ALLOWED_ENGLISH_TERMS.length,
    residualEnglishTerms: RESIDUAL_ENGLISH_TERMS.length,
    suspiciousPortuguesePatterns: SUSPICIOUS_PORTUGUESE_PATTERNS.length,
    badTitleTranslations: BAD_TITLE_TRANSLATIONS.length,
  };
}
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
} from "docx";

// =====================================================
// MODOS:
// node workflows/review-translation/scripts/analyzeTranslation.js analisar --project=nome_da_obra
// node workflows/review-translation/scripts/analyzeTranslation.js corrigir --project=nome_da_obra
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKFLOW_DIR = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.join(WORKFLOW_DIR, "projects");
const INPUT_DIR = path.join(WORKFLOW_DIR, "input");
const REPORTS_DIR = path.join(WORKFLOW_DIR, "reports");
const OUTPUT_FIXED_DIR = path.join(WORKFLOW_DIR, "output");

const FEMININE_PRONOUNS = ["ela", "dela", "nela", "consigo mesma"];
const MASCULINE_PRONOUNS = ["ele", "dele", "nele", "consigo mesmo"];
const GENDER_ADJECTIVE_PAIRS = [
  ["cansado", "cansada"],
  ["preocupado", "preocupada"],
  ["surpreso", "surpresa"],
  ["sozinho", "sozinha"],
  ["exausto", "exausta"],
  ["nervoso", "nervosa"],
  ["envergonhado", "envergonhada"],
  ["horrorizado", "horrorizada"],
  ["perplexo", "perplexa"],
  ["assustado", "assustada"],
  ["desajeitado", "desajeitada"],
  ["calado", "calada"],
];

const GLOBAL_AUTO_CORRECTIONS = [
  [/^-\s*/g, "—"],
  [/\/think/gi, ""],
  [/<\/?think>/gi, ""],
  [/<\/?thinking>/gi, ""],
  [/<\/?reasoning>/gi, ""],
  [/\bpárpados\b/gi, "pálpebras"],
  [/\bprisionões\b/gi, "prisioneiros"],
  [/\bdistresse\b/gi, "angústia"],
];

// =====================================================
// HELPERS
// =====================================================

function cleanText(text = "") {
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function excerpt(text, max = 260) {
  const t = cleanText(text);
  return t.length <= max ? t : t.slice(0, max) + "...";
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordRegex(value, flags = "iu") {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, flags);
}

function parseArgs(argv) {
  const mode = argv.find((arg) => !arg.startsWith("--")) || "analisar";
  const projectArg = argv.find((arg) => arg.startsWith("--project="));

  return {
    mode,
    projectKey: projectArg?.split("=").slice(1).join("=").trim() || "",
  };
}

function normalizeProjectConfig(config, projectKey) {
  return {
    projectName: cleanText(config.projectName) || projectKey,
    characters: Array.isArray(config.characters) ? config.characters : [],
    customGlossary:
      config.customGlossary && typeof config.customGlossary === "object"
        ? config.customGlossary
        : {},
    expressionRules: Array.isArray(config.expressionRules) ? config.expressionRules : [],
  };
}

function loadProjectConfig(projectKey) {
  if (!projectKey) {
    throw new Error(
      "Projeto não informado. Use --project=nome_do_arquivo_sem_json."
    );
  }

  const projectPath = path.join(PROJECTS_DIR, `${projectKey}.json`);

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Arquivo de projeto não encontrado: ${projectPath}`);
  }

  const rawConfig = JSON.parse(fs.readFileSync(projectPath, "utf8"));

  return {
    key: projectKey,
    path: projectPath,
    ...normalizeProjectConfig(rawConfig, projectKey),
  };
}

function parseRuleRegex(regexValue) {
  if (regexValue instanceof RegExp) return regexValue;

  const raw = String(regexValue || "");
  const literalMatch = raw.match(/^\/(.+)\/([a-z]*)$/i);

  if (literalMatch) {
    const [, pattern, flags] = literalMatch;
    const normalizedFlags = flags.includes("i") ? flags : `${flags}i`;
    return new RegExp(pattern, normalizedFlags);
  }

  return new RegExp(raw, "iu");
}

function normalizeExpressionRule(rule) {
  if (!rule?.regex || !rule.problem || !rule.suggestion) return null;

  return {
    regex: parseRuleRegex(rule.regex),
    problem: rule.problem,
    suggestion: rule.suggestion,
  };
}

function getVolumeName(fileName, fullText) {
  const byText = fullText.match(/Volume\s+\d+/i);
  if (byText) return byText[0];

  const byFile = fileName.match(/volume[_\s-]*(\d+)/i);
  if (byFile) return `Volume ${byFile[1]}`;

  return path.basename(fileName, ".docx");
}

function splitChapters(fullText) {
  const lines = fullText
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);

  const chapters = [];
  let current = null;

  for (const line of lines) {
    if (/^Cap[ií]tulo\s+\d+/i.test(line)) {
      if (current) chapters.push(current);
      current = {
        title: line,
        paragraphs: [],
      };
    } else if (current) {
      current.paragraphs.push(line);
    }
  }

  if (current) chapters.push(current);

  if (!chapters.length) {
    return [
      {
        title: "Capítulo não detectado",
        paragraphs: lines,
      },
    ];
  }

  return chapters;
}

function addIssue(rows, volume, chapter, problem, suggestion, trecho, tipo = "Revisão") {
  rows.push({
    Volume: volume,
    Capitulo: chapter,
    "Problema encontrado": problem,
    "Sugestão de melhoria": suggestion,
    Trecho: excerpt(trecho),
    Tipo: tipo,
  });
}

// =====================================================
// ANÁLISE DE GÊNERO
// =====================================================

function getOppositeGenderTerms(gender) {
  if (gender === "masculino") {
    return {
      pronouns: FEMININE_PRONOUNS,
      adjectives: GENDER_ADJECTIVE_PAIRS.map(([, feminine]) => feminine),
      expectedPronouns: MASCULINE_PRONOUNS.join("/"),
      expectedAdjectives: "masculino",
    };
  }

  if (gender === "feminino") {
    return {
      pronouns: MASCULINE_PRONOUNS,
      adjectives: GENDER_ADJECTIVE_PAIRS.map(([masculine]) => masculine),
      expectedPronouns: FEMININE_PRONOUNS.join("/"),
      expectedAdjectives: "feminino",
    };
  }

  return null;
}

function analyzeGender(rows, volume, chapterTitle, paragraphs, projectConfig) {
  const lastMentionByCharacter = new Map();
  const characters = projectConfig.characters.filter(
    (character) => character.name && ["masculino", "feminino"].includes(character.gender)
  );

  for (const p of paragraphs) {
    for (const character of characters) {
      const characterRegex = wordRegex(character.name);
      const hasCharacter = characterRegex.test(p);
      const terms = getOppositeGenderTerms(character.gender);

      if (!terms) continue;

      const pronounRegex = new RegExp(
        `\\b(${terms.pronouns.map(escapeRegExp).join("|")})\\b`,
        "iu"
      );
      const adjectiveRegex = new RegExp(
        `\\b(${terms.adjectives.map(escapeRegExp).join("|")})\\b`,
        "iu"
      );

      if (hasCharacter && pronounRegex.test(p)) {
        addIssue(
          rows,
          volume,
          chapterTitle,
          `Possível troca de gênero envolvendo ${character.name}`,
          `Se o sujeito for ${character.name}, revisar para: ${terms.expectedPronouns}.`,
          p,
          "Gênero"
        );
      }

      if (hasCharacter && adjectiveRegex.test(p)) {
        addIssue(
          rows,
          volume,
          chapterTitle,
          `Adjetivo possivelmente incompatível com ${character.name}`,
          `Se o adjetivo se refere a ${character.name}, revisar para o ${terms.expectedAdjectives}.`,
          p,
          "Gênero"
        );
      }

      if (lastMentionByCharacter.get(character.name) && pronounRegex.test(p)) {
        addIssue(
          rows,
          volume,
          chapterTitle,
          `Pronome possivelmente incompatível após menção a ${character.name}`,
          `Verificar se o sujeito ainda é ${character.name}. Se for, revisar para: ${terms.expectedPronouns}.`,
          p,
          "Gênero"
        );
      }

      lastMentionByCharacter.set(character.name, hasCharacter);
    }
  }
}

// =====================================================
// ANÁLISE DE EXPRESSÕES RUINS
// =====================================================

const GLOBAL_EXPRESSION_RULES = [
  {
    regex: /\bcompanheiro de copo\b/i,
    problem: "Expressão literal pouco natural",
    suggestion: "Trocar por 'companheiro de bebida' ou 'companhia nas bebedeiras'.",
  },
  {
    regex: /\bte ajudarei no banheiro\b/i,
    problem: "Expressão pouco natural em PT-BR",
    suggestion: "Trocar por 'vou ajudar no banho' ou 'vou auxiliá-lo no banho'.",
  },
  {
    regex: /\bajudarei no banheiro\b/i,
    problem: "Expressão literal",
    suggestion: "Trocar por 'ajudarei no banho' ou 'auxiliarei no banho'.",
  },
  {
    regex: /\bengula essas batatas\b/i,
    problem: "Expressão estranha",
    suggestion: "Trocar por 'coma essas batatas também'.",
  },
  {
    regex: /\bficar completamente congelada\b/i,
    problem: "Erro de sentido/gênero provável",
    suggestion: "Trocar por 'deve estar completamente congelada' ou 'congelado', conforme o sujeito.",
  },
  {
    regex: /\bXingamento\b/i,
    problem: "Tradução literal inadequada",
    suggestion: "Trocar por 'Droga', 'Maldição' ou outro xingamento natural no contexto.",
  },
  {
    regex: /\bEstou lhe dizendo, é seguro\b/i,
    problem: "Expressão literal sem naturalidade",
    suggestion: "Trocar por 'Estou dizendo, é verdade' ou 'Tenho certeza do que estou dizendo'.",
  },
  {
    regex: /\bcavalheiro de baixa patente\b/i,
    problem: "Possível termo incorreto",
    suggestion: "Se estiver falando da ordem militar, trocar 'cavalheiro' por 'cavaleiro'.",
  },
  {
    regex: /\bcuidados no leito\b/i,
    problem: "Expressão artificial",
    suggestion: "Trocar por 'cuidados na cama' ou reformular conforme o duplo sentido.",
  },
  {
    regex: /\bExiste outro tipo de atendimento\b/i,
    problem: "Diálogo pouco natural",
    suggestion: "Trocar por 'Você quer dizer outro tipo de cuidado?' ou 'Existe outro tipo de serviço?'.",
  },
  {
    regex: /\b-Me siga\b/,
    problem: "Pontuação de diálogo inconsistente",
    suggestion: "Trocar por '—Siga-me.' ou '—Me siga.', mantendo padrão com travessão.",
  },
  {
    regex: /^-[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/,
    problem: "Diálogo usando hífen em vez de travessão",
    suggestion: "Trocar o hífen inicial '-' por travessão '—'.",
  },
  {
    regex: /\bindo ao encontro dele\b/i,
    problem: "Construção possivelmente truncada",
    suggestion: "Revisar frase. Pode ser 'não pude sair para recebê-la/recebê-lo'.",
  },
  {
    regex: /\bluz de spot\b/i,
    problem: "Tradução artificial",
    suggestion: "Trocar por 'holofote'.",
  },
  {
    regex: /\bprisionões\b/i,
    problem: "Erro ortográfico",
    suggestion: "Trocar por 'prisioneiros'.",
  },
  {
    regex: /\bserei seu servidor\b/i,
    problem: "Tradução literal inadequada",
    suggestion: "Trocar por 'vou servi-lo' ou 'vou auxiliá-lo'.",
  },
  {
    regex: /\bdistresse\b/i,
    problem: "Palavra artificial/inadequada",
    suggestion: "Trocar por 'angústia', 'aflição' ou 'desconforto'.",
  },
  {
    regex: /\bpárpados\b/i,
    problem: "Erro ortográfico",
    suggestion: "Trocar por 'pálpebras'.",
  },
  {
    regex: /\bque compositor\b/i,
    problem: "Erro de tradução: composer/composture",
    suggestion: "Trocar por 'que compostura'.",
  },
  {
    regex: /\/think|<\/?think>|<\/?thinking>|<\/?reasoning>/i,
    problem: "Vazamento de raciocínio do modelo",
    suggestion: "Remover tag de raciocínio.",
  },
];

function analyzeExpressions(rows, volume, chapterTitle, paragraphs, projectConfig) {
  const rules = [
    ...GLOBAL_EXPRESSION_RULES,
    ...projectConfig.expressionRules.map(normalizeExpressionRule).filter(Boolean),
  ];

  for (const p of paragraphs) {
    for (const rule of rules) {
      rule.regex.lastIndex = 0;

      if (rule.regex.test(p)) {
        addIssue(
          rows,
          volume,
          chapterTitle,
          rule.problem,
          rule.suggestion,
          p,
          "Expressão"
        );
      }
    }
  }
}

// =====================================================
// CORREÇÕES AUTOMÁTICAS
// =====================================================

function applyGlobalCorrections(text) {
  return GLOBAL_AUTO_CORRECTIONS.reduce(
    (current, [regex, replacement]) => current.replace(regex, replacement),
    text
  );
}

function applyProjectGlossary(text, glossary) {
  let current = text;

  for (const [wrongTerm, correctTerm] of Object.entries(glossary)) {
    if (!wrongTerm) continue;
    current = current.replace(wordRegex(wrongTerm, "giu"), correctTerm);
  }

  return current;
}

function applyDynamicGenderCorrections(text, projectConfig) {
  let current = text;

  for (const character of projectConfig.characters) {
    if (!character.name || !["masculino", "feminino"].includes(character.gender)) {
      continue;
    }

    if (!wordRegex(character.name).test(current)) continue;

    if (character.gender === "masculino") {
      current = current
        .replace(/\bela\b/g, "ele")
        .replace(/\bEla\b/g, "Ele")
        .replace(/\bdela\b/g, "dele")
        .replace(/\bDela\b/g, "Dele")
        .replace(/\bnela\b/g, "nele")
        .replace(/\bNela\b/g, "Nele")
        .replace(/\bconsigo mesma\b/gi, "consigo mesmo");

      for (const [masculine, feminine] of GENDER_ADJECTIVE_PAIRS) {
        current = current.replace(wordRegex(feminine, "giu"), masculine);
      }
    }

    if (character.gender === "feminino") {
      current = current
        .replace(/\bele\b/g, "ela")
        .replace(/\bEle\b/g, "Ela")
        .replace(/\bdele\b/g, "dela")
        .replace(/\bDele\b/g, "Dela")
        .replace(/\bnele\b/g, "nela")
        .replace(/\bNele\b/g, "Nela")
        .replace(/\bconsigo mesmo\b/gi, "consigo mesma");

      for (const [masculine, feminine] of GENDER_ADJECTIVE_PAIRS) {
        current = current.replace(wordRegex(masculine, "giu"), feminine);
      }
    }
  }

  return current;
}

function corrigirTexto(texto, projectConfig) {
  let t = cleanText(texto);

  t = applyGlobalCorrections(t);
  t = applyProjectGlossary(t, projectConfig.customGlossary);
  t = applyDynamicGenderCorrections(t, projectConfig);

  return t;
}

// =====================================================
// LEITURA DOCX
// =====================================================

async function readDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
}

// =====================================================
// GERA PLANILHA
// =====================================================

function gerarPlanilha(rows, projectConfig) {
  ensureDir(REPORTS_DIR);

  const outputXlsx = path.join(
    REPORTS_DIR,
    `${projectConfig.key}_revisao_traducao_genero_expressoes.xlsx`
  );

  const worksheet = XLSX.utils.json_to_sheet(
    rows.length
      ? rows
      : [
          {
            Volume: "",
            Capitulo: "",
            "Problema encontrado": "Nenhum problema encontrado pelas regras atuais",
            "Sugestão de melhoria": "",
            Trecho: "",
            Tipo: "",
          },
        ]
  );

  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 35 },
    { wch: 45 },
    { wch: 75 },
    { wch: 95 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Revisao");
  XLSX.writeFile(workbook, outputXlsx);

  console.log(`\n✅ Planilha gerada: ${path.resolve(outputXlsx)}`);
  console.log(`🔍 Total de apontamentos: ${rows.length}`);
}

// =====================================================
// GERA DOCX CORRIGIDO
// =====================================================

function criarParagrafoTitulo(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 32,
        font: "Times New Roman",
      }),
    ],
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  });
}

function criarParagrafoCapitulo(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
        font: "Times New Roman",
      }),
    ],
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 300 },
  });
}

function criarParagrafoTexto(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 24,
        font: "Times New Roman",
      }),
    ],
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 720 },
    spacing: { after: 160 },
  });
}

async function gerarDocxCorrigido(fileName, fullText, projectConfig) {
  ensureDir(OUTPUT_FIXED_DIR);

  const lines = fullText
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);

  const children = [];

  for (const line of lines) {
    const corrected = corrigirTexto(line, projectConfig);

    if (/^Volume\s+\d+/i.test(corrected)) {
      children.push(criarParagrafoTitulo(corrected));
    } else if (/^Cap[ií]tulo\s+\d+/i.test(corrected)) {
      children.push(criarParagrafoCapitulo(corrected));
    } else {
      children.push(criarParagrafoTexto(corrected));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);

  const outputPath = path.join(
    OUTPUT_FIXED_DIR,
    fileName.replace(/\.docx$/i, `_${projectConfig.key}_corrigido.docx`)
  );

  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Corrigido: ${outputPath}`);
}

// =====================================================
// MAIN
// =====================================================

export async function main(argv = process.argv.slice(2)) {
  const { mode: MODE, projectKey } = parseArgs(argv);

  if (!["analisar", "corrigir"].includes(MODE)) {
    console.error("❌ Modo inválido. Use:");
    console.error("node workflows/review-translation/scripts/analyzeTranslation.js analisar --project=nome_da_obra");
    console.error("node workflows/review-translation/scripts/analyzeTranslation.js corrigir --project=nome_da_obra");
    process.exit(1);
  }

  let projectConfig;

  try {
    projectConfig = loadProjectConfig(projectKey);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    console.error(`Pasta de projetos: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Pasta não encontrada: ${INPUT_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(INPUT_DIR)
    .filter(f => f.toLowerCase().endsWith(".docx"));

  if (!files.length) {
    console.error(`❌ Nenhum .docx encontrado em: ${INPUT_DIR}`);
    process.exit(1);
  }

  const rows = [];

  console.log(`📚 Projeto: ${projectConfig.projectName}`);
  console.log(`⚙️ Configuração: ${projectConfig.path}`);

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file);
    console.log(`📄 Lendo: ${file}`);

    const fullText = await readDocxText(filePath);

    if (MODE === "corrigir") {
      await gerarDocxCorrigido(file, fullText, projectConfig);
      continue;
    }

    const volume = getVolumeName(file, fullText);
    const chapters = splitChapters(fullText);

    for (const chapter of chapters) {
      console.log(`  🔎 Analisando ${chapter.title}`);
      analyzeGender(rows, volume, chapter.title, chapter.paragraphs, projectConfig);
      analyzeExpressions(rows, volume, chapter.title, chapter.paragraphs, projectConfig);
    }
  }

  if (MODE === "analisar") {
    gerarPlanilha(rows, projectConfig);
  } else {
    console.log(`\n✅ Arquivos corrigidos gerados em: ${path.resolve(OUTPUT_FIXED_DIR)}`);
  }
}

if (process.argv[1]?.endsWith("analyzeTranslation.js")) {
  main().catch(err => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
  });
}

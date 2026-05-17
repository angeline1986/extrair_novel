import fs from "fs";
import path from "path";
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
// node workflows/review-translation/scripts/analyzeTranslation.js analisar
// node workflows/review-translation/scripts/analyzeTranslation.js corrigir
// =====================================================

const INPUT_DIR = path.join(process.cwd(), "workflows/review-translation/input");
const OUTPUT_XLSX = path.join(
  process.cwd(),
  "workflows/review-translation/reports/revisao_traducao_genero_expressoes.xlsx"
);
const OUTPUT_FIXED_DIR = path.join(process.cwd(), "workflows/review-translation/output");

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

function analyzeGender(rows, volume, chapterTitle, paragraphs) {
  let lastMentionWasRensley = false;

  for (const p of paragraphs) {
    const hasRensley = /\bRensley\b/i.test(p);

    if (hasRensley && /\b(ela|dela|nela|consigo mesma)\b/i.test(p)) {
      addIssue(
        rows,
        volume,
        chapterTitle,
        "Possível troca de gênero envolvendo Rensley",
        "Se o sujeito for Rensley, revisar para masculino: ele/dele/nele/consigo mesmo.",
        p,
        "Gênero"
      );
    }

    if (
      hasRensley &&
      /\b(cansada|preocupada|surpresa|sozinha|exausta|nervosa|envergonhada|horrorizada|perplexa|assustada|desajeitada|calada)\b/i.test(p)
    ) {
      addIssue(
        rows,
        volume,
        chapterTitle,
        "Adjetivo feminino possivelmente aplicado a Rensley",
        "Se o adjetivo se refere a Rensley, trocar para masculino: cansado, preocupado, surpreso, sozinho etc.",
        p,
        "Gênero"
      );
    }

    if (lastMentionWasRensley && /^(Ela|Dela|Nela)\b/.test(p)) {
      addIssue(
        rows,
        volume,
        chapterTitle,
        "Parágrafo começa com pronome feminino após menção a Rensley",
        "Verificar se o sujeito ainda é Rensley. Se for, trocar para ele/dele/nele.",
        p,
        "Gênero"
      );
    }

    if (/Rensley/i.test(p) && /\bPrincesa\b/i.test(p)) {
      addIssue(
        rows,
        volume,
        chapterTitle,
        "Uso de 'Princesa' associado a Rensley",
        "Pode estar correto pelo disfarce, mas revisar se atrapalha a leitura.",
        p,
        "Gênero / contexto"
      );
    }

    if (/Rensley/i.test(p) && /\bnoiva\b/i.test(p)) {
      addIssue(
        rows,
        volume,
        chapterTitle,
        "Uso de 'noiva' associado a Rensley",
        "Pode estar correto pelo disfarce, mas revisar se no contexto interno seria melhor 'noivo falso'.",
        p,
        "Gênero / contexto"
      );
    }

    lastMentionWasRensley = hasRensley;
  }
}

// =====================================================
// ANÁLISE DE EXPRESSÕES RUINS
// =====================================================

const expressionRules = [
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
    regex: /\bsócio do Grão-Duque\b/i,
    problem: "Título/expressão provavelmente incorreta",
    suggestion: "Verificar se o sentido correto seria 'consorte', 'parceiro', 'acompanhante' ou 'cônjuge'.",
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
    regex: /\bEscola Secundária Decai\b/i,
    problem: "Nome próprio traduzido",
    suggestion: "Manter como 'Decai Middle School'.",
  },
  {
    regex: /\b789\.326qwk\b/i,
    problem: "Código alterado indevidamente",
    suggestion: "Trocar por '789326qwk'.",
  },
  {
    regex: /\/think|<\/?think>|<\/?thinking>|<\/?reasoning>/i,
    problem: "Vazamento de raciocínio do modelo",
    suggestion: "Remover tag de raciocínio.",
  },
];

function analyzeExpressions(rows, volume, chapterTitle, paragraphs) {
  for (const p of paragraphs) {
    for (const rule of expressionRules) {
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

function corrigirTexto(texto) {
  let t = cleanText(texto);

  // Pontuação de diálogo
  t = t.replace(/^-\s*/g, "—");

  // Expressões ruins
  t = t.replace(/\bcompanheiro de copo\b/gi, "companheiro de bebida");
  t = t.replace(/\bte ajudarei no banheiro\b/gi, "vou ajudar no banho");
  t = t.replace(/\bajudarei no banheiro\b/gi, "ajudarei no banho");
  t = t.replace(/\bengula essas batatas\b/gi, "coma essas batatas também");
  t = t.replace(/\bXingamento\b/gi, "Droga");
  t = t.replace(/\bEstou lhe dizendo, é seguro\b/gi, "Estou dizendo, é verdade");
  t = t.replace(/\bcavalheiro de baixa patente\b/gi, "cavaleiro de baixa patente");
  t = t.replace(/\bcuidados no leito\b/gi, "cuidados na cama");
  t = t.replace(
    /\bExiste outro tipo de atendimento\b/gi,
    "Você quer dizer outro tipo de cuidado?"
  );
  t = t.replace(/\bsócio do Grão-Duque\b/gi, "consorte do Grão-Duque");

  // CALL -> LIGAR (telefone) errado em fantasia/histórico
  // Regras específicas primeiro
  t = t.replace(/\bo duque ligou para\b/gi, "o duque mandou chamar");
  t = t.replace(/\ba princesa ligou para\b/gi, "a princesa chamou");

  // Pronomes comuns
  t = t.replace(/\bligou para ela\b/gi, "a chamou");
  t = t.replace(/\bligou para ele\b/gi, "o chamou");

  t = t.replace(/\bestava ligando para ela\b/gi, "estava chamando ela");
  t = t.replace(/\bestava ligando para ele\b/gi, "estava chamando ele");

  // Genéricos
  t = t.replace(/\bligou para\b/gi, "mandou chamar");
  t = t.replace(/\bligar para\b/gi, "mandar chamar");

  t = t.replace(/\bme ligue\b/gi, "me chame");
  t = t.replace(/\bligue para mim\b/gi, "mande me chamar");

  // Correções de gênero só quando o parágrafo cita Rensley.
  if (/\bRensley\b/i.test(t)) {
    t = t
      .replace(/\bela\b/g, "ele")
      .replace(/\bEla\b/g, "Ele")
      .replace(/\bdela\b/g, "dele")
      .replace(/\bDela\b/g, "Dele")
      .replace(/\bnela\b/g, "nele")
      .replace(/\bNela\b/g, "Nele")
      .replace(/\bconsigo mesma\b/gi, "consigo mesmo")
      .replace(/\bcansada\b/g, "cansado")
      .replace(/\bpreocupada\b/g, "preocupado")
      .replace(/\bsurpresa\b/g, "surpreso")
      .replace(/\bsozinha\b/g, "sozinho")
      .replace(/\bexausta\b/g, "exausto")
      .replace(/\bnervosa\b/g, "nervoso")
      .replace(/\benvergonhada\b/g, "envergonhado")
      .replace(/\bhorrorizada\b/g, "horrorizado")
      .replace(/\bperplexa\b/g, "perplexo")
      .replace(/\bassustada\b/g, "assustado")
      .replace(/\bdesajeitada\b/g, "desajeitado")
      .replace(/\bcalada\b/g, "calado");
  }

  // Correções específicas do projeto atual
  t = t.replace(/\/think/gi, "");
  t = t.replace(/<\/?think>/gi, "");
  t = t.replace(/<\/?thinking>/gi, "");
  t = t.replace(/<\/?reasoning>/gi, "");

  t = t.replace(/\b789\.326qwk\b/g, "789326qwk");
  t = t.replace(/\bEscola Secundária Decai\b/g, "Decai Middle School");

  t = t.replace(/\bluz de spot\b/gi, "holofote");
  t = t.replace(/\bprisionões\b/gi, "prisioneiros");
  t = t.replace(/\bserei seu servidor\b/gi, "vou servi-lo");
  t = t.replace(/\bdistresse\b/gi, "angústia");
  t = t.replace(/\bpárpados\b/gi, "pálpebras");
  t = t.replace(/\bque compositor\b/gi, "que compostura");
  t = t.replace(/\bcesta de cimento\b/gi, "tambor de cimento");
  t = t.replace(/\bmaior ordem\b/gi, "maior golpe");
  t = t.replace(/\bambiente infestado\b/gi, "ambiente opressivo");
  t = t.replace(/\besquinas dos olhos\b/gi, "cantos dos olhos");
  t = t.replace(/\besquinas da boca\b/gi, "cantos da boca");
  t = t.replace(/\bpequeno sombra\b/gi, "pequena sombra");

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

function gerarPlanilha(rows) {
  ensureDir(path.dirname(OUTPUT_XLSX));

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
  XLSX.writeFile(workbook, OUTPUT_XLSX);

  console.log(`\n✅ Planilha gerada: ${path.resolve(OUTPUT_XLSX)}`);
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

async function gerarDocxCorrigido(fileName, fullText) {
  ensureDir(OUTPUT_FIXED_DIR);

  const lines = fullText
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);

  const children = [];

  for (const line of lines) {
    const corrected = corrigirTexto(line);

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
    fileName.replace(/\.docx$/i, "_corrigido.docx")
  );

  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Corrigido: ${outputPath}`);
}

// =====================================================
// MAIN
// =====================================================

export async function main(argv = process.argv.slice(2)) {
  const MODE = argv[0] || "analisar";

  if (!["analisar", "corrigir"].includes(MODE)) {
    console.error("❌ Modo inválido. Use:");
    console.error("node workflows/review-translation/scripts/analyzeTranslation.js analisar");
    console.error("node workflows/review-translation/scripts/analyzeTranslation.js corrigir");
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

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file);
    console.log(`📄 Lendo: ${file}`);

    const fullText = await readDocxText(filePath);

    if (MODE === "corrigir") {
      await gerarDocxCorrigido(file, fullText);
      continue;
    }

    const volume = getVolumeName(file, fullText);
    const chapters = splitChapters(fullText);

    for (const chapter of chapters) {
      console.log(`  🔎 Analisando ${chapter.title}`);
      analyzeGender(rows, volume, chapter.title, chapter.paragraphs);
      analyzeExpressions(rows, volume, chapter.title, chapter.paragraphs);
    }
  }

  if (MODE === "analisar") {
    gerarPlanilha(rows);
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

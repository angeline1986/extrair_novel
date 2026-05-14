const PROTECTED_PATTERNS = [
  // tokens já protegidos no novo formato
  /§§NAME_\d+§§/g,

  // códigos especiais e identificadores com letras e números
  /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{6,}\b/g,

  // colchetes/sistema leves
  /\[[^\]]+\]/g,
  /【[^】]+】/g,
];

const FIXED_PROTECTED_TERMS = [
  // arcos
  "Decai Middle School",
  "Fukang Hospital",
  "Antai Community",
  "Fantasy Amusement Park",
  "Ping An Asylum",
  "Changsheng Building",
  "Xingwang Hotel",
  "Yuying University",
  "Lucky Cruise Ship",

  // arcos / locais adicionais
  "Fukang Private General Hospital",
  "Ping'an Asylum",
  "Infinite Train",

  // organizações
  "Nightmare Live Studio",
  "Oracle",
  "Dark Fire",

  // organizações / conceitos adicionais
  "Nightmare",
  "Integrity First",
  "Anchor Hall",

  // personagens
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

  // personagens adicionais
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

export function extractProperNames(text) {
  const detected = new Set();

  // termos fixos primeiro
  for (const term of FIXED_PROTECTED_TERMS) {
    if (text.includes(term)) {
      detected.add(term);
    }
  }

  // nomes compostos estilo chinês/inglês
  const compoundNames =
    text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) ?? [];

  for (const name of compoundNames) {
    if (shouldIgnoreName(name)) continue;

    detected.add(name.trim());
  }

  return [...detected].sort((a, b) => b.length - a.length);
}

function shouldIgnoreName(name) {
  const ignored = [
    "Chapter",
    "Arc",
    "Instance",
    "Status",
    "Name",
    "Age",
    "Occupation",
    "Related",
    "Plot",
    "Online",
    "Viewers",
    "System",
    "Live",
    "Room",
    "Anchor",
    "Broadcast",
    "Identity",
    "Card",
    "Product",
    "Reward",
    "Points",
    "Viewing",
    "Value",
    "Completion",
    "Degree",
    "Collection",
    "Progress",
    "Initial",
    "Survival",
    "Time",
    "On",
    "Air",
    "The",
    "End",
    "Thank",
    "You",
    "However",
    "After",
    "There",
    "What",
    "This",
    "That",
    "Not",
    "Middle",
    "Wen",
    "Jianyan",
  ];

  return ignored.includes(name);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function protectNames(text, names = []) {
  let protectedText = text;

  const map = {};

  let counter = 1;

  const allProtectedTerms = [
    ...new Set([
      ...names,
      ...FIXED_PROTECTED_TERMS,
    ]),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  // protege termos conhecidos
  for (const term of allProtectedTerms) {
    const token = createToken(counter++);

    map[token] = term;

    protectedText = protectedText.replace(
      new RegExp(escapeRegExp(term), "g"),
      token
    );
  }

  // protege padrões especiais
  for (const pattern of PROTECTED_PATTERNS) {
    const matches = protectedText.match(pattern) ?? [];

    for (const match of matches) {
      if (alreadyProtected(match)) continue;

      const token = createToken(counter++);

      map[token] = match;

      protectedText = protectedText.replace(match, token);
    }
  }

  return {
    protectedText,
    map,
  };
}

function alreadyProtected(text) {
  return /§§NAME_\d+§§/.test(text);
}

function createToken(number) {
  return `§§NAME_${String(number).padStart(4, "0")}§§`;
}

export function restoreNames(text, map) {
  let restored = text;

  const entries = Object.entries(map).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [token, original] of entries) {
    restored = restored.replaceAll(token, original);
  }

  return restored;
}
const ignoredPhrases = new Set([
  "Oh God",
  "The End",
  "Thank You",
  "Product Name",
  "Reward Points",
  "Viewing Value",
  "Completion Degree",
  "Collection Degree",
  "Instance Difficulty Level",
  "Highest Unlocking Progress",
  "Related Plot",
  "Initial Survival Time",
  "Live Room",
  "Status On",
]);

const alwaysProtect = [
  "Wen Jianyan",
  "Su Cheng",
  "Qi Qian",
  "Tong Yao",
  "Zhang Yu",
  "An Xin",
  "Kong Shixing",
  "Xu Yuan",
  "Xiao Jie",
  "Cheng Wei",
  "Dean Shen",
  "Teacher Yang",
  "Wang Ping",

  "Decai Middle School",
  "Nightmare",
  "Nightmare Live Studio",
  "Dark Fire",
  "Oracle",
  "Integrity First",
  "Anchor Hall",
  "Fukang Hospital",
  "Fukang Private General Hospital",
  "Antai Community",
  "Fantasy Amusement Park",
  "Ping'an Asylum",
  "Lucky Cruise Ship",
  "Infinite Train",
];

const namePattern =
  /\b([A-Z][a-z]+(?:['-][A-Za-z]+)?(?:\s+[A-Z][a-z]+(?:['-][A-Za-z]+)?){1,4})\b/g;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function looksLikeBadName(candidate) {
  if (!candidate) return true;
  if (ignoredPhrases.has(candidate)) return true;

  const words = candidate.split(/\s+/);

  if (words.length > 4) return true;

  const badWords = [
    "Chapter",
    "Level",
    "Progress",
    "Value",
    "Points",
    "Completion",
    "Degree",
    "Product",
    "Name",
    "Before",
    "After",
    "While",
    "When",
    "With",
    "This",
    "That",
    "There",
  ];

  if (words.some((word) => badWords.includes(word))) return true;

  return false;
}

export function extractProperNames(text) {
  const counts = new Map();

  for (const fixed of alwaysProtect) {
    if (text.includes(fixed)) {
      counts.set(fixed, 9999);
    }
  }

  const matches = text.match(namePattern) ?? [];

  for (const rawName of matches) {
    const name = rawName.trim();

    if (looksLikeBadName(name)) continue;

    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2 || count === 9999)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

export function protectNames(text, names) {
  const map = new Map();
  let protectedText = text;

  const sortedNames = [...new Set(names)].sort((a, b) => b.length - a.length);

  sortedNames.forEach((name, index) => {
    const token = `[[NAME_${String(index + 1).padStart(3, "0")}]]`;
    map.set(token, name);

    const escaped = escapeRegExp(name);
    protectedText = protectedText.replace(
      new RegExp(`\\b${escaped}\\b`, "g"),
      token
    );
  });

  return { protectedText, map };
}

export function restoreNames(text, map) {
  let restored = text;

  for (const [token, name] of map.entries()) {
    restored = restored.replaceAll(token, name);
  }

  return restored;
}
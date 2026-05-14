const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;

export function extractProperNames(text) {
  const matches = text.match(namePattern) ?? [];

const ignored = new Set([
  "Chapter",
  "The End",
  "Thank You",
  "Oh God",
  "Product Name",
  "Highest Unlocking Progress",
  "Viewing Value",
  "Reward Points",
  "Completion Degree",
  "Instance Difficulty Level",
]);

  const counts = new Map();

  for (const name of matches) {
    if (ignored.has(name)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

export function protectNames(text, names) {
  const map = new Map();
  let protectedText = text;

  names.forEach((name, index) => {
    const token = `[[NAME_${String(index + 1).padStart(3, "0")}]]`;
    map.set(token, name);

    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    protectedText = protectedText.replace(new RegExp(`\\b${escaped}\\b`, "g"), token);
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
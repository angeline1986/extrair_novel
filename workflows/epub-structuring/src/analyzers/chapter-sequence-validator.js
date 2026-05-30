import { extractChapterNumber } from '../utils/text-utils.js';

export function validateChapterSequence(chapters) {
  const numbered = chapters.map((chapter) => ({
    title: chapter.title,
    href: chapter.href,
    number: extractChapterNumber(chapter.title)
  })).filter((item) => item.number !== null);

  const numbers = numbered.map((item) => item.number);

  return {
    detectedNumbers: numbers,
    missingChapters: findMissing(numbers),
    duplicateChapters: findDuplicates(numbers),
    outOfOrderChapters: findOutOfOrder(numbered)
  };
}

function findDuplicates(numbers) {
  const seen = new Set();
  const duplicate = new Set();

  for (const number of numbers) {
    if (seen.has(number)) duplicate.add(number);
    seen.add(number);
  }

  return [...duplicate];
}

function findMissing(numbers) {
  if (!numbers.length) return [];
  const unique = [...new Set(numbers)].sort((a, b) => a - b);
  const missing = [];

  for (let number = unique[0]; number <= unique[unique.length - 1]; number++) {
    if (!unique.includes(number)) missing.push(number);
  }

  return missing;
}

function findOutOfOrder(numbered) {
  const issues = [];

  for (let index = 1; index < numbered.length; index++) {
    if (numbered[index].number < numbered[index - 1].number) {
      issues.push({ previous: numbered[index - 1], current: numbered[index] });
    }
  }

  return issues;
}

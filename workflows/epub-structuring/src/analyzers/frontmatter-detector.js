import { cleanText, isFileNameTitle, isGenericTitle } from '../utils/text-utils.js';

export function detectFrontmatter(item, doc, title) {
  const source = `${item.href} ${title}`.toLowerCase();
  const text = cleanText(`${doc?.firstParagraph || ''} ${doc?.firstBold || ''}`);

  if (source.includes('titlepage') || source.includes('cover')) return true;
  if (source.includes('toc') || source.includes('sumário') || source.includes('indice')) return true;
  if (doc?.isEmpty) return true;
  if ((doc?.wordCount || 0) <= 10 && (isFileNameTitle(title) || isGenericTitle(title))) return true;
  if ((doc?.wordCount || 0) <= 10 && !text) return true;

  return false;
}

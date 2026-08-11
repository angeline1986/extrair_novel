import { cleanText } from './text-utils.js';

const CHAPTER_ONLY_PATTERN = /^cap[ií]tulo\s+\d{1,4}$/i;
const FOOTNOTE_PATTERN = /^\d{1,4}[\.\)]\s+/;
const MIN_TITLE_LENGTH = 3;

export function collectDomChapterCandidates($, root, { sourceHref, spineIndex }) {
  const candidates = [];
  let position = 0;

  $(root).find('h1, h2, h3, p, div, strong, b, span').each((_, el) => {
    const text = cleanText($(el).text());
    if (text && !isGenericText(text)) {
      candidates.push(baseCandidate($, el, {
        sourceHref,
        spineIndex,
        position: position++,
        text,
        combined: false
      }));
    }

    const composed = buildSiblingCandidate($, el, { sourceHref, spineIndex, position });
    if (composed) {
      candidates.push(composed);
      position++;
    }
  });

  return candidates;
}

export function buildSiblingCandidate($, headingElement, { sourceHref, spineIndex, position = 0 }) {
  const headingText = cleanText($(headingElement).text());
  if (!CHAPTER_ONLY_PATTERN.test(headingText)) return null;

  const titleElement = nextElementSibling($, headingElement);
  if (!titleElement) return null;

  const titleText = cleanText($(titleElement).text());
  if (!isValidSiblingTitle(titleText)) return null;

  const combinedText = `${headingText} ${titleText}`;
  return {
    ...baseCandidate($, headingElement, {
      sourceHref,
      spineIndex,
      position,
      text: combinedText,
      combined: true
    }),
    headingElement,
    titleElement,
    combinedText,
    headingText,
    titleText,
    titleDomPath: getDomPath($, titleElement)
  };
}

export function isChapterOnlyHeading(text) {
  return CHAPTER_ONLY_PATTERN.test(cleanText(text));
}

export function isValidSiblingTitle(text) {
  const value = cleanText(text);
  if (!value || value.length < MIN_TITLE_LENGTH) return false;
  if (CHAPTER_ONLY_PATTERN.test(value)) return false;
  if (/^(cap[ií]tulo|chapter|cap\.)\s+\d{1,4}\b/i.test(value)) return false;
  if (FOOTNOTE_PATTERN.test(value)) return false;
  if (looksLikeBibliographicReference(value)) return false;
  return true;
}

export function isBibliographicNumberedText(text) {
  const value = cleanText(text);
  return FOOTNOTE_PATTERN.test(value) && looksLikeBibliographicReference(value);
}

function baseCandidate($, el, { sourceHref, spineIndex, position, text, combined }) {
  return {
    el,
    text,
    combinedText: combined ? text : null,
    sourceHref,
    href: sourceHref,
    spineIndex,
    position,
    tagName: String(el.tagName || '').toLowerCase(),
    domPath: getDomPath($, el),
    combined
  };
}

function nextElementSibling($, el) {
  const next = $(el).next();
  return next.length ? next.get(0) : null;
}

function looksLikeBibliographicReference(text) {
  return /[『「“"].{2,}[』」”"].{0,80}(traduzid|traduzida|john|william|oscar|b[ií]blia|homer|shelley|keats|byron|wilde|tennyson)/i.test(text);
}

function isGenericText(text) {
  return /^\*+$/.test(text) ||
    /^bsj$/i.test(text) ||
    /^converted ebook$/i.test(text) ||
    text.length < 3 ||
    text.length > 180;
}

function getDomPath($, el) {
  const path = [];
  let current = el;

  while (current && current.type !== 'root') {
    let selector = current.tagName;
    if (current.attribs && current.attribs.id) {
      selector += `#${current.attribs.id}`;
    } else if (current.parent && current.parent.children) {
      const siblings = current.parent.children.filter((sibling) => sibling.tagName === current.tagName);
      if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    path.unshift(selector);
    current = current.parent;
  }

  return path.join(' > ');
}

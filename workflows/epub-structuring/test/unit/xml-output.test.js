import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNavXhtml } from '../../src/builders/nav-builder.js';
import { buildEpub3Opf } from '../../src/builders/opf-builder.js';

test('buildEpub3Opf emits a single XML declaration', () => {
  const opf = buildEpub3Opf(fakeEpub(), 'nav.xhtml', 'toc.ncx', {
    documents: [],
    supplementalItems: [],
    chapters: [{ role: 'chapter', chapterNumber: 1, href: 'chapter_001.xhtml' }]
  });

  assert.equal((opf.match(/<\?xml\b/g) || []).length, 1);
});

test('buildNavXhtml declares epub namespace when using epub:type', () => {
  const nav = buildNavXhtml({
    supplementalItems: [],
    chapters: [{ href: 'chapter_001.xhtml', title: '1. Capítulo' }]
  }, 'pt-BR');

  assert.match(nav, /epub:type="toc"/);
  assert.match(nav, /xmlns:epub="http:\/\/www\.idpf\.org\/2007\/ops"/);
});

function fakeEpub() {
  return {
    opf: {
      xml: `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:language>PT_br</dc:language>
  </metadata>
  <manifest><item id="old" href="old.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="old"/></spine>
</package>`,
      metadata: { language: 'PT_br' }
    }
  };
}

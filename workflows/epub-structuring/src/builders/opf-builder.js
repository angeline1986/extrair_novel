import { escapeXml } from '../utils/xml-utils.js';

export function buildEpub3Opf(epub, navHref, ncxHref) {
  const metadata = buildMetadata(epub.opf.metadata);
  const manifest = buildManifest(epub, navHref, ncxHref);
  const spine = buildSpine(epub);

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  ${metadata}
  ${manifest}
  ${spine}
</package>
`;
}

function buildMetadata(data) {
  const title = escapeXml(data.title || 'Livro');
  const creator = data.creator ? `<dc:creator>${escapeXml(data.creator)}</dc:creator>` : '';
  const lang = escapeXml(data.language || 'pt');
  const id = escapeXml(data.identifier || `urn:uuid:${fallbackId()}`);
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  return `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${id}</dc:identifier>
    <dc:title>${title}</dc:title>
    ${creator}
    <dc:language>${lang}</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>`;
}

function buildManifest(epub, navHref, ncxHref) {
  const byHref = new Map();

  for (const item of epub.manifestItems) {
    if (!item.href || item.properties.includes('nav')) continue;
    byHref.set(item.href, item);
  }

  byHref.set(navHref, { id: 'nav', href: navHref, mediaType: 'application/xhtml+xml', properties: 'nav' });

  if (!byHref.has(ncxHref)) {
    byHref.set(ncxHref, { id: 'ncx', href: ncxHref, mediaType: 'application/x-dtbncx+xml', properties: '' });
  }

  const items = [...byHref.values()].map((item) => {
    const prop = item.properties ? ` properties="${escapeXml(item.properties)}"` : '';
    return `    <item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"${prop}/>`;
  }).join('\n');

  return `<manifest>\n${items}\n  </manifest>`;
}

function buildSpine(epub) {
  const items = epub.spineItems.map((item) => {
    const linear = item.linear && item.linear !== 'yes' ? ` linear="${escapeXml(item.linear)}"` : '';
    return `    <itemref idref="${escapeXml(item.idref)}"${linear}/>`;
  }).join('\n');

  return `<spine>\n${items}\n  </spine>`;
}

function fallbackId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

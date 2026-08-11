import AdmZip from 'adm-zip';

export function validateEpub(outputFile, epubStructure) {
  const errors = [];
  const warnings = [];

  try {
    const zip = new AdmZip(outputFile);
    const entries = zip.getEntries().map((entry) => entry.entryName);

    const required = [
      'mimetype',
      'META-INF/container.xml',
      epubStructure.opfPath,
      epubStructure.navPath,
      epubStructure.ncxPath,
      epubStructure.cssPath,
      ...epubStructure.chapterFiles,
    ];

    for (const entry of required) {
      if (!entries.includes(entry)) {
        errors.push(`Arquivo ausente no EPUB: ${entry}`);
      }
    }

    const opfContent = entries.includes(epubStructure.opfPath)
      ? zip.readAsText(epubStructure.opfPath)
      : '';

    if (!opfContent.includes('<manifest>') || !opfContent.includes('<spine')) {
      errors.push('OPF inválido: manifest/spine ausente.');
    }

    const manifestEntries = [...opfContent.matchAll(/<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"/g)];
    const spineEntries = [...opfContent.matchAll(/<itemref[^>]+idref="([^"]+)"/g)];

    if (spineEntries.length === 0) {
      errors.push('Spine está vazio.');
    }

    for (const [, idref] of spineEntries) {
      if (!manifestEntries.some(([, itemId]) => itemId === idref)) {
        errors.push(`Spine referencia item inexistente: ${idref}`);
      }
    }

    const navContent = entries.includes(epubStructure.navPath)
      ? zip.readAsText(epubStructure.navPath)
      : '';

    if (!navContent.includes('epub:type="toc"')) {
      warnings.push('nav.xhtml não contém marcação EPUB TOC explícita.');
    }

    if (!opfContent.includes('properties="nav"')) {
      errors.push('Manifest não referencia nav.xhtml com propriedades="nav".');
    }

    if (!entries.includes(epubStructure.ncxPath)) {
      errors.push('toc.ncx ausente.');
    }

    if (entries.includes('mimetype') && zip.readAsText('mimetype').trim() !== 'application/epub+zip') {
      errors.push('mimetype inválido.');
    }

    if (warnings.length === 0 && errors.length === 0) {
      warnings.push('Estrutura EPUB validada com sucesso.');
    }
  } catch (error) {
    errors.push(error.message);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

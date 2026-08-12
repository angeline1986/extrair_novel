import AdmZip from 'adm-zip';

export function validateEpub(outputFile, epubStructure) {
  const errors = [];
  const warnings = [];

  try {
    const zip = new AdmZip(outputFile);
    const zipEntries = zip.getEntries();
    const entries = zipEntries.map((entry) => entry.entryName);

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

    validateMimetype(zipEntries, zip, errors);

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
      errors.push('nav.xhtml não contém marcação EPUB TOC explícita.');
    }

    if (!/xmlns:epub=["']http:\/\/www\.idpf\.org\/2007\/ops["']/.test(navContent)) {
      errors.push('nav.xhtml usa prefixo epub sem declarar xmlns:epub.');
    }

    if (!opfContent.includes('properties="nav"')) {
      errors.push('Manifest não referencia nav.xhtml com properties="nav".');
    }

    for (const chapterFile of epubStructure.chapterFiles) {
      if (!entries.includes(chapterFile)) continue;

      const content = zip.readAsText(chapterFile);

      if (!/<html\b/.test(content) || !/<body\b/.test(content)) {
        errors.push(`XHTML inválido ou incompleto: ${chapterFile}`);
      }
    }

    if (errors.length === 0) {
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

function validateMimetype(zipEntries, zip, errors) {
  const mimetypeIndex = zipEntries.findIndex((entry) => entry.entryName === 'mimetype');

  if (mimetypeIndex < 0) {
    errors.push('mimetype ausente.');
    return;
  }

  if (mimetypeIndex !== 0) {
    errors.push('mimetype deve ser a primeira entrada do arquivo EPUB.');
  }

  const mimetypeEntry = zipEntries[mimetypeIndex];

  if (mimetypeEntry?.header?.method !== 0) {
    errors.push('mimetype deve ser armazenado sem compressão.');
  }

  if (zip.readAsText('mimetype').trim() !== 'application/epub+zip') {
    errors.push('mimetype inválido.');
  }
}

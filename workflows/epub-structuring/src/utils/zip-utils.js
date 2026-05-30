export function readZipText(zip, entryName) {
  const entry = zip.getEntry(normalizeZipPath(entryName));

  if (!entry) {
    throw new Error(`Arquivo ausente dentro do EPUB: ${entryName}`);
  }

  return zip.readAsText(entry);
}

export function normalizeZipPath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/');
}

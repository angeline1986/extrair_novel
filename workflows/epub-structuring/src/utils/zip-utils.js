export function normalizeZipPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/\.\//g, '/');
}

export function readZipText(zip, entryPath) {
  const normalized = normalizeZipPath(entryPath);
  const entry = zip.getEntry(normalized);
  if (!entry) throw new Error(`Arquivo não encontrado no EPUB: ${normalized}`);
  return entry.getData().toString('utf8');
}

export function zipEntryExists(zip, entryPath) {
  return Boolean(zip.getEntry(normalizeZipPath(entryPath)));
}

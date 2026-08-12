export async function loadDocxReference(docxPath) {
  return {
    sourceType: 'docx',
    sourceFile: docxPath,
    language: null,
    title: null,
    chapters: [],
    adapterStatus: 'unsupported',
    error: 'DOCX_REFERENCE_ADAPTER_UNAVAILABLE: nenhuma dependência DOCX está instalada neste workflow.'
  };
}

export function chunkText(text, maxChars = 6000) {
  const paragraphs = text.split(/\n+/);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n" + paragraph).length > maxChars) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current += "\n" + paragraph;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks;
}
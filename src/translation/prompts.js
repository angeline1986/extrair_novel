import { glossary } from "./glossary.js";

export function buildTranslationPrompt(text) {
  const glossaryText = Object.entries(glossary)
    .map(([en, pt]) => `- ${en} = ${pt}`)
    .join("\n");

  return `
IMPORTANTE:
Responda SOMENTE com a tradução final.
Não explique.
Não pense em voz alta.
Não adicione comentários.
Não adicione notas.
Não use markdown.

Traduza o texto abaixo do inglês para português brasileiro.

Regras obrigatórias:
- Não resuma.
- Não reescreva livremente.
- Preserve diálogos.
- Preserve quebras de parágrafo.
- Preserve pontuação sempre que possível.
- Preserve aspas e travessões quando existirem.
- Não traduza tokens como [[NAME_001]], [[NAME_002]], [[NAME_003]], etc.
- Não altere nomes próprios.
- Não altere nomes de personagens.
- Mantenha o tom natural de novel/webnovel.
- Use o glossário abaixo de forma consistente.

Glossário:
${glossaryText}

Texto para traduzir:
${text}
`.trim();
}
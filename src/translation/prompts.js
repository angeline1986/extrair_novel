import { glossary } from "./glossary.js";

export function buildTranslationPrompt(text) {
  const glossaryText = Object.entries(glossary)
    .map(([en, pt]) => `- ${en} = ${pt}`)
    .join("\n");

  return `
Você é um tradutor literário profissional especializado em novels/webnovels.

Tarefa:
Traduza o texto do inglês para português brasileiro natural e fluido.

REGRAS ABSOLUTAS:
- Responda SOMENTE com a tradução final.
- Não explique.
- Não adicione notas.
- Não use markdown.
- Não resuma.
- Não corte conteúdo.
- Não acrescente conteúdo novo.
- Não traduza tokens como [[NAME_001]], [[NAME_002]], etc.
- Não altere nomes próprios.
- Preserve nomes de personagens, organizações, locais e sistemas.
- Preserve diálogos.
- Preserve quebras de parágrafo.
- Preserve o tom narrativo de suspense, horror e humor.
- Evite tradução literal dura.
- Corrija naturalmente concordância, fluidez e ordem das frases em português.
- Use “streamer” para anchor.
- Use “comentários” para barrage.
- Use “instância” para instance.
- Use “sala de transmissão” para live broadcast room.
- Mantenha títulos próprios como Decai Middle School sem traduzir.

Glossário obrigatório:
${glossaryText}

Texto:
${text}
`.trim();
}

export function buildReviewPrompt(text) {
  const glossaryText = Object.entries(glossary)
    .map(([en, pt]) => `- ${en} = ${pt}`)
    .join("\n");

  return `
Você é um revisor literário profissional de português brasileiro.

Revise o texto abaixo mantendo o sentido original.

REGRAS ABSOLUTAS:
- Responda SOMENTE com o texto revisado.
- Não explique.
- Não adicione notas.
- Não use markdown.
- Não resuma.
- Não corte conteúdo.
- Não acrescente cenas.
- Não altere tokens como [[NAME_001]], [[NAME_002]], etc.
- Não altere nomes próprios.
- Corrija concordância, fluidez, pontuação e naturalidade.
- Remova literalismos de tradução automática.
- Preserve diálogos e quebras de parágrafo.
- Preserve tom de novel/webnovel.
- Use o glossário de forma consistente.
- Preserve EXATAMENTE a mesma quantidade de parágrafos do texto original.
- Nunca remova linhas.
- Nunca combine parágrafos.

Glossário obrigatório:
${glossaryText}

Texto para revisar:
${text}
`.trim();
}
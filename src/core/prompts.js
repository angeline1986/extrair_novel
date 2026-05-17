import { glossary } from "./glossary.js";

function buildGlossaryText() {
  return Object.entries(glossary)
    .map(([en, pt]) => `- ${en} = ${pt}`)
    .join("\n");
}

const FIXED_TERMS = `
TERMOS FIXOS:
- anchor = streamer
- anchors = streamers
- rookie anchor = streamer novato
- new anchor = streamer novato
- novice anchor = streamer novato
- old anchor = streamer veterano
- senior anchor = streamer veterano
- live broadcast = transmissão ao vivo
- live broadcast room = sala de transmissão
- live room = sala de transmissão
- live broadcasting room = sala de transmissão
- live broadcasting backstage = bastidores da transmissão
- live broadcast square = praça de transmissões ao vivo
- broadcast interface = interface da transmissão
- barrage = comentários
- instance = instância
- instance difficulty level = nível de dificuldade da instância
- viewing value = valor de audiência
- online viewers = espectadores online
- online audience = espectadores online
- audience rewards = recompensas da audiência
- identity card = cartão de identidade
- product name = nome do item
- novice gift = presente de iniciante
- novice gift package = pacote de presente de iniciante
- apple seedling = muda de maçã
- countdown = contagem regressiva
- streamer soul quality = qualidade da alma do streamer
- task = tarefa
- main task = tarefa principal
- live broadcast task = tarefa da transmissão ao vivo
- hidden item = item oculto
- prop = item
- props = itens
- plot modification = modificação da trama
- plot deviation = desvio da trama
- collection degree = grau de coleta
- collection progress = progresso de coleta
- completion degree = grau de conclusão
- highest unlocking progress = maior progresso de desbloqueio
- system store = loja do sistema
- renaming card = cartão de renomeação
- survival time = tempo de sobrevivência
- reward points = pontos de recompensa
`;

const COMMON_FIXES = `
CORREÇÕES OBRIGATÓRIAS:
- "countless suns" deve virar "inúmeros sóis", nunca "inúmeros solos".
- "palm-sized" deve virar "do tamanho da palma da mão", nunca "palmilhado".
- "edge of the table" deve virar "borda da mesa", nunca "bordo da mesa".
- "brown" deve virar "marrom", nunca "marron".
- "psychological quality" deve virar "controle psicológico" ou "resistência psicológica", nunca "psicologia".
- "creepy" deve virar "assustador", "sinistro" ou "arrepiante", conforme o contexto.
- "spirit/soul quality" neste contexto deve virar "qualidade da alma", não "qualidade do espírito".
- "viewing value" deve virar "valor de audiência".
- "barrage" deve virar "comentários".
- "light screen of the size of a palm" deve virar "tela luminosa do tamanho da palma da mão".
- "live room 789326qwk" deve virar "sala de transmissão 789326qwk".
- "online viewers" deve virar "espectadores online".
- "survival time allocation completed" deve virar "alocação do tempo de sobrevivência concluída".
- "psychological quality is good" deve virar "tem bom controle psicológico".
- "what composer" deve virar "que compostura", nunca "que compositor".
- "corners of the eyes/mouth" deve virar "cantos dos olhos/da boca", nunca "esquinas".
- "needle-like pain" deve virar "dor fina como agulhadas".
- "half-melted" deve virar "meio derretido".
- "blood-red" deve virar "vermelho-sangue".
- Evite deixar palavras em inglês, exceto nomes próprios, títulos e termos definidos.
`;

const SYSTEM_BLOCK_RULES = `
BLOCOS DE SISTEMA E INTERFACE:
- Preserve colchetes como [04:25], [Status: Ao vivo], 【...】.
- Traduza o conteúdo dentro dos colchetes quando for frase comum.
- Não traduza códigos como 789326qwk.
- Em cartões de identidade, coloque campos em linhas separadas:
[Cartão de Identidade]
Nome: ...
Idade: ...
Profissão: ...
Relacionado à Trama: ...
- Se o original vier grudado, normalize a formatação sem remover informação.
`;

const PROTECTED_PROPER_TERMS = `
NOMES PRÓPRIOS E TÍTULOS PROTEGIDOS:
- Não traduza nem adapte os títulos dos arcos:
  Decai Middle School
  Fukang Hospital
  Fukang Private General Hospital
  Antai Community
  Fantasy Amusement Park
  Ping An Asylum
  Ping'an Asylum
  Changsheng Building
  Xingwang Hotel
  Yuying University
  Lucky Cruise Ship
  Infinite Train
- Não traduza organizações e nomes próprios:
  Nightmare Live Studio
  Nightmare
  Oracle
  Dark Fire
  Integrity First
  Anchor Hall
- Não traduza nomes de personagens.
- Não transforme nomes próprios em equivalentes portugueses.
`;

const MODEL_NOISE_RULES = `
RUÍDOS DO MODELO:
- Nunca inclua /think.
- Nunca inclua <think>, </think>, <thinking>, </thinking>, <reasoning> ou </reasoning>.
- Nunca inclua raciocínio interno.
- Nunca inclua comentários sobre a tarefa.
- Nunca inclua "Aqui está", "Claro", "Segue", "Texto revisado", "Texto final" ou similares.
`;

const STYLE_RULES = `
ESTILO LITERÁRIO:
- Priorize português brasileiro natural.
- Evite literalidade mecânica.
- Preserve tensão, humor, ironia e ritmo de webnovel.
- Traduza fala de chat/comentários com naturalidade, sem formalizar demais.
- Traduza interjeições como Hey/Lol/Lmao/WTF quando não forem nomes próprios.
- Evite palavras artificiais como "distresse", "párpados", "prisionões", "compositor" quando o sentido for "compostura".
- Use "pálpebras", "prisioneiros", "compostura", "angústia", "cantos dos olhos", "cantos da boca".
`;

export function buildTranslationPrompt(text) {
  return `
Você é um tradutor literário profissional especializado em novels/webnovels.

Tarefa:
Traduza o texto do inglês para português brasileiro natural, fluido e fiel.

REGRAS ABSOLUTAS:
- Responda SOMENTE com a tradução final.
- Não explique.
- Não adicione notas.
- Não use markdown.
- Não resuma.
- Não corte conteúdo.
- Não acrescente conteúdo novo.
- Não reordene cenas.
- Não simplifique a narrativa.
- Preserve diálogos.
- Preserve quebras de parágrafo.
- Preserve a quantidade de parágrafos sempre que possível.
- Não traduza tokens como §§NAME_0001§§, §§NAME_0002§§, etc.
- Não altere nomes próprios.
- Preserve nomes de personagens, organizações, locais e sistemas.
- Preserve o tom narrativo de suspense, horror, humor e webnovel.
- Evite tradução literal dura.
- Corrija naturalmente concordância, fluidez e ordem das frases em português.

${FIXED_TERMS}

${COMMON_FIXES}

${SYSTEM_BLOCK_RULES}

${PROTECTED_PROPER_TERMS}

${MODEL_NOISE_RULES}

${STYLE_RULES}

GLOSSÁRIO OBRIGATÓRIO:
${buildGlossaryText()}

TEXTO:
${text}
`.trim();
}

export function buildReviewPrompt(text) {
  return `
Você é um revisor literário profissional de português brasileiro.

Tarefa:
Revise o texto abaixo mantendo o sentido original e a estrutura.

REGRAS ABSOLUTAS:
- Responda SOMENTE com o texto revisado.
- Não explique.
- Não adicione notas.
- Não use markdown.
- Não resuma.
- Não corte conteúdo.
- Não acrescente cenas.
- Não reescreva a história.
- Não mude o significado.
- Não altere tokens como §§NAME_0001§§, §§NAME_0002§§, etc.
- Não altere nomes próprios.
- Preserve diálogos.
- Preserve quebras de parágrafo.
- Preserve a mesma quantidade de parágrafos sempre que possível.
- Nunca remova linhas.
- Nunca combine parágrafos sem necessidade.
- Corrija concordância, fluidez, pontuação e naturalidade.
- Remova literalismos de tradução automática.
- Preserve o tom de novel/webnovel.
- Use o glossário de forma consistente.

${FIXED_TERMS}

${COMMON_FIXES}

${SYSTEM_BLOCK_RULES}

${PROTECTED_PROPER_TERMS}

${MODEL_NOISE_RULES}

${STYLE_RULES}

GLOSSÁRIO OBRIGATÓRIO:
${buildGlossaryText()}

TEXTO PARA REVISAR:
${text}
`.trim();
}

export function buildFinalPolishPrompt(text) {
  return `
Você é um editor literário profissional especializado em português brasileiro.

Tarefa:
Faça o POLIMENTO FINAL do texto abaixo.

IMPORTANTE:
Esta etapa NÃO é uma reescrita criativa.
Esta etapa NÃO é um resumo.
Esta etapa NÃO deve mudar a estrutura.

REGRAS ABSOLUTAS:
- Responda SOMENTE com o texto final.
- Não explique.
- Não adicione notas.
- Não use markdown.
- Não resuma.
- Não corte conteúdo.
- Não omita frases.
- Não simplifique.
- Não reescreva cenas.
- Não reduza parágrafos.
- Não altere significado.
- Não remova diálogos.
- Não adicione comentários.
- Não altere nomes próprios.
- Não altere tokens §§NAME_0001§§, §§NAME_0002§§, etc.
- Preserve a mesma quantidade de parágrafos sempre que possível.
- Nunca remova linhas.
- Nunca combine parágrafos sem necessidade.

Seu trabalho é SOMENTE:
- melhorar fluidez
- corrigir português robótico
- corrigir concordância
- corrigir pontuação
- suavizar traduções literais
- corrigir inglês residual
- corrigir termos inconsistentes
- normalizar blocos de interface/cartão

Mantenha:
- tom de webnovel
- suspense
- humor
- ritmo narrativo
- formatação
- parágrafos
- diálogos
- glossário

${FIXED_TERMS}

${COMMON_FIXES}

${SYSTEM_BLOCK_RULES}

${PROTECTED_PROPER_TERMS}

${MODEL_NOISE_RULES}

${STYLE_RULES}

GLOSSÁRIO OBRIGATÓRIO:
${buildGlossaryText()}

TEXTO:
${text}
`.trim();
}
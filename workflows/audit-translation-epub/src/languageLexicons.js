function wordsFromList(value) {
  return String(value || '')
    .split(/\s+/)
    .map(normalizeLexiconWord)
    .filter(Boolean);
}

export function normalizeLexiconWord(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function normalizeComparableText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeLexiconText(value) {
  return String(value || '')
    .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)
    ?.map(normalizeLexiconWord)
    .filter(Boolean) || [];
}

export const PORTUGUESE_COMMON_WORDS = new Set(wordsFromList(`
a ao aos as o os um uma uns umas de da das do dos em na nas no nos por para com sem sob sobre entre
e ou mas que se como quando enquanto porque pois entao então tambem também nao não sim ja já ate até apos após antes depois
ele ela eles elas eu tu voce você voces vocês meu minha meus minhas seu sua seus suas dele dela deles delas
este esta estes estas esse essa esses essas aquele aquela aqueles aquelas isto isso aquilo todo toda todos todas cada
muito muita muitos muitas pouco pouca poucos poucas mais menos maior menor melhor pior mesmo mesma mesmos mesmas outro outra outros outras
era eram foi foram ser estar esta está estão estava estavam estou estamos teria teriam tinha tinham tenho tem têm tendo tenha
ha há havia fazer faz fez fazem feito ir vai vou vamos vem veio vir ver viu saber sabe sabia poder pode podia
dizer disse dizem falar falou olhar olhou sentir sentiu querer queria deixar deixou ficar ficou dar deu tomar tomou
amor hora vez empresa forma nada algo alguem alguém coisa coisas pessoa pessoas gerente finalmente geralmente raramente certamente
pelo pela pelos pelas pele onde aqui ali agora hoje ontem amanha amanhã sempre nunca apenas quase talvez
trabalho tempo dia noite manha manhã tarde ano anos casa escritorio escritório sala porta mesa rosto olhos mao mão maos mãos
cabeca cabeça corpo voz sorriso silencio silêncio problema lugar momento maneira lado frente atras atrás dentro fora vida nome
nariz unico único seria perder eficiente ineficiente dificil difícil facil fácil estranho estranha grande pequeno pequena novo nova
claro clara escuro escura branco branca preto preta vermelho vermelha azul certo certa errado errada
gravidez reuniao reunião mal-entendido reconhecimento promessa viagem negocios negócios verdade contrato contratos rumores tratamento noticias notícias
perturbacao perturbação ciume ciúme mudanca mudança introducao introdução vazamento agua água rachadura consequencia consequência conclusao conclusão
historia história amor casamento materiais enjoo matinal cantigas ninar capitulo capítulo titulo título
nausea náusea nauseas náuseas fuga
`));

export const SPANISH_COMMON_WORDS = new Set(wordsFromList(`
a al algo algun algún alguna algunas alguno algunos ante antes aqui aquí bajo bien cada casi como cómo con contra cual cuál
cuando cuándo de del desde donde dónde dos durante e el ella ellas ellos en entre era eran es esa esas ese esos esta está
estaba estaban estar estas este esto estos fue fueron ha habia había hacia hasta hay la las le les lo los mas más me mi
mis mucho mucha muchos muchas muy nada ni no nos nosotros o otra otras otro otros para pero poco poca pocos pocas por porque
qué que quien quién se ser si sí siempre sin sobre solo sólo son su sus tambien también tan te tener tenia tenía ti todo toda
todos todas tras tu tus un una unas uno unos usted ustedes y ya
amor hora vez empresa forma nariz unico único seria sería perder eficiente ineficiente dificil difícil facil fácil
embarazo reunion reunión malentendido nauseas náuseas matutinas viaje negocios verdad contrato rumores tratamiento noticias
perturbacion perturbación rimas infantiles celos cambiar introduccion introducción fuga agua viento grieta conclusion conclusión
promesa matrimonio reconocimiento
`));

export const ENGLISH_COMMON_WORDS = new Set(wordsFromList(`
a an and are as at be been before being but by can could did do does doing down during each few for from had has have
he her here hers herself him himself his how i if in into is it its itself just may me might more most must my myself
no nor not of off on once only or other our ours ourselves out over own same she should so some such than that the their
theirs them themselves then there these they this those through to too under until up very was we were what when where
which while who whom why will with would you your yours yourself yourselves
after again against all although always any anyone anything because between both cannot every everyone everything
however never nothing now often perhaps still therefore though together toward towards
`));

export const PORTUGUESE_STRONG_MARKERS = new Set(wordsFromList(`
nao não voce você voces vocês tambem também então estão havia depois antes através coracao coração reuniao reunião
gravidez mal-entendido notícias introdução conclusão promessa casamento
`));

export const SPANISH_STRONG_MARKERS = new Set(wordsFromList(`
el los las una uno unos unas del que para pero muy aunque donde cuando siempre hacia hasta todavía todavia
reunion reunión embarazo malentendido nauseas náuseas matutinas rimas infantiles celos cambiar introduccion introducción
grieta conclusion conclusión matrimonio usted ustedes año años
`));

export const ENGLISH_STRONG_MARKERS = new Set(wordsFromList(`
the and with that this would could should have been from they their there while after before because although however
toward towards herself himself themselves cannot
`));

export const LANGUAGE_LEXICONS = {
  pt: {
    commonWords: PORTUGUESE_COMMON_WORDS,
    strongMarkers: PORTUGUESE_STRONG_MARKERS,
  },
  es: {
    commonWords: SPANISH_COMMON_WORDS,
    strongMarkers: SPANISH_STRONG_MARKERS,
  },
  en: {
    commonWords: ENGLISH_COMMON_WORDS,
    strongMarkers: ENGLISH_STRONG_MARKERS,
  },
};

export function getLanguageLexicon(language) {
  return LANGUAGE_LEXICONS[language] || null;
}

export function isCommonWord(word, language) {
  const lexicon = getLanguageLexicon(language);
  if (!lexicon) return false;
  return lexicon.commonWords.has(normalizeLexiconWord(word));
}

export function isStrongLanguageMarker(word, language) {
  const lexicon = getLanguageLexicon(language);
  if (!lexicon) return false;
  return lexicon.strongMarkers.has(normalizeLexiconWord(word));
}

export function languageMarkerScore(text, language) {
  const words = tokenizeLexiconText(text);
  if (!words.length) {
    return {
      language,
      totalWords: 0,
      commonHits: 0,
      strongHits: 0,
      score: 0,
    };
  }

  const commonHits = words.filter((word) => isCommonWord(word, language)).length;
  const strongHits = words.filter((word) => isStrongLanguageMarker(word, language)).length;
  const score = Number(((commonHits + strongHits * 2) / words.length).toFixed(4));

  return {
    language,
    totalWords: words.length,
    commonHits,
    strongHits,
    score,
  };
}

export function dominantLanguageScore(text, languages = ['pt', 'es', 'en']) {
  const scores = languages
    .map((language) => languageMarkerScore(text, language))
    .sort((a, b) => b.score - a.score || b.strongHits - a.strongHits);

  return {
    dominant: scores[0]?.language || null,
    scores,
  };
}

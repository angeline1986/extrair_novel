// src/fix-gender/corrections.js
// Regras de correção

export const corrections = [
  {
    pattern: /\bo\s+(diferente|mesma|melhor|pior|primeira|última|próxima)\b/gi,
    replace: (match, word) => `a ${word}`,
    description: 'advérbio feminino com artigo masculino'
  },
  {
    pattern: /\ba\s+(computador|sistema|problema|programa|documento|texto|capítulo|parágrafo|processo|método|resultado|dado|arquivo|código|teste|exemplo|caso|tempo|espaço|valor|número|nome|lugar|mundo|ano|dia|mês|trabalho|livro|artigo|site|link|botão|menu|backup|servidor|cliente|usuário)\b/gi,
    replace: (match, word) => `o ${word}`,
    description: 'substantivo masculino com artigo feminino'
  },
  {
    pattern: /\bo\s+(grande|pequena|alta|baixa|nova|antiga|bonita|feia|rápida|lenta|fácil|difícil|clara|escura|quente|fria|seca|molhada|limpa|suja)\b/gi,
    replace: (match, word) => `a ${word}`,
    description: 'adjetivo feminino com artigo masculino'
  },
  {
    pattern: /\bo\s+(casa|mesa|cadeira|porta|janela|parede|cozinha|sala|rua|estrada|ponte|floresta|praia|montanha|ilha|cidade|vila|aldeia|escola|faculdade|universidade|empresa|loja|farmácia|padaria|igreja|biblioteca|praça)\b/gi,
    replace: (match, word) => `a ${word}`,
    description: 'substantivo feminino com artigo masculino'
  },
  {
    pattern: /\bo\s+mesma\b/gi,
    replace: () => 'a mesma',
    description: '"o mesma" → "a mesma"'
  },
  {
    pattern: /\ba\s+mesmo\b/gi,
    replace: () => 'o mesmo',
    description: '"a mesmo" → "o mesmo"'
  },
  {
    pattern: /\bum\s+(casa|mesa|cadeira|porta|janela|parede|cozinha|sala|rua|estrada|ponte|floresta|praia|montanha|ilha|cidade|vila|aldeia|escola|faculdade|universidade|empresa|loja|farmácia|padaria|igreja|biblioteca|praça)\b/gi,
    replace: (match, word) => `uma ${word}`,
    description: 'substantivo feminino com artigo indefinido masculino'
  },
  {
    pattern: /\buma\s+(computador|sistema|problema|programa|documento|texto|capítulo|parágrafo|processo|método|resultado|dado|arquivo|código|teste|exemplo|caso|tempo|espaço|valor|número|nome|lugar|mundo|ano|dia|mês|trabalho|livro|artigo|site|link|botão|menu)\b/gi,
    replace: (match, word) => `um ${word}`,
    description: 'substantivo masculino com artigo indefinido feminino'
  }
];

export const additionalFixes = [
  {
    pattern: /Seu corpo precisa ser congelado\./giu,
    replace: 'Você deve estar congelando.',
    description: 'corrige tradução literal: corpo precisa ser congelado'
  },
  {
    pattern: /Depois de sair do metrô, o Duque reassumiu a liderança\./giu,
    replace: 'Depois de sair do subterrâneo, o Duque reassumiu a liderança.',
    description: 'corrige incoerência de ambientação: metrô'
  },
  {
    pattern: /Parece uma piada típica do Sul dos Estados Unidos\./giu,
    replace: 'Parece uma piada típica do Sul.',
    description: 'adapta expressão cultural ao worldbuilding'
  },
  {
    pattern: /\s*OceanofPDF\.com\s*/giu,
    replace: ' ',
    description: 'remove artefato OceanofPDF.com'
  },
  { 
    pattern: /[ ]{3,}/g,
    replace: '  ',
    description: 'múltiplos espaços (mais de 2)'
  },
  { 
    pattern: /\n{4,}/g,
    replace: '\n\n\n',
    description: 'quebra de linha excessiva (mais de 3)'
  }
];

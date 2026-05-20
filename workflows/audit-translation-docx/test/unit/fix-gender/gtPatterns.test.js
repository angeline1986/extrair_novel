import { detectGoogleTranslateIssues } from '../../../src/checks/gtPatterns.js';

describe('detectGoogleTranslateIssues', () => {
  test('ignores gender false positives embedded inside words', () => {
    const text = [
      'Era uma dor que podia enlouquecer as pessoas.',
      'Por favor, venha por aqui.',
      'O lugar para onde ele foi levado imediatamente foi um banheiro.',
      'Diante da visão inesperadamente aterradora, ele parou.',
      'Não durma muito profundamente.',
      'Era uma dor que podia enlouquecer as pessoas.',
      'Por favor, venha por aqui.',
      'O lugar para onde ele foi levado imediatamente foi um banheiro.',
    ].join(' ');

    const result = detectGoogleTranslateIssues(text);

    expect(result.issues.filter((issue) => issue.type === 'gender_issue')).toEqual([]);
  });

  test('reports isolated article gender patterns', () => {
    const text = [
      'Ela ficou o rapidamente possível.',
      'Ela saiu o lentamente possível.',
      'Ela respondeu o silenciosamente possível.',
      'Ela voltou o cuidadosamente possível.',
      'Ela caminhou o calmamente possível.',
      'A computador estava na mesa.',
      'A sistema falhou novamente.',
      'A programa abriu sozinho.',
      'A documento sumiu.',
      'A arquivo corrompeu.',
    ].join(' ');

    const result = detectGoogleTranslateIssues(text);
    const genderDescriptions = result.issues
      .filter((issue) => issue.type === 'gender_issue')
      .map((issue) => issue.description);

    expect(genderDescriptions).toContain('advérbio feminino com artigo masculino');
    expect(genderDescriptions).toContain('substantivo masculino com artigo feminino');
  });

  test('reports removable source artifacts', () => {
    const result = detectGoogleTranslateIssues(
      'Rensley fechou os olhos. OceanofPDF.com Capítulo 1.2 - Terra Fria.'
    );

    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'source_artifact',
        description: 'artefato de site externo no texto',
        occurrences: 1,
      }),
    ]));
  });

  test('reports known semantic mistranslations', () => {
    const result = detectGoogleTranslateIssues([
      'Seu corpo precisa ser congelado.',
      'Depois de sair do metrô, o Duque reassumiu a liderança.',
      'Parece uma piada típica do Sul dos Estados Unidos.',
    ].join(' '));

    const semanticDescriptions = result.warnings
      .filter((warning) => warning.type === 'semantic_issue')
      .map((warning) => warning.description);

    expect(semanticDescriptions).toEqual(expect.arrayContaining([
      'tradução literal estranha: corpo precisa ser congelado',
      'incoerência de ambientação: metrô em fantasia medieval',
      'expressão cultural inadequada ao worldbuilding',
    ]));
  });
});

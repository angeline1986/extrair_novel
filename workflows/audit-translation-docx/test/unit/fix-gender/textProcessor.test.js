import { applyCorrections } from '../../../src/fix-gender/textProcessor.js';

describe('applyCorrections', () => {
  test('removes OceanofPDF.com artifacts', () => {
    const result = applyCorrections(
      'Rensley fechou os olhos. OceanofPDF.com Capítulo 1.2 - Terra Fria.'
    );

    expect(result.corrected).toBe('Rensley fechou os olhos. Capítulo 1.2 - Terra Fria.');
    expect(result.totalChanges).toBeGreaterThanOrEqual(1);
  });

  test('fixes known semantic mistranslations', () => {
    const result = applyCorrections([
      'Seu corpo precisa ser congelado.',
      'Depois de sair do metrô, o Duque reassumiu a liderança.',
      'Parece uma piada típica do Sul dos Estados Unidos.',
    ].join(' '));

    expect(result.corrected).toBe([
      'Você deve estar congelando.',
      'Depois de sair do subterrâneo, o Duque reassumiu a liderança.',
      'Parece uma piada típica do Sul.',
    ].join(' '));
    expect(result.totalChanges).toBeGreaterThanOrEqual(3);
  });
});

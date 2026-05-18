import { auditEntities } from '../../../src/entities/entityAudit.js';
import { normalizeEntities } from '../../../src/entities/entityNormalizer.js';

const glossary = {
  'Go Yo-han': {
    type: 'character',
    protected: true,
    aliases: ['Serenity', 'Silence', 'Gohan', 'Go-jeong', 'Ko-eum'],
  },
};

describe('entity normalization', () => {
  test('detects protected aliases as entity issues', () => {
    const result = auditEntities(
      'Serenity olhou para Gohan enquanto Silence ria.',
      glossary
    );

    expect(result.status).toBe('WARN');
    expect(result.summary.aliasesFound).toBe(3);
    expect(result.summary.totalAliasOccurrences).toBe(3);
    expect(result.entityIssues.map((issue) => issue.found).sort()).toEqual([
      'Gohan',
      'Serenity',
      'Silence',
    ]);
  });

  test('replaces aliases with canonical entity before downstream correction', () => {
    const result = normalizeEntities(
      'Serenity olhou para Gohan enquanto Silence ria.',
      glossary,
      { dryRun: false }
    );

    expect(result.text).toBe(
      'Go Yo-han olhou para Go Yo-han enquanto Go Yo-han ria.'
    );
    expect(result.summary.totalAliasOccurrences).toBe(3);
    expect(result.changes.map((change) => ({
      canonical: change.canonical,
      alias: change.alias,
      occurrences: change.occurrences,
    }))).toEqual([
      { canonical: 'Go Yo-han', alias: 'Serenity', occurrences: 1 },
      { canonical: 'Go Yo-han', alias: 'Silence', occurrences: 1 },
      { canonical: 'Go Yo-han', alias: 'Gohan', occurrences: 1 },
    ]);
  });

  test('dry run reports changes without mutating text', () => {
    const text = 'Ko-eum encontrou Go-jeong.';
    const result = normalizeEntities(text, glossary, { dryRun: true });

    expect(result.text).toBe(text);
    expect(result.changed).toBe(false);
    expect(result.summary.totalAliasOccurrences).toBe(2);
  });
});

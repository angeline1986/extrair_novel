import test from 'node:test';
import assert from 'node:assert/strict';
import { findKnownCanonicalBook } from '../../src/config/canonical-chapters.js';

test('findKnownCanonicalBook does not apply a known map from PDF identity alone', () => {
  const book = findKnownCanonicalBook({
    epub: { sourcePath: '/books/The_Editor.epub', opf: { metadata: { title: 'The Editor Is the Novel Extra' } } },
    pdfPath: '/books/ilide.info-bebe-accidental.pdf',
    pdfText: 'Bebé accidental'
  });

  assert.equal(book, null);
});

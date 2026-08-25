import { describe, expect, it } from 'vitest';
import { chunkMarkdown } from '../../src/ai/rag/chunker';

describe('chunkMarkdown', () => {
  it('extracts the H1 title and merges short paragraphs under the size limit', () => {
    const markdown = '# My Title\n\nFirst paragraph.\n\nSecond paragraph.';
    const chunks = chunkMarkdown('doc.md', markdown);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      source: 'doc.md',
      title: 'My Title',
      chunkIndex: 0,
      content: 'First paragraph.\n\nSecond paragraph.',
    });
  });

  it('starts a new chunk once the running chunk would exceed the size limit', () => {
    const longParagraph = 'x'.repeat(500);
    const markdown = `# Title\n\n${longParagraph}\n\n${longParagraph}\n\n${longParagraph}`;
    const chunks = chunkMarkdown('doc.md', markdown);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.content.length <= 1100)).toBe(true);
    expect(chunks.map(c => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it('falls back to the source filename as title when there is no H1 heading', () => {
    const chunks = chunkMarkdown('untitled.md', 'Just a paragraph with no heading.');
    expect(chunks[0]?.title).toBe('untitled.md');
  });

  it('drops empty paragraphs caused by extra blank lines', () => {
    const markdown = '# Title\n\nParagraph one.\n\n\n\nParagraph two.';
    const chunks = chunkMarkdown('doc.md', markdown);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe('Paragraph one.\n\nParagraph two.');
  });
});

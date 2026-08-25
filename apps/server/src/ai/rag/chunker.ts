export interface KnowledgeChunkInput {
  source: string;
  title: string;
  chunkIndex: number;
  content: string;
}

// ponytail: paragraph-merge chunking with a flat size cap — a single paragraph longer than
// MAX_CHUNK_CHARS becomes its own oversized chunk rather than being split mid-sentence. Fine
// for the short curated docs this ingests; revisit with sentence-aware splitting if a much
// longer source document is ever added.
const MAX_CHUNK_CHARS = 800;

export function chunkMarkdown(source: string, markdown: string): KnowledgeChunkInput[] {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? source;
  const body = markdown.replace(/^#\s+.+$/m, '').trim();

  const paragraphs = body
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0);

  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > MAX_CHUNK_CHARS && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) {
    chunks.push(current);
  }

  return chunks.map((content, chunkIndex) => ({ source, title, chunkIndex, content }));
}

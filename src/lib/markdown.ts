// HTML to Markdown conversion using Turndown
import TurndownService from 'turndown';
// @ts-expect-error - turndown-plugin-gfm has no type definitions
import { gfm } from 'turndown-plugin-gfm';
import type { ClippedContent, ExtractedArticle, Template } from './types';

function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  });

  // Use GitHub Flavored Markdown plugin
  turndown.use(gfm);

  // Custom rule for images - preserve alt text
  turndown.addRule('images', {
    filter: 'img',
    replacement: (_content, node) => {
      const img = node as HTMLImageElement;
      const alt = img.alt || '';
      const src = img.src || '';
      const title = img.title ? ` "${img.title}"` : '';
      return src ? `![${alt}](${src}${title})` : '';
    },
  });

  return turndown;
}

function generateFrontmatter(
  article: ExtractedArticle,
  summary: string | null,
  tags: string[],
  template: Template
): string {
  const lines: string[] = ['---'];

  // Add template frontmatter fields
  for (const field of template.frontmatterFields) {
    if (field.type === 'static') {
      lines.push(`${field.key}: ${field.value}`);
    } else {
      // Dynamic fields - replace placeholders
      let value = field.value;
      value = value.replace('{{title}}', article.metadata.title);
      value = value.replace('{{url}}', article.metadata.url);
      value = value.replace('{{author}}', article.metadata.author || 'Unknown');
      value = value.replace('{{date}}', new Date().toISOString().split('T')[0]);
      value = value.replace('{{published}}', article.metadata.publishedDate || '');
      value = value.replace('{{site}}', article.metadata.siteName || '');
      lines.push(`${field.key}: ${value}`);
    }
  }

  // Standard fields
  lines.push(`title: "${article.metadata.title.replace(/"/g, '\\"')}"`);
  lines.push(`source: "${article.metadata.url}"`);
  lines.push(`clipped: ${new Date().toISOString()}`);

  if (article.metadata.author) {
    lines.push(`author: "${article.metadata.author}"`);
  }

  if (article.metadata.publishedDate) {
    lines.push(`published: ${article.metadata.publishedDate}`);
  }

  if (tags.length > 0) {
    lines.push(`tags: [${tags.map((t) => `"${t}"`).join(', ')}]`);
  }

  lines.push(`reading_time: ${article.metadata.readingTime} min`);
  lines.push('---');

  return lines.join('\n');
}

export function convertToMarkdown(
  article: ExtractedArticle,
  summary: string | null,
  keyTakeaways: string[],
  tags: string[],
  template: Template
): ClippedContent {
  const turndown = createTurndownService();
  const contentMarkdown = turndown.turndown(article.content);

  const parts: string[] = [];

  // Frontmatter
  parts.push(generateFrontmatter(article, summary, tags, template));
  parts.push('');

  // Title
  parts.push(`# ${article.metadata.title}`);
  parts.push('');

  // Summary section
  if (summary) {
    parts.push('## Summary');
    parts.push('');
    parts.push(`> ${summary}`);
    parts.push('');
  }

  // Key takeaways
  if (keyTakeaways.length > 0) {
    parts.push('## Key Takeaways');
    parts.push('');
    for (const takeaway of keyTakeaways) {
      parts.push(`- ${takeaway}`);
    }
    parts.push('');
  }

  // Main content
  parts.push('## Content');
  parts.push('');
  parts.push(contentMarkdown);

  return {
    metadata: article.metadata,
    markdown: parts.join('\n'),
    summary,
    tags,
    keyTakeaways,
    createdAt: new Date().toISOString(),
  };
}

export function convertSelectionToMarkdown(
  selectedText: string,
  url: string,
  pageTitle: string
): string {
  const date = new Date().toISOString().split('T')[0];

  return `---
title: "Selection from ${pageTitle.replace(/"/g, '\\"')}"
source: "${url}"
clipped: ${new Date().toISOString()}
type: selection
---

# Selection from ${pageTitle}

> ${selectedText}

---
*Clipped from [${pageTitle}](${url}) on ${date}*
`;
}

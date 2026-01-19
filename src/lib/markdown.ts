// HTML to Markdown conversion using Turndown
import TurndownService from 'turndown';
// @ts-expect-error - turndown-plugin-gfm has no type definitions
import { gfm } from 'turndown-plugin-gfm';
import type {
  ClippedContent,
  ExtractedArticle,
  Template,
  ProductInfo,
  ReviewSynthesis,
} from './types';

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

/**
 * Generate markdown for a review synthesis
 */
export function generateReviewMarkdown(
  product: ProductInfo,
  synthesis: ReviewSynthesis,
): string {
  const date = new Date().toISOString().split('T')[0];
  const parts: string[] = [];

  // Frontmatter
  parts.push('---');
  parts.push(`title: "Review Synthesis: ${product.title.replace(/"/g, '\\"')}"`);
  parts.push(`source: "${product.url}"`);
  if (product.asin) parts.push(`asin: "${product.asin}"`);
  if (product.price) parts.push(`price: "${product.price}"`);
  if (product.rating) parts.push(`rating: ${product.rating}`);
  parts.push(`sentiment_score: ${synthesis.sentimentScore}`);
  parts.push(`reviews_analyzed: ${synthesis.reviewsAnalyzed}`);
  parts.push(`clipped: ${new Date().toISOString()}`);
  parts.push(`type: review-synthesis`);
  parts.push('tags: [product-review, purchase-decision]');
  parts.push('---');
  parts.push('');

  // Title
  parts.push(`# ${product.title}`);
  parts.push('');

  // Product info
  if (product.price || product.rating) {
    const infoParts: string[] = [];
    if (product.price) infoParts.push(`**Price:** ${product.price}`);
    if (product.rating) infoParts.push(`**Rating:** ${product.rating}/5`);
    parts.push(infoParts.join(' | '));
    parts.push('');
  }

  // Verdict
  parts.push('## The Verdict');
  parts.push('');
  parts.push(`> ${synthesis.verdict}`);
  parts.push('');
  parts.push(`**Sentiment Score:** ${synthesis.sentimentScore}% (based on ${synthesis.reviewsAnalyzed} reviews)`);
  parts.push('');

  // Pros
  if (synthesis.pros.length > 0) {
    parts.push('## ✅ Pros');
    parts.push('');
    for (const pro of synthesis.pros) {
      parts.push(`- ${pro.point}`);
    }
    parts.push('');
  }

  // Cons
  if (synthesis.cons.length > 0) {
    parts.push('## ❌ Cons');
    parts.push('');
    for (const con of synthesis.cons) {
      parts.push(`- ${con.point}`);
    }
    parts.push('');
  }

  // Quality Alerts
  if (synthesis.qualityAlerts.length > 0) {
    parts.push('## ⚠️ Quality Alerts');
    parts.push('');
    for (const alert of synthesis.qualityAlerts) {
      const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
      parts.push(`- ${icon} ${alert.issue}`);
    }
    parts.push('');
  }

  // Footer
  parts.push('---');
  parts.push(`*Synthesized from [Amazon](${product.url}) on ${date}*`);

  return parts.join('\n');
}

/**
 * Generate a sanitized filename for review synthesis
 */
export function generateReviewFilename(productTitle: string): string {
  const date = new Date().toISOString().split('T')[0];
  const sanitized = productTitle
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
  return `${date}-review-${sanitized}`;
}

// Article extraction using Readability
import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';
import type { ExtractedArticle, ArticleMetadata } from './types';

function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

function extractMetadata(doc: Document, url: string): ArticleMetadata {
  const getMetaContent = (selectors: string[]): string | null => {
    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el) {
        return el.getAttribute('content') || el.textContent || null;
      }
    }
    return null;
  };

  const title =
    getMetaContent(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
    doc.title ||
    'Untitled';

  const author = getMetaContent([
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[name="twitter:creator"]',
  ]);

  const publishedDate = getMetaContent([
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[name="pubdate"]',
  ]);

  const siteName =
    getMetaContent(['meta[property="og:site_name"]']) ||
    new URL(url).hostname.replace('www.', '');

  const excerpt = getMetaContent([
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]);

  return {
    title,
    author,
    publishedDate,
    siteName,
    url,
    readingTime: 0, // Will be calculated after content extraction
    excerpt,
  };
}

export function extractArticle(doc: Document, url: string): ExtractedArticle | null {
  const metadata = extractMetadata(doc, url);

  // Clone the document for Readability (it modifies the DOM)
  const documentClone = doc.cloneNode(true) as Document;

  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (!article) {
    return null;
  }

  let content = article.content || '';

  // Readability's heuristics can strip the article's hero/lead image when it
  // lives in a separate DOM section from the body text (common on Medium, Substack, etc.).
  // Recover it from og:image metadata if the extracted content doesn't already lead with one.
  const ogImage =
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
  if (ogImage) {
    // Content is wrapped in <div id="readability-page-1" class="page">…</div>
    const inner = content.replace(/^<div[^>]*>\s*/i, '').trimStart();
    if (!/^<(figure|img|picture)/i.test(inner)) {
      const src = ogImage.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      content = content.replace(
        /^(<div[^>]*>)/i,
        `$1<figure><img src="${src}" alt="" /></figure>\n`,
      );
    }
  }

  // Sanitize HTML content
  const sanitizedContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'a', 'img', 'strong', 'em', 'b', 'i', 'u',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'figure', 'figcaption', 'hr',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
  });

  metadata.readingTime = calculateReadingTime(article.textContent || '');
  metadata.title = article.title || metadata.title;

  return {
    metadata,
    content: sanitizedContent,
    textContent: article.textContent || '',
  };
}

export function extractSelection(): string | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return null;
  }
  return selection.toString();
}

// Default templates for different content types
import type { Template } from './types';

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'article',
    name: 'Article',
    description: 'Default template for web articles and blog posts',
    frontmatterFields: [
      { key: 'type', value: 'article', type: 'static' },
    ],
    aiPrompt: 'Summarize this article and extract key takeaways.',
    urlPatterns: [],
  },
  {
    id: 'recipe',
    name: 'Recipe',
    description: 'Template for cooking recipes',
    frontmatterFields: [
      { key: 'type', value: 'recipe', type: 'static' },
      { key: 'category', value: 'cooking', type: 'static' },
    ],
    aiPrompt: 'Extract the recipe ingredients, cooking time, and steps.',
    urlPatterns: ['recipe', 'cooking', 'food'],
  },
  {
    id: 'research',
    name: 'Research Paper',
    description: 'Template for academic papers and research',
    frontmatterFields: [
      { key: 'type', value: 'research', type: 'static' },
      { key: 'status', value: 'to-read', type: 'static' },
    ],
    aiPrompt: 'Summarize the abstract, methodology, and key findings.',
    urlPatterns: ['arxiv', 'scholar', 'research', 'paper', 'doi.org'],
  },
  {
    id: 'video',
    name: 'Video Transcript',
    description: 'Template for YouTube videos and transcripts',
    frontmatterFields: [
      { key: 'type', value: 'video', type: 'static' },
      { key: 'platform', value: '{{site}}', type: 'dynamic' },
    ],
    aiPrompt: 'Summarize the main points discussed in this video.',
    urlPatterns: ['youtube.com', 'vimeo.com', 'youtu.be'],
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Template for technical documentation',
    frontmatterFields: [
      { key: 'type', value: 'documentation', type: 'static' },
      { key: 'category', value: 'tech', type: 'static' },
    ],
    aiPrompt: 'Extract the key concepts and code examples.',
    urlPatterns: ['docs', 'documentation', 'readme', 'wiki'],
  },
  {
    id: 'thread',
    name: 'Thread',
    description: 'Template for Twitter/X threads and Reddit posts',
    frontmatterFields: [
      { key: 'type', value: 'thread', type: 'static' },
      { key: 'platform', value: '{{site}}', type: 'dynamic' },
    ],
    aiPrompt: 'Summarize the main argument and key points from this thread.',
    urlPatterns: ['twitter.com', 'x.com', 'reddit.com'],
  },
];

export function findMatchingTemplate(url: string, templates: Template[]): Template {
  const urlLower = url.toLowerCase();

  for (const template of templates) {
    for (const pattern of template.urlPatterns) {
      if (urlLower.includes(pattern.toLowerCase())) {
        return template;
      }
    }
  }

  // Default to article template
  return templates.find((t) => t.id === 'article') || DEFAULT_TEMPLATES[0];
}

export function getDefaultTemplates(): Template[] {
  return DEFAULT_TEMPLATES;
}


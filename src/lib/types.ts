// Core types for Engram extension

export interface ArticleMetadata {
  title: string;
  author: string | null;
  publishedDate: string | null;
  siteName: string | null;
  url: string;
  readingTime: number; // in minutes
  excerpt: string | null;
}

export interface ExtractedArticle {
  metadata: ArticleMetadata;
  content: string; // HTML content
  textContent: string; // Plain text content
}

export interface ClippedContent {
  metadata: ArticleMetadata;
  markdown: string;
  summary: string | null;
  tags: string[];
  keyTakeaways: string[];
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  frontmatterFields: FrontmatterField[];
  aiPrompt: string | null;
  urlPatterns: string[]; // Regex patterns for auto-matching
}

export interface FrontmatterField {
  key: string;
  value: string;
  type: 'static' | 'dynamic';
}

export interface VaultSettings {
  directoryHandle: FileSystemDirectoryHandle | null;
  defaultFolder: string;
  filenameTemplate: string; // e.g., "{{date}} {{title}}"
}

export interface AISettings {
  enabled: boolean;
  summaryLength: 'short' | 'medium' | 'long';
  customSystemPrompt: string | null;
}

export interface Settings {
  vault: VaultSettings;
  ai: AISettings;
  defaultTemplateId: string;
  keyboardShortcut: string;
  theme: 'light' | 'dark' | 'system';
}

export interface AISession {
  prompt: (input: string) => Promise<string>;
  destroy: () => void;
}

export interface CurrentPage {
  title: string;
  url: string;
  siteName: string;
  favicon: string;
}

export type PendingVaultAction = { type: 'clip'; withAI: boolean } | null;

export type ClipMode = 'full' | 'selection';

export interface ClipRequest {
  mode: ClipMode;
  selectedText?: string;
}

// Review Synthesis Types

export type PageType = 'article' | 'product' | 'unknown';

export interface ProductInfo {
  title: string;
  price: string | null;
  rating: number | null;
  reviewCount: number | null;
  asin: string | null;
  url: string;
  imageUrl: string | null;
}

export interface ExtractedReview {
  text: string;
  rating: number;
  title: string | null;
  helpfulCount: number;
  isVerified: boolean;
}

export interface ExtractedProductPage {
  product: ProductInfo;
  reviews: ExtractedReview[];
}

export interface SynthesizedPro {
  point: string;
  frequency: number; // How many reviews mentioned this
}

export interface SynthesizedCon {
  point: string;
  frequency: number;
}

export interface QualityAlert {
  issue: string;
  severity: 'warning' | 'critical';
}

export interface ReviewSynthesis {
  verdict: string;
  sentimentScore: number; // 0-100
  pros: SynthesizedPro[];
  cons: SynthesizedCon[];
  qualityAlerts: QualityAlert[];
  reviewsAnalyzed: number;
}

// File System Access API type augmentations
declare global {
  interface FileSystemDirectoryHandle {
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  }

  interface Window {
    showDirectoryPicker(options?: {
      mode?: 'read' | 'readwrite';
    }): Promise<FileSystemDirectoryHandle>;
  }
}

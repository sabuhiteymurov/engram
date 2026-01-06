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

export type ClipMode = 'full' | 'selection';

export interface ClipRequest {
  mode: ClipMode;
  selectedText?: string;
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

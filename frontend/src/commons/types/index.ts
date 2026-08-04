// API Types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Component Types  
export interface UploadedFile {
  file: File;
  preview: string;
  id: string;
}

export interface TestCaseResult {
  content: string;
  timestamp: Date;
}

// Toast Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Theme Types
export type Theme = 'light' | 'dark' | 'system';

// Settings Types
export interface AppSettings {
  theme: Theme;
  compactMode: boolean;
  maxTokens: number;
  temperature: number;
  autoSave: boolean;
}

// Storage Types
export interface StorageData {
  apiKey?: string;
  settings?: AppSettings;
  history?: TestCaseResult[];
}

// Credentials Types
export interface AtlassianCredentials {
  siteUrl: string;
  email: string;
  apiToken: string;
}

export interface FigmaCredentials {
  accessToken: string;
}

export interface Credentials {
  openai: string | null;
  atlassian: AtlassianCredentials | null;
  figma: FigmaCredentials | null;
}

// Source fetch Types
export type SourceKind = 'confluence' | 'figma';

export interface FigmaFrameInfo {
  id: string;
  name: string;
  type: string;
  selected?: boolean;
  image?: string;
}

export interface SourceFetchResult {
  source: SourceKind;
  title: string;
  url: string;
  text: string;
  images?: string[];
  frames?: FigmaFrameInfo[];
}

export interface StructuredTestCase {
  id: string;
  title: string;
  description: string;
  preconditions: string[];
  steps: string[];
  expected: string[];
  priority: string;
  regression: string;
  testData: string[];
  postconditions: string[];
  coversRequirements?: string[];
  sources?: string[];
}

export interface CoverageItem {
  requirementId: string;
  requirementText: string;
  coveredBy: string[];
  status: 'covered' | 'uncovered';
}

export interface GenerateResponse {
  testCases: StructuredTestCase[];
  markdown: string;
  requirements: Array<{ id: string; text: string }>;
  coverage: CoverageItem[];
}


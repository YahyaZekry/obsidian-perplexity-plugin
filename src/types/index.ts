import { Plugin, PluginSettingTab, Setting, Modal, Notice, TFile, MarkdownView, App } from 'obsidian';

export interface SpellCheckResult {
    corrections: Array<{
        original: string;
        suggested: string;
        line: number;
        confidence: number;
        context?: string;
    }>;
    formattingIssues: Array<{
        issue: string;
        line: number;
        suggestion: string;
        fixable: boolean;
        originalText?: string;
        suggestedText?: string;
    }>;
}

export interface EnhancedRewriteResult {
    success: boolean;
    enhancedContent: string;
    improvements: string[];
    summary: string;
    error?: string;
}

export type SpellCheckMode = 'auto' | 'full' | 'incremental';

export interface SpellCheckContext {
    settings?: PerplexityPluginSettings;
    onProgress?: (progress: number, message: string) => void;
    onSectionComplete?: (section: number, total: number, result: SpellCheckResult) => void;
    onModeSwitchSuggestion?: (suggestedMode: SpellCheckMode, reason: string) => void;
}

export interface PerplexityService {
    checkSpellingAndFormat(content: string, language: string): Promise<SpellCheckResult>;
    applyCorrectionsWithChunks(content: string, language: string): Promise<string>;
    createEnhancedRewrite(content: string, language: string): Promise<string>;
}

export interface PerplexityPluginSettings {
    apiKey: string;
    spellCheckLanguage: string;
    similarityThreshold: number;
    batchSize: number;
    cacheEnabled: boolean;
    cacheDuration: number;
    autoFormat: boolean;
    smartLinking: boolean;
    rtlSupport: boolean;
    excludedExtensions: string[];
    smartLinkingMode: 'current' | 'all';
    maxLinkSuggestions: number;
    showLinkReasoning: boolean;
    spellCheckModel: string;
    linkAnalysisModel: string;
    spellCheckScope: 'current' | 'vault';
    enhancedRewriteModel: string;

    spellCheckMode: SpellCheckMode;
    fullModeChunkSize: number;
    fullModeShowProgress: boolean;
    autoModeThreshold: number;
    incrementalModeSectionSize: number;
    vaultSpellCheckMode: SpellCheckMode;
    vaultFullModeChunkSize: number;
    vaultAutoModeThreshold: number;
    allowModeSwitching: boolean;
}

export interface VaultAnalysisResult {
    totalFiles: number;
    markdownFiles: number;
    themes: string[];
    fileTypes: Record<string, number>;
}

export interface SmartLinkSuggestion {
    title: string;
    path: string;
    relevance: number;
    connectionType: 'conceptual' | 'sequential' | 'complementary' | 'reference';
    reasoning: string;
    commonThemes: string[];
    contentPreview: string;
}



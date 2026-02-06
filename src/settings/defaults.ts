import { PerplexityPluginSettings } from '../types';

export type { PerplexityPluginSettings } from '../types';

export const DEFAULT_SETTINGS: PerplexityPluginSettings = {
    version: 2,
    apiKey: '',
    spellCheckLanguage: 'en',
    similarityThreshold: 0.7,
    batchSize: 10,
    cacheEnabled: true,
    cacheDuration: 24 * 60 * 60 * 1000,
    autoFormat: true,
    smartLinking: true,
    rtlSupport: false,
    excludedExtensions: ['pdf', 'docx', 'xlsx', 'pptx', 'zip', 'rar', 'exe', 'img', 'png', 'jpg', 'jpeg', 'gif'],
    smartLinkingMode: 'current',
    maxLinkSuggestions: 10,
    showLinkReasoning: true,
    spellCheckModel: 'sonar',
    linkAnalysisModel: 'sonar-pro',
    spellCheckScope: 'current',
    enhancedRewriteModel: 'sonar-reasoning-pro',
    spellCheckPrompt: 'standard',
    spellCheckMode: 'incremental',
    fullModeChunkSize: 4000,
    fullModeShowProgress: true,
    autoModeThreshold: 3,
    incrementalModeSectionSize: 5000,
    vaultSpellCheckMode: 'full',
    vaultFullModeChunkSize: 4000,
    vaultAutoModeThreshold: 2,
    allowModeSwitching: true,
};

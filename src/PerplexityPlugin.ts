import { Plugin, Notice, TFile, App } from 'obsidian';
import { PerplexitySettingTab } from './settings/SettingsTab';
import { CacheManager } from './services/CacheManager';
import { VaultAnalyzer } from './services/VaultAnalyzer';
import { PerplexityService } from './services/PerplexityService';
import { PerplexityMainModal } from './ui/modals/MainModal';
import { VaultAnalysisModal } from './ui/modals/VaultSpellCheckModal';
import { SmartLinksModal } from './ui/modals/ModelRecommendationsModal';
import { migrate } from './settings/migration';

interface SpellCheckResult {
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

interface SpellCheckContext {
    settings?: PerplexityPluginSettings;
    onProgress?: (progress: number, message: string) => void;
    onSectionComplete?: (section: number, total: number, result: SpellCheckResult) => void;
    onModeSwitchSuggestion?: (suggestedMode: string, reason: string) => void;
}

type SpellCheckMode = 'auto' | 'full' | 'incremental';

interface PerplexityPluginSettings {
    version: number;
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
    spellCheckPrompt: 'standard' | 'superprompt';

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

const DEFAULT_SETTINGS: PerplexityPluginSettings = {
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

export class PerplexityPlugin extends Plugin {
    settings: PerplexityPluginSettings;
    cacheManager: CacheManager;
    vaultAnalyzer: VaultAnalyzer;
    perplexityService: PerplexityService;

    async onload() {
        console.log('🚀 Perplexity Vault Assistant Plugin loading...');
        
        await this.loadSettings();
        
        this.addSettingTab(new PerplexitySettingTab(this.app, this));
        
        this.cacheManager = new CacheManager(this.app);
        this.vaultAnalyzer = new VaultAnalyzer(this.app, this.cacheManager, this.settings);
        this.perplexityService = new PerplexityService(this.cacheManager, this.settings);

        this.addRibbonIcon('brain', 'Perplexity Assistant', () => {
            new PerplexityMainModal(this.app, this).open();
        });

        this.addCommand({
            id: 'perplexity-spell-check',
            name: 'Spell Check & Enhancement',
            callback: () => new PerplexityMainModal(this.app, this).open()
        });

        this.addCommand({
            id: 'perplexity-vault-analysis',
            name: 'Analyze Vault',
            callback: () => this.analyzeVault()
        });

        this.addCommand({
            id: 'perplexity-smart-links',
            name: 'Generate Smart Links',
            callback: () => this.generateSmartLinks()
        });

        console.log('✅ Plugin loaded successfully');
    }

    async loadSettings() {
        const loadedData = await this.loadData();
        this.settings = migrate(Object.assign({}, DEFAULT_SETTINGS, loadedData));
        await this.saveSettings(); // Save migrated settings
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    openSettings() {
        (this.app as any).setting.open();
        (this.app as any).setting.openTabById('obsidian-perplexity-plugin');
    }

    async analyzeVault() {
        if (!this.settings.apiKey) {
            new Notice('Please configure your Perplexity API key in settings');
            return;
        }

        const notice = new Notice('📊 Analyzing vault...', 0);

        try {
            const analysis = await this.vaultAnalyzer.analyzeVault();
            
            notice.hide();
            new Notice(`✅ Vault analyzed: ${analysis.markdownFiles} markdown files with themes: ${analysis.themes.join(', ')}`);
            
            new VaultAnalysisModal(this.app, analysis).open();
        } catch (error) {
            notice.hide();
            new Notice(`❌ Analysis failed: ${error.message}`);
        }
    }

    async generateSmartLinks() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('Please open a markdown file first');
            return;
        }

        if (!this.settings.apiKey) {
            new Notice('Please configure your Perplexity API key in settings');
            return;
        }

        const notice = new Notice('🔗 Generating smart links...', 0);

        try {
            const mode = this.settings.smartLinkingMode || 'current';
            const suggestions = await this.vaultAnalyzer.generateSmartLinks(mode);
            
            notice.hide();
            new Notice(`✅ Generated ${suggestions.length} smart link suggestions`);
            
            new SmartLinksModal(this.app, activeFile, suggestions).open();
        } catch (error) {
            notice.hide();
            new Notice(`❌ Smart links failed: ${error.message}`);
        }
    }

    simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    onunload() {
        console.log('👋 Perplexity Vault Assistant Plugin unloading');
    }
}

export default PerplexityPlugin;

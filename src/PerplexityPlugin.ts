import { Plugin, PluginSettingTab, Setting, Modal, Notice, TFile, MarkdownView, App } from 'obsidian';
import { PerplexitySettingTab } from './settings/SettingsTab';
import { CacheManager } from './services/CacheManager';
import { VaultAnalyzer } from './services/VaultAnalyzer';

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
    onProgress?: (progress: number, message: string) => void;
    onSectionComplete?: (section: number, total: number, result: SpellCheckResult) => void;
    onModeSwitchSuggestion?: (suggestedMode: string, reason: string) => void;
}

type SpellCheckMode = 'auto' | 'full' | 'incremental';

interface PerplexityPluginSettings {
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

const DEFAULT_SETTINGS: PerplexityPluginSettings = {
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

export default class PerplexityPlugin extends Plugin {
    settings: PerplexityPluginSettings;
    cacheManager: CacheManager;
    vaultAnalyzer: VaultAnalyzer;
    perplexityService: any;

    async onload() {
        console.log('🚀 Perplexity Vault Assistant Plugin loading...');
        
        await this.loadSettings();
        
        this.addSettingTab(new PerplexitySettingTab(this.app, this));
        
        this.cacheManager = new CacheManager(this.app);
        this.vaultAnalyzer = new VaultAnalyzer(this.app, this.cacheManager);
        this.perplexityService = {
            checkSpellingAndFormat: async (content: string, language: string): Promise<SpellCheckResult> => {
                const cacheKey = `spell:${language}:${this.simpleHash(content)}`;
                const cached = await this.cacheManager.get(cacheKey, this.settings.cacheDuration);
                
                if (cached && this.settings.cacheEnabled) {
                    return cached;
                }

                const response = await fetch('https://api.perplexity.ai/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.settings.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: this.settings.spellCheckModel || 'sonar',
                        messages: [
                            {
                                role: 'system',
                                content: `Spell checker for ${language}. Return ONLY JSON:
{
  "corrections": [{"original": "word", "suggested": "fix", "line": 1, "confidence": 0.9, "context": "sentence containing the error"}],
  "formattingIssues": [{"issue": "description", "line": 1, "suggestion": "fix", "fixable": true}]
}

CRITICAL RULES:
- For Arabic (ar): PRESERVE all diacritics (تشكيل/tashkeel marks) - do NOT remove them
- For Arabic: Respect original grammatical rules and vowel marks
- For all languages: Only fix actual spelling/grammar errors
- Return context field showing the sentence containing each error
- Include line numbers for each correction`
                            },
                            {
                                role: 'user',
                                content: `Check: ${content.substring(0, 5000)}`
                            }
                        ],
                        max_tokens: 4000,
                        temperature: 0.1
                    })
                });

                const data = await response.json();
                let responseContent = data.choices[0].message.content;
                
                responseContent = responseContent.replace(/[\s\S]*?<\/think>/g, '');
                const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) responseContent = jsonMatch[0];

                const parsed = JSON.parse(responseContent);
                console.log('✅ API Response:', parsed); // Debug log

                // Add fallback context if not provided
                const result: SpellCheckResult = {
                    corrections: (parsed.corrections || []).map((c: any) => ({
                        ...c,
                        context: c.context || 'No context available'
                    })).filter((c: any) => c.original && c.suggested),
                    formattingIssues: (parsed.formattingIssues || []).map((i: any) => ({
                        ...i,
                        originalText: i.originalText || 'No original text available',
                        suggestedText: i.suggestedText || 'No suggested text available'
                    })).filter((i: any) => i.issue)
                };

                if (this.settings.cacheEnabled) {
                    await this.cacheManager.set(cacheKey, result, this.settings.cacheDuration);
                }

                return result;
            },
            
            applyCorrectionsWithChunks: async (content: string, language: string): Promise<string> => {
                if (content.length > 15000) {
                    const sections = content.split(/\n(?=##? )/);
                    const correctedSections: string[] = [];

                    for (let i = 0; i < sections.length; i++) {
                        const section = sections[i].trim();
                        if (!section) continue;

                        try {
                            const correctedSection = await this.perplexityService.applySectionCorrections(section, language);
                            correctedSections.push(correctedSection);
                            await new Promise(resolve => setTimeout(resolve, 800));
                        } catch (error) {
                            console.error(`Section ${i + 1} correction failed:`, error);
                            correctedSections.push(section);
                        }
                    }

                    return correctedSections.join('\n\n');
                }

                return await this.perplexityService.applySectionCorrections(content, language);
            },

            createEnhancedRewrite: async (content: string): Promise<string> => {
                if (content.length > 15000) {
                    const sections = content.split(/\n(?=##? )/);
                    const enhanced: string[] = [];

                    for (const section of sections) {
                        if (section.trim()) {
                            try {
                                const result = await this.perplexityService.enhanceSection(section);
                                enhanced.push(result);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            } catch {
                                enhanced.push(section);
                            }
                        }
                    }

                    return enhanced.join('\n\n');
                }

                return await this.perplexityService.enhanceSection(content);
            },

            applySectionCorrections: async (content: string, language: string): Promise<string> => {
                const messages = [
                    {
                        role: 'system',
                        content: `You are a ${language} spell checker and formatter.

CRITICAL: 
- Fix ONLY spelling mistakes and grammar errors
- Fix ONLY markdown formatting issues  
- DO NOT rewrite, rephrase, or change content
- DO NOT add new information or explanations
- PRESERVE exact same meaning, style, and structure
- Return corrected text directly (NO JSON, NO code blocks)

Just return same content with corrections applied.`
                    },
                    {
                        role: 'user', 
                        content: `Apply ONLY spelling and formatting corrections to this content (keep everything else exactly the same):

${content}`
                    }
                ];

                try {
                    const response = await fetch('https://api.perplexity.ai/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.settings.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: this.settings.spellCheckModel || 'sonar',
                            messages,
                            max_tokens: 6000,
                            temperature: 0.1
                        })
                    });

                    const data = await response.json();
                    let corrected = data.choices[0].message.content.trim();
                    
                    corrected = corrected.replace(/[\s\S]*?<\/think>/g, '');
                    corrected = corrected.replace(/```[\s\S]*?```/g, '');
                    corrected = corrected.trim();

                    return corrected.length > 50 ? corrected : content;
                } catch (error) {
                    console.error('Section correction error:', error);
                    return content;
                }
            },

            enhanceSection: async (content: string): Promise<string> => {
                const messages = [
                    {
                        role: 'system',
                        content: 'Enhance this markdown content. Return ONLY enhanced markdown content directly (no JSON, no code blocks).'
                    },
                    {
                        role: 'user',
                        content: `Enhance this content:\n\n${content}`
                    }
                ];

                try {
                    const response = await fetch('https://api.perplexity.ai/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.settings.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: this.settings.enhancedRewriteModel || 'sonar-reasoning-pro',
                            messages,
                            max_tokens: 6000,
                            temperature: 0.1
                        })
                    });

                    const data = await response.json();
                    let enhanced = data.choices[0].message.content.trim();
                    enhanced = enhanced.replace(/[\s\S]*?<\/think>/g, '');
                    enhanced = enhanced.replace(/```[\s\S]*?```/g, '');
                    return enhanced.startsWith('#') ? enhanced : content;
                } catch {
                    return content;
                }
            }
        };

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
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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

    private simpleHash(str: string): string {
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

class PerplexityMainModal extends Modal {
    constructor(app: App, private plugin: PerplexityPlugin) {
        super(app);
    }

    onOpen() {
        const contentEl = this.contentEl;

        contentEl.createEl('h2', { text: 'Perplexity Vault Assistant' });

        new Setting(contentEl)
            .setName('📝 Spell Check & Enhancement')
            .setDesc('5 spell check and enhancement options')
            .addButton(btn => btn
                .setButtonText('Open Enhancer')
                .setCta()
                .onClick(() => {
                    this.close();
                    new SpellCheckEnhancementModal(this.app, this.plugin).open();
                }));

        new Setting(contentEl)
            .setName('📊 Analyze Vault')
            .setDesc('Analyze all markdown files')
            .addButton(btn => btn
                .setButtonText('Start Analysis')
                .onClick(async () => {
                    this.close();
                    await this.plugin.analyzeVault();
                }));

        new Setting(contentEl)
            .setName('🔗 Smart Connections')
            .setDesc('Generate intelligent links')
            .addButton(btn => btn
                .setButtonText('Generate Links')
                .onClick(async () => {
                    this.close();
                    await this.plugin.generateSmartLinks();
                }));

        new Setting(contentEl)
            .setName('💖 Show Help & Documentation')
            .setDesc('Complete documentation and usage guide')
            .addButton(btn => btn
                .setButtonText('Open Help')
                .onClick(() => {
                    this.close();
                    new HelpModal(this.app).open();
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}

class VaultAnalysisModal extends Modal {
    constructor(app: App, private analysis: any) {
        super(app);
    }

    onOpen() {
        const contentEl = this.contentEl;

        contentEl.createEl('h2', { text: '📊 Vault Analysis Results' });

        contentEl.createEl('h3', { text: `📚 Files: ${this.analysis.totalFiles} total, ${this.analysis.markdownFiles} markdown` });

        contentEl.createEl('h3', { text: '🎯 Themes Detected' });
        
        if (this.analysis.themes && this.analysis.themes.length > 0) {
            const themesList = contentEl.createEl('ul');
            this.analysis.themes.forEach((theme: string) => {
                themesList.createEl('li', { text: `• ${theme}` });
            });
        } else {
            contentEl.createEl('p', { text: 'No themes detected' });
        }

        if (this.analysis.fileTypes) {
            contentEl.createEl('h3', { text: '📁 File Types' });
            const typesList = contentEl.createDiv({ cls: 'file-types-breakdown' });
            
            for (const [ext, count] of Object.entries(this.analysis.fileTypes)) {
                const item = typesList.createDiv({ cls: 'file-type-item' });
                item.createEl('span', { text: `.${ext}:` });
                const countBadge = item.createEl('span', { 
                    text: (count as number).toString(),
                    cls: 'file-count'
                });
            }
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

class SmartLinksModal extends Modal {
    constructor(app: App, private currentFile: TFile, private suggestions: any[]) {
        super(app);
        this.setTitle(`Smart Links for: ${this.currentFile.basename}`);
    }

    onOpen() {
        const contentEl = this.contentEl;

        if (this.suggestions.length === 0) {
            contentEl.createEl('p', { text: 'No smart link suggestions found.' });
            return;
        }

        this.suggestions.forEach((suggestion: any, index: number) => {
            const suggestionDiv = contentEl.createDiv({ cls: 'smart-link-suggestion' });

            const headerDiv = suggestionDiv.createDiv({ cls: 'suggestion-header' });

            const titleEl = headerDiv.createEl('h4', { text: suggestion.title });
            
            const relevanceBadge = headerDiv.createEl('span', {
                text: `${Math.round(suggestion.relevance * 100)}%`,
                cls: 'relevance-score'
            });

            if (suggestion.connectionType) {
                const connectionBadge = headerDiv.createEl('span', {
                    text: suggestion.connectionType,
                    cls: 'connection-type-badge'
                });
            }

            if (suggestion.reasoning) {
                suggestionDiv.createEl('p', { 
                    text: `💭 ${suggestion.reasoning}`,
                    cls: 'link-reasoning'
                });
            }

            if (suggestion.commonThemes && suggestion.commonThemes.length > 0) {
                const themesDiv = suggestionDiv.createDiv({ cls: 'themes-section' });
                themesDiv.createEl('strong', { text: '🎯 Common Themes:' });
                suggestion.commonThemes.forEach((theme: string) => {
                    themesDiv.createEl('span', {
                        text: theme,
                        cls: 'theme-tag'
                    });
                });
            }

            if (suggestion.contentPreview) {
                const previewDiv = suggestionDiv.createDiv({ cls: 'content-preview' });
                previewDiv.createEl('strong', { text: '📄 Preview:' });
                previewDiv.createEl('p', { text: suggestion.contentPreview });
            }

            const addLinkBtn = suggestionDiv.createEl('button', {
                text: '🔗 Add Link to Current File',
                cls: 'add-link-btn'
            });
            addLinkBtn.onclick = () => this.addLink(suggestion);
        });
    }

    private async addLink(suggestion: any) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('Please open a file in editor mode');
            return;
        }

        try {
            const linkText = `[[${suggestion.path}]]`;
            const cursor = activeView.editor.getCursor();
            activeView.editor.replaceRange(linkText, cursor);
            new Notice(`✅ Added link to ${suggestion.title}`);
        } catch (error) {
            new Notice(`❌ Failed to add link: ${error.message}`);
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

class HelpModal extends Modal {
    constructor(app: App) {
        super(app);
        this.setTitle('📖 Perplexity Vault Assistant - Help');
    }

    onOpen() {
        const contentEl = this.contentEl;

        contentEl.createEl('h2', { text: '📚 Documentation' });

        const sections = [
            {
                title: 'Getting Started',
                content: `
                    <h3>🚀 Getting Started</h3>
                    <p><strong>1. Setup API Key:</strong></p>
                    <ul>
                        <li>Get your API key from <a href="https://perplexity.ai">perplexity.ai</a></li>
                        <li>Go to Settings → Community Plugins → Perplexity Vault Assistant</li>
                        <li>Enter your API key in settings</li>
                    </ul>
                    
                    <p><strong>2. Spell Check Modes:</strong></p>
                    <ul>
                        <li><strong>Full Mode:</strong> Checks entire document with chunked processing. Best for final drafts.</li>
                        <li><strong>Incremental Mode:</strong> Check section-by-section to control costs. Great for drafts.</li>
                        <li><strong>Auto Mode:</strong> Smart balance. Analyzes first section, auto-suggests full check if needed.</li>
                    </ul>
                    
                    <p><strong>3. Vault Analysis:</strong></p>
                    <p>Use the ribbon icon or command palette to analyze your entire vault. Detects themes and content patterns across all markdown files.</p>
                `
            },
            {
                title: 'Smart Linking',
                content: `
                    <h3>🔗 Smart Linking</h3>
                    <p>AI-powered link suggestions based on semantic analysis of your notes:</p>
                    <ul>
                        <li><strong>Conceptual:</strong> Files sharing similar ideas or topics</li>
                        <li><strong>Sequential:</strong> Files that follow a logical progression</li>
                        <li><strong>Complementary:</strong> Files with supporting information</li>
                        <li><strong>Reference:</strong> Files that cite or reference each other</li>
                    </ul>
                    <p>Each suggestion includes a relevance score, reasoning, and common themes.</p>
                `
            },
            {
                title: 'Settings Guide',
                content: `
                    <h3>⚙️ Settings Guide</h3>
                    <p><strong>Spell Check Mode:</strong> Choose between Full, Incremental, or Auto modes for spell checking.</p>
                    <p><strong>Chunk Size:</strong> Control how many characters per API call (Full mode).</p>
                    <p><strong>Error Threshold:</strong> Auto mode triggers full check when error density exceeds this threshold.</p>
                    <p><strong>RTL Support:</strong> Enable for Arabic and other right-to-left languages.</p>
                    <p><strong>Caching:</strong> Enable to reduce API calls and costs.</p>
                    <p><strong>File Filtering:</strong> Exclude certain file types from analysis (PDFs, images, etc.).</p>
                `
            },
            {
                title: 'Troubleshooting',
                content: `
                    <h3>🔧 Troubleshooting</h3>
                    <p><strong>API key not configured:</strong></p>
                    <p>Go to Settings → Community Plugins → Perplexity Vault Assistant and enter your API key.</p>
                    
                    <p><strong>Rate limit exceeded:</strong></p>
                    <p>Wait 60 seconds before trying again. Consider using caching to reduce API calls.</p>
                    
                    <p><strong>Spell check not working:</strong></p>
                    <p>Check your spell check mode setting. Try switching from Incremental to Full mode.</p>
                    
                    <p><strong>File conflicts:</strong></p>
                    <p>If a file was modified externally, the plugin will show a conflict dialog. You can choose to merge or overwrite.</p>
                `
            }
        ];

        sections.forEach((section, index) => {
            const sectionDiv = contentEl.createDiv({ cls: 'help-section' });
            sectionDiv.createEl('h3', { text: `${index + 1}. ${section.title}` });
            sectionDiv.innerHTML += section.content;
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

class SpellCheckEnhancementModal extends Modal {
    constructor(app: App, private plugin: PerplexityPlugin) {
        super(app);
    }

    onOpen() {
        const contentEl = this.contentEl;

        contentEl.createEl('h2', { text: 'Spell Check & Enhancement Options' });

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            contentEl.createEl('p', { text: '⚠️ Please open a markdown file first' });
            return;
        }

        contentEl.createEl('p', { text: `Current file: ${activeFile.basename} (${activeFile.stat?.size || 0} bytes)` });

        contentEl.createEl('hr');

        new Setting(contentEl)
            .setName('📝 Current Mode: ' + this.plugin.settings.spellCheckMode)
            .setDesc(this.getModeDescription(this.plugin.settings.spellCheckMode));

        new Setting(contentEl)
            .setName('1. 🔍 Check Spelling & Formatting (Current Mode)')
            .setDesc('Show results and let you choose which corrections to apply')
            .addButton(btn => btn
                .setButtonText('Check & Show Results')
                .setCta()
                .onClick(async () => {
                    this.close();
                    await this.runSpellCheck();
                }));

        new Setting(contentEl)
            .setName('2. ✅ Apply Corrections Only (Chunked)')
            .setDesc('Same document with spelling fixes - handles large documents')
            .addButton(btn => btn
                .setButtonText('Apply Corrections')
                .onClick(async () => {
                    this.close();
                    await this.applyCorrectionsOnly();
                }));

        new Setting(contentEl)
            .setName('3. 🚀 Full Enhancement')
            .setDesc('Rewrite and improve content with comprehensive enhancements')
            .addButton(btn => btn
                .setButtonText('Full Enhancement')
                .onClick(async () => {
                    this.close();
                    await this.createFullEnhancement();
                }));

        new Setting(contentEl)
            .setName('4. 🔄 Change Spell Check Mode')
            .setDesc('Switch to a different spell checking strategy')
            .addDropdown(dropdown => dropdown
                .addOption('auto', '🤖 Auto (Smart)')
                .addOption('full', '✅ Full (Complete Coverage)')
                .addOption('incremental', '💰 Incremental (Cost-Safe)')
                .setValue(this.plugin.settings.spellCheckMode)
                .onChange(async (value) => {
                    this.plugin.settings.spellCheckMode = value as SpellCheckMode;
                    await this.plugin.saveSettings();
                }));
    }

    private getModeDescription(mode: string): string {
        switch (mode) {
            case 'full':
                return 'Complete coverage with chunked processing. Recommended for final drafts.';
            case 'incremental':
                return 'Check section-by-section to control costs. Great for drafts.';
            case 'auto':
                return 'Smart balance. Analyzes first section, auto-suggests full check if needed.';
            default:
                return 'Unknown mode';
        }
    }

    private async runSpellCheck() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Please open a markdown file first');
            return;
        }

        const notice = new Notice('🔍 Analyzing spelling and formatting...', 0);

        try {
            const content = await this.app.vault.read(activeFile);
            const context: SpellCheckContext = {
                onProgress: (progress: number, message: string) => {
                    notice.setMessage(`⏳ ${message} (${progress}%)`);
                }
            };

            const result = await this.plugin.perplexityService.checkSpellingAndFormat(content, this.plugin.settings.spellCheckLanguage);

            notice.hide();
            new Notice(`✅ Found ${result.corrections.length} corrections and ${result.formattingIssues.length} formatting issues`);

            new SpellCheckResultsModal(this.app, activeFile, result, this.plugin).open();
        } catch (error) {
            notice.hide();
            new Notice(`❌ Check failed: ${error.message}`);
        }
    }

    private async applyCorrectionsOnly() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Please open a markdown file first');
            return;
        }

        const notice = new Notice('✅ Applying corrections...', 0);

        try {
            const content = await this.app.vault.read(activeFile);
            const correctedContent = await this.plugin.perplexityService.applyCorrectionsWithChunks(content, this.plugin.settings.spellCheckLanguage);

            const correctedName = `${activeFile.basename}-corrected.md`;
            const correctedPath = activeFile.path.replace(`${activeFile.basename}.md`, correctedName);
            await this.app.vault.create(correctedPath, correctedContent);

            notice.hide();
            new Notice(`✅ Created ${correctedName}`);

            setTimeout(async () => {
                await this.app.workspace.openLinkText(activeFile.path, '', false);
                await this.app.workspace.openLinkText(correctedPath, '', 'split');
            }, 1000);
        } catch (error) {
            notice.hide();
            new Notice(`❌ Corrections failed: ${error.message}`);
        }
    }

    private async createFullEnhancement() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Please open a markdown file first');
            return;
        }

        const notice = new Notice('🚀 Creating enhancement...', 0);

        try {
            const content = await this.app.vault.read(activeFile);
            const enhanced = await this.plugin.perplexityService.createEnhancedRewrite(content);

            const enhancedName = `${activeFile.basename}-enhanced.md`;
            const enhancedPath = activeFile.path.replace(`${activeFile.basename}.md`, enhancedName);
            await this.app.vault.create(enhancedPath, enhanced);

            notice.hide();
            new Notice(`✅ Created ${enhancedName}`);

            setTimeout(async () => {
                await this.app.workspace.openLinkText(activeFile.path, '', false);
                await this.app.workspace.openLinkText(enhancedPath, '', 'split');
            }, 1000);
        } catch (error) {
            notice.hide();
            new Notice(`❌ Enhancement failed: ${error.message}`);
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

class SpellCheckResultsModal extends Modal {
    constructor(app: App, private file: TFile, private result: SpellCheckResult, private plugin: PerplexityPlugin) {
        super(app);
        this.setTitle(`Check Results - ${this.file.basename}`);
    }

    onOpen() {
        const contentEl = this.contentEl;
        const isRTL = this.plugin.settings.rtlSupport || false;

        if (this.result.corrections?.length > 0) {
            contentEl.createEl('h3', { text: `📝 Spelling Corrections (${this.result.corrections.length})` });

            this.result.corrections.forEach((correction: any, i) => {
                const div = contentEl.createDiv({ cls: 'spell-check-item' });

                div.createEl('h4', { text: `Correction ${i + 1}` });
                div.createEl('p', { text: `"${correction.original}" → "${correction.suggested}"` });
                div.createEl('p', { text: `Line ${correction.line} (${Math.round(correction.confidence * 100)}% confidence)` });

                const context = correction.context || 'No context available';
                const contextDiv = div.createDiv({ cls: 'error-context' });
                if (isRTL) {
                    contextDiv.addClass('rtl-content');
                }
                contextDiv.createEl('strong', { text: '📄 Context:' });
                const contextText = contextDiv.createEl('p', { cls: 'context-text' });
                
                try {
                    const highlightedContext = context.replace(
                        new RegExp(`(${correction.original.replace(/[.*+?^${}()|[\\[\\]\\\\]/g, '\\\\$&')})`, 'gi'),
                        '<mark class="error-highlight">$1</mark>'
                    );
                    contextText.innerHTML = highlightedContext;
                    
                    const markElement = contextText.querySelector('.error-highlight');
                    if (markElement) {
                        (markElement as any).style.cursor = 'pointer';
                        (markElement as any).style.textDecoration = 'underline';
                        (markElement as any).addEventListener('click', () => this.scrollToLine(correction.line));
                    }
                } catch (error) {
                    contextText.textContent = context;
                }

                const applyBtn = div.createEl('button', { text: '✓ Apply This' });
                applyBtn.onclick = () => this.applySingle(correction.original, correction.suggested, div);
            });

            const applyAllBtn = contentEl.createEl('button', { 
                text: '✅ Apply All Spelling Corrections',
                cls: 'apply-all-btn'
            });
            applyAllBtn.onclick = () => this.applyAllCorrections();
        }

        if (this.result.formattingIssues?.length > 0) {
            contentEl.createEl('h3', { text: `🔧 Formatting Issues (${this.result.formattingIssues.length})` });

            this.result.formattingIssues.forEach((issue: any, i) => {
                const div = contentEl.createDiv({ cls: 'formatting-item' });

                div.createEl('h4', { text: `Issue ${i + 1}` });
                div.createEl('p', { text: `Line ${issue.line}: ${issue.issue}` });
                div.createEl('p', { text: `Fix: ${issue.suggestion}` });

                if (issue.originalText && issue.suggestedText) {
                    const contextDiv = div.createDiv({ cls: 'error-context' });
                    if (isRTL) {
                        contextDiv.addClass('rtl-content');
                    }
                    contextDiv.createEl('strong', { text: '📄 Context:' });
                    const contextText = contextDiv.createEl('p', { cls: 'context-text' });
                    
                    try {
                        const highlightedContext = issue.originalText.replace(
                            new RegExp(`(${issue.originalText.replace(/[.*+?^${}()|[\\[\\]\\\\]/g, '\\\\$&')})`, 'gi'),
                            '<mark class="error-highlight">$1</mark>'
                        );
                        contextText.innerHTML = highlightedContext;
                        
                        const markElement = contextText.querySelector('.error-highlight');
                        if (markElement) {
                            (markElement as any).style.cursor = 'pointer';
                            (markElement as any).style.textDecoration = 'underline';
                            (markElement as any).addEventListener('click', () => this.scrollToLine(issue.line));
                        }
                    } catch (error) {
                        contextText.textContent = issue.originalText;
                    }
                }

                if (issue.fixable && issue.originalText && issue.suggestedText) {
                    const fixBtn = div.createEl('button', { text: '🔧 Fix This' });
                    fixBtn.onclick = () => this.applySingle(issue.originalText, issue.suggestedText, div);
                }
            });

            const fixableIssues = this.result.formattingIssues.filter((i: any) => i.fixable);
            if (fixableIssues.length > 0) {
                const fixAllBtn = contentEl.createEl('button', { 
                    text: `🔧 Fix All ${fixableIssues.length} Formatting Issues`,
                    cls: 'fix-all-btn'
                });
                fixAllBtn.onclick = () => this.applyAllFixes();
            }
        }

        if (this.result.corrections.length === 0 && this.result.formattingIssues.length === 0) {
            contentEl.createEl('p', { text: '✅ No issues found! Your document looks perfect.' });
        }
    }

    private async applySingle(original: string, suggested: string, div: HTMLElement) {
        try {
            const content = await this.app.vault.read(this.file);
            const newContent = content.replace(original, suggested);
            await this.app.vault.modify(this.file, newContent);

            div.style.opacity = '0.5';
            new Notice(`✅ Applied: ${original.substring(0, 30)}...`);
        } catch (error) {
            new Notice(`❌ Failed: ${error.message}`);
        }
    }

    private async applyAllCorrections() {
        const notice = new Notice('⏳ Applying all corrections...', 0);
        try {
            let content = await this.app.vault.read(this.file);
            this.result.corrections.forEach((correction: any) => {
                content = content.replace(correction.original, correction.suggested);
            });
            await this.app.vault.modify(this.file, content);
            notice.hide();
            new Notice(`✅ Applied ${this.result.corrections.length} corrections!`);
            this.close();
        } catch (error) {
            notice.hide();
            new Notice(`❌ Failed: ${error.message}`);
        }
    }

    private async applyAllFixes() {
        const fixableIssues = this.result.formattingIssues.filter((i: any) => i.fixable);
        const notice = new Notice(`⏳ Applying ${fixableIssues.length} fixes...`, 0);
        try {
            let content = await this.app.vault.read(this.file);
            fixableIssues.forEach((issue: any) => {
                if (issue.originalText && issue.suggestedText) {
                    content = content.replace(issue.originalText, issue.suggestedText);
                }
            });
            await this.app.vault.modify(this.file, content);
            notice.hide();
            new Notice(`✅ Applied ${fixableIssues.length} formatting fixes!`);
            this.close();
        } catch (error) {
            notice.hide();
            new Notice(`❌ Failed: ${error.message}`);
        }
    }

    private scrollToLine(lineNumber: number) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('Please open the file in editor mode');
            return;
        }

        const editor = activeView.editor;
        const lineCount = editor.lineCount();

        if (lineNumber > 0 && lineNumber <= lineCount) {
            editor.setCursor({ line: lineNumber - 1, ch: 0 });
            editor.scrollIntoView({
                from: { line: lineNumber - 1, ch: 0 },
                to: { line: lineNumber - 1, ch: 0 }
            });
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

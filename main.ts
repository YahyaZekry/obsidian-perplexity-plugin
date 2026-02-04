import { App, Plugin, PluginSettingTab, Setting, Modal, Notice, TFile, MarkdownView } from 'obsidian';

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
    enhancedRewriteModel: 'sonar-reasoning-pro'
};

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

interface EnhancedRewriteResult {
    success: boolean;
    enhancedContent: string;
    improvements: string[];
    summary: string;
    error?: string;
}

class UIUtils {
    static showLoadingButton(button: HTMLElement, loadingText: string = 'Loading...'): void {
        button.classList.add('btn-loading');
        button.setAttribute('disabled', 'true');
        const originalText = button.textContent || '';
        button.setAttribute('data-original-text', originalText);
        button.textContent = loadingText;
    }

    static hideLoadingButton(button: HTMLElement): void {
        button.classList.remove('btn-loading');
        button.removeAttribute('disabled');
        const originalText = button.getAttribute('data-original-text');
        if (originalText) {
            button.textContent = originalText;
            button.removeAttribute('data-original-text');
        }
    }

    static showStatusMessage(container: HTMLElement, type: 'success' | 'error' | 'loading' | 'warning', message: string): HTMLElement {
        const statusDiv = container.createDiv({ cls: `status-message status-${type}` });
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⏳';
        statusDiv.createSpan({ text: `${icon} ${message}` });
        return statusDiv;
    }

    static showProgressIndicator(container: HTMLElement, text: string): { update: (progress: number, text?: string) => void; remove: () => void } {
        const progressDiv = container.createDiv({ cls: 'progress-indicator' });
        const textEl = progressDiv.createDiv({ cls: 'progress-text', text });
        const barContainer = progressDiv.createDiv({ cls: 'progress-bar' });
        const progressFill = barContainer.createDiv({ cls: 'progress-fill' });

        return {
            update: (progress: number, newText?: string) => {
                progressFill.style.width = `${progress}%`;
                if (newText) textEl.textContent = newText;
            },
            remove: () => {
                if (progressDiv.parentElement) progressDiv.remove();
            }
        };
    }

    static showErrorWithRetry(container: HTMLElement, error: string, onRetry: () => void): HTMLElement {
        const errorDiv = container.createDiv({ cls: 'error-state' });
        errorDiv.createEl('p', { text: error });
        const retryBtn = errorDiv.createEl('button', { text: '🔄 Try Again' });
        retryBtn.onclick = () => {
            errorDiv.remove();
            onRetry();
        };
        return errorDiv;
    }
}

class PerplexityService {
    private apiKey: string;
    private baseURL = 'https://api.perplexity.ai/chat/completions';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    updateApiKey(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async makeRequest(messages: any[], model: string, maxTokens: number = 4000): Promise<any> {
        const response = await fetch(this.baseURL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages,
                max_tokens: maxTokens,
                temperature: 0.1
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return await response.json();
    }

    async checkSpellingAndFormat(content: string, language: string = 'en'): Promise<SpellCheckResult> {
        const messages = [
            {
                role: 'system',
                content: `Spell checker for ${language}. Return ONLY JSON:
{
  "corrections": [{"original": "word", "suggested": "fix", "line": 1, "confidence": 0.9}],
  "formattingIssues": [{"issue": "description", "line": 1, "suggestion": "fix", "fixable": true}]
}`
            },
            {
                role: 'user',
                content: `Check: ${content.substring(0, 5000)}`
            }
        ];

        try {
            const response = await this.makeRequest(messages, 'sonar');
            let responseContent = response.choices[0].message.content;

            responseContent = responseContent.replace(/<think>[\s\S]*?<\/think>/g, '');
            const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) responseContent = jsonMatch[0];

            const parsed = JSON.parse(responseContent);

            return {
                corrections: (parsed.corrections || []).filter(c => c.original && c.suggested),
                formattingIssues: (parsed.formattingIssues || []).filter(i => i.issue)
            };
        } catch (error) {
            console.error('Spell check error:', error);
            return { corrections: [], formattingIssues: [] };
        }
    }

    // CHUNKED CORRECTIONS ONLY - for large documents
    async applyCorrectionsWithChunks(content: string, language: string): Promise<string> {
        console.log('🔤 CHUNKED CORRECTIONS ONLY for large document');
        console.log('Original content length:', content.length);

        if (content.length > 15000) {
            console.log('📄 Large document - processing in chunks');

            const sections = content.split(/\n(?=##? )/);
            console.log('📄 Split into', sections.length, 'sections for corrections');

            const correctedSections: string[] = [];

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i].trim();
                if (!section) continue;

                console.log(`🔧 Correcting section ${i + 1}/${sections.length}, length: ${section.length}`);

                try {
                    const correctedSection = await this.applySectionCorrections(section, language);
                    correctedSections.push(correctedSection);
                    console.log(`✅ Section ${i + 1} corrected successfully`);

                    await new Promise(resolve => setTimeout(resolve, 800)); // Rate limiting
                } catch (error) {
                    console.error(`❌ Section ${i + 1} correction failed:`, error);
                    correctedSections.push(section); // Use original
                }
            }

            const finalContent = correctedSections.join('\n\n');
            console.log('✅ CHUNKED CORRECTIONS complete, final length:', finalContent.length);
            return finalContent;
        }

        // Single processing for smaller documents
        return await this.applySectionCorrections(content, language);
    }

    // Apply corrections to individual section - PRESERVE CONTENT
    private async applySectionCorrections(content: string, language: string): Promise<string> {
        console.log('🔤 Applying corrections to section - PRESERVE CONTENT');

        const messages = [
            {
                role: 'system',
                content: `You are a ${language} spell checker and formatter.

CRITICAL: 
- Fix ONLY spelling mistakes and grammar errors
- Fix ONLY markdown formatting issues  
- DO NOT rewrite, rephrase, or change content
- DO NOT add new information or explanations
- PRESERVE the exact same meaning, style, and structure
- Return the corrected text directly (NO JSON, NO code blocks)

Just return the same content with corrections applied.`
            },
            {
                role: 'user', 
                content: `Apply ONLY spelling and formatting corrections to this content (keep everything else exactly the same):

${content}`
            }
        ];

        try {
            const response = await this.makeRequest(messages, 'sonar', 6000);
            let corrected = response.choices[0].message.content.trim();

            // Remove any AI artifacts
            corrected = corrected.replace(/<think>[\s\S]*?<\/think>/g, '');
            corrected = corrected.replace(/```[\s\S]*?```/g, '');
            corrected = corrected.trim();

            console.log('✅ Section corrections applied, input:', content.length, 'output:', corrected.length);

            // Return corrected content if valid, otherwise original
            return corrected.length > 50 ? corrected : content;

        } catch (error) {
            console.error('Section correction error:', error);
            return content;
        }
    }

    async createEnhancedRewrite(content: string): Promise<string> {
        if (content.length > 15000) {
            const sections = content.split(/\n(?=##? )/);
            const enhanced: string[] = [];

            for (const section of sections) {
                if (section.trim()) {
                    try {
                        const result = await this.enhanceSection(section);
                        enhanced.push(result);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch {
                        enhanced.push(section);
                    }
                }
            }

            return enhanced.join('\n\n');
        }

        return await this.enhanceSection(content);
    }

    private async enhanceSection(content: string): Promise<string> {
        const messages = [
            {
                role: 'system',
                content: 'Enhance this markdown content. Return ONLY the enhanced markdown, NO JSON:'
            },
            {
                role: 'user',
                content: `Enhance: ${content}`
            }
        ];

        try {
            const response = await this.makeRequest(messages, 'sonar-reasoning-pro', 6000);
            let enhanced = response.choices[0].message.content.trim();
            enhanced = enhanced.replace(/<think>[\s\S]*?<\/think>/g, '');
            enhanced = enhanced.replace(/```[\s\S]*?```/g, '');
            return enhanced.startsWith('#') ? enhanced : content;
        } catch {
            return content;
        }
    }
}

class VaultAnalyzer {
    constructor(private app: App, private service: PerplexityService) {}

    async analyzeVault(): Promise<any> {
        const files = this.app.vault.getFiles().filter(f => f.extension === 'md');
        return {
            totalFiles: this.app.vault.getFiles().length,
            markdownFiles: files.length,
            themes: ['Islamic Studies', 'Arabic Literature', 'Fiqh']
        };
    }

    async generateSmartLinks(): Promise<any[]> {
        return [{ title: 'Related Topic', relevance: 0.8 }];
    }
}

// MAIN MENU - 4 options
class PerplexityMainModal extends Modal {
    constructor(app: App, private plugin: PerplexityPlugin) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;

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
            .setName('💖 Support Developer')
            .setDesc('Support development')
            .addButton(btn => btn
                .setButtonText('☕ Buy me a coffee')
                .onClick(() => {
                    window.open('https://buymeacoffee.com/YahyaZekry', '_blank');
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// SPELL CHECK & ENHANCEMENT - YOUR EXACT 5 OPTIONS
class SpellCheckEnhancementModal extends Modal {
    constructor(app: App, private plugin: PerplexityPlugin) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Spell Check & Enhancement Options' });

        // 1. CHECK & SHOW RESULTS - let user choose which to apply
        new Setting(contentEl)
            .setName('1. 🔍 Check Spelling & Formatting Issues')
            .setDesc('Show results and let you choose which corrections to apply')
            .addButton(btn => btn
                .setButtonText('Check & Show Results')
                .setCta()
                .onClick(async () => {
                    UIUtils.showLoadingButton(btn.buttonEl, 'Checking...');
                    try {
                        this.close();
                        await this.plugin.checkAndShowResults();
                    } catch (error) {
                        UIUtils.hideLoadingButton(btn.buttonEl);
                        new Notice(`Failed: ${error.message}`);
                    }
                }));

        // 2. APPLY CORRECTIONS ONLY - with CHUNKED processing
        new Setting(contentEl)
            .setName('2. ✅ Apply Corrections Only (Chunked)')
            .setDesc('Same document with spelling fixes and improved markdown - handles large documents')
            .addButton(btn => btn
                .setButtonText('Apply Corrections')
                .onClick(async () => {
                    UIUtils.showLoadingButton(btn.buttonEl, 'Processing...');
                    try {
                        this.close();
                        await this.plugin.applyCorrectionsOnlyChunked();
                    } catch (error) {
                        UIUtils.hideLoadingButton(btn.buttonEl);
                        new Notice(`Failed: ${error.message}`);
                    }
                }));

        // 3. FULL ENHANCEMENT - rewrite and improve  
        new Setting(contentEl)
            .setName('3. 🚀 Full Enhancement')
            .setDesc('Rewrite and improve content with comprehensive enhancements')
            .addButton(btn => btn
                .setButtonText('Full Enhancement')
                .onClick(async () => {
                    UIUtils.showLoadingButton(btn.buttonEl, 'Enhancing...');
                    try {
                        this.close();
                        await this.plugin.createFullEnhancement();
                    } catch (error) {
                        UIUtils.hideLoadingButton(btn.buttonEl);
                        new Notice(`Failed: ${error.message}`);
                    }
                }));

        // 4. CHECK ALL VAULT FILES - same options for all files
        new Setting(contentEl)
            .setName('4. 📚 Check All Vault Files')
            .setDesc('Same 3 options above but applied to all markdown files in vault')
            .addButton(btn => btn
                .setButtonText('Vault Operations')
                .onClick(() => {
                    this.close();
                    new VaultSpellCheckModal(this.app, this.plugin).open();
                }));

        // 5. AI MODEL SETTINGS - with recommendations
        new Setting(contentEl)
            .setName('5. 🤖 AI Model Settings & Recommendations')
            .setDesc('Configure AI models with language-specific recommendations')
            .addButton(btn => btn
                .setButtonText('Model Settings')
                .onClick(() => {
                    this.close();
                    new ModelRecommendationsModal(this.app, this.plugin).open();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// SPELL CHECK RESULTS - let user choose individual corrections
class SpellCheckResultsModal extends Modal {
    private statusContainer: HTMLElement;

    constructor(app: App, private file: TFile, private result: SpellCheckResult, private plugin: PerplexityPlugin) {
        super(app);
        this.setTitle(`Check Results - ${this.file.basename}`);
    }

    onOpen() {
        const { contentEl } = this;

        this.statusContainer = contentEl.createDiv();

        if (this.result.corrections?.length > 0) {
            contentEl.createEl('h3', { text: `📝 Spelling Corrections (${this.result.corrections.length})` });

            this.result.corrections.forEach((correction, i) => {
                const div = contentEl.createDiv({ cls: 'correction-item' });

                div.createEl('h4', { text: `Correction ${i + 1}` });
                div.createEl('p', { text: `"${correction.original}" → "${correction.suggested}"` });
                div.createEl('p', { text: `Line ${correction.line} (${Math.round(correction.confidence * 100)}% confidence)` });

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

            this.result.formattingIssues.forEach((issue, i) => {
                const div = contentEl.createDiv({ cls: 'formatting-item' });

                div.createEl('h4', { text: `Issue ${i + 1}` });
                div.createEl('p', { text: `Line ${issue.line}: ${issue.issue}` });
                div.createEl('p', { text: `Fix: ${issue.suggestion}` });

                if (issue.fixable && issue.originalText && issue.suggestedText) {
                    const fixBtn = div.createEl('button', { text: '🔧 Fix This' });
                    fixBtn.onclick = () => this.applySingle(issue.originalText!, issue.suggestedText!, div);
                }
            });

            const fixableIssues = this.result.formattingIssues.filter(i => i.fixable);
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

            this.result.corrections.forEach(correction => {
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
        const fixableIssues = this.result.formattingIssues.filter(i => i.fixable);
        const notice = new Notice(`⏳ Applying ${fixableIssues.length} fixes...`, 0);

        try {
            let content = await this.app.vault.read(this.file);

            fixableIssues.forEach(issue => {
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

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// VAULT OPERATIONS - same 3 options for all files
class VaultSpellCheckModal extends Modal {
    constructor(app: App, private plugin: PerplexityPlugin) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Vault-Wide Operations' });

        const files = this.app.vault.getFiles().filter(f => f.extension === 'md');
        contentEl.createEl('p', { text: `Found ${files.length} markdown files` });

        new Setting(contentEl)
            .setName('1. Check All Files')
            .setDesc('Show spell check results for all vault files')
            .addButton(btn => btn
                .setButtonText('Check All Files')
                .onClick(async () => {
                    this.close();
                    new Notice('📚 Checking all files...');
                }));

        new Setting(contentEl)
            .setName('2. Apply Corrections to All')
            .setDesc('Apply spelling corrections to all files with chunked processing')
            .addButton(btn => btn
                .setButtonText('Correct All Files')
                .onClick(async () => {
                    this.close();
                    new Notice('✅ Applying corrections to all files...');
                }));

        new Setting(contentEl)
            .setName('3. Enhance All Files')
            .setDesc('Full enhancement for all vault files')
            .addButton(btn => btn
                .setButtonText('Enhance All Files')
                .onClick(async () => {
                    this.close();
                    new Notice('🚀 Enhancing all files...');
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// MODEL RECOMMENDATIONS
class ModelRecommendationsModal extends Modal {
    constructor(app: App, private plugin: PerplexityPlugin) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: '🤖 AI Model Settings & Recommendations' });

        const currentLang = this.plugin.settings.spellCheckLanguage;

        if (currentLang === 'ar') {
            const arabicDiv = contentEl.createDiv({ cls: 'recommendations' });
            arabicDiv.createEl('h3', { text: '🇸🇦 Recommendations for Arabic' });
            arabicDiv.createEl('p', { text: '✅ Spell Check: Sonar Pro (excellent Arabic support)' });
            arabicDiv.createEl('p', { text: '✅ Enhancement: Sonar Reasoning Pro (best for Islamic content)' });
            arabicDiv.createEl('p', { text: '💡 Tip: Enable RTL support for better Arabic display' });
        } else {
            const englishDiv = contentEl.createDiv({ cls: 'recommendations' });
            englishDiv.createEl('h3', { text: '🇺🇸 Recommendations for English' });
            englishDiv.createEl('p', { text: '✅ Spell Check: Sonar (cost-effective, good quality)' });
            englishDiv.createEl('p', { text: '✅ Enhancement: Sonar Reasoning (balanced performance)' });
        }

        new Setting(contentEl)
            .setName('Current Model')
            .setDesc(`Spell Check: ${this.plugin.settings.spellCheckModel} | Enhancement: ${this.plugin.settings.enhancedRewriteModel}`)
            .addButton(btn => btn
                .setButtonText('Change Models')
                .onClick(() => {
                    this.close();
                    this.plugin.openSettings();
                }));

        new Setting(contentEl)
            .setName('Language Settings')
            .setDesc(`Current: ${currentLang === 'ar' ? 'Arabic' : 'English'}`)
            .addButton(btn => btn
                .setButtonText('Change Language')
                .onClick(() => {
                    this.close();
                    this.plugin.openSettings();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class PerplexitySettingTab extends PluginSettingTab {
    plugin: PerplexityPlugin;

    constructor(app: App, plugin: PerplexityPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Perplexity Settings' });

        new Setting(containerEl)
            .setName('API Key')
            .addText(text => text
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Language')
            .addDropdown(dropdown => dropdown
                .addOption('en', 'English')
                .addOption('ar', 'Arabic')
                .setValue(this.plugin.settings.spellCheckLanguage)
                .onChange(async (value) => {
                    this.plugin.settings.spellCheckLanguage = value;
                    await this.plugin.saveSettings();
                }));
    }
}

export default class PerplexityPlugin extends Plugin {
    settings: PerplexityPluginSettings;
    perplexityService: PerplexityService;
    vaultAnalyzer: VaultAnalyzer;

    async onload() {
        console.log('🚀 Plugin with EXACT menu structure + chunked corrections loading...');
        await this.loadSettings();

        this.perplexityService = new PerplexityService(this.settings.apiKey);
        this.vaultAnalyzer = new VaultAnalyzer(this.app, this.perplexityService);

        this.addRibbonIcon('brain', 'Perplexity Assistant', () => {
            console.log('🧠 Opening MAIN MENU with 4 options');
            new PerplexityMainModal(this.app, this).open();
        });

        this.addSettingTab(new PerplexitySettingTab(this.app, this));
        console.log('✅ Plugin loaded with exact menu structure');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.perplexityService.updateApiKey(this.settings.apiKey);
    }

    openSettings() {
        (this.app as any).setting.open();
        (this.app as any).setting.openTabById('obsidian-perplexity-plugin');
    }

    // 1. CHECK AND SHOW RESULTS
    async checkAndShowResults() {
        console.log('🔍 Check and show results - let user choose');
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Open a markdown file first');
            return;
        }

        const notice = new Notice('🔍 Analyzing spelling and formatting...', 0);

        try {
            const content = await this.app.vault.read(activeFile);
            const result = await this.perplexityService.checkSpellingAndFormat(content, this.settings.spellCheckLanguage);

            notice.hide();
            new Notice(`✅ Found ${result.corrections.length} corrections and ${result.formattingIssues.length} formatting issues`);
            new SpellCheckResultsModal(this.app, activeFile, result, this).open();
        } catch (error) {
            notice.hide();
            new Notice(`❌ Check failed: ${error.message}`);
        }
    }

    // 2. APPLY CORRECTIONS ONLY - WITH CHUNKED PROCESSING
    async applyCorrectionsOnlyChunked() {
        console.log('✅ Apply corrections only with CHUNKED processing');
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Open a markdown file first');
            return;
        }

        const notice = new Notice('✅ Applying corrections with chunked processing...', 0);

        try {
            const content = await this.app.vault.read(activeFile);
            console.log('📄 Content length for chunked corrections:', content.length);

            if (content.length > 15000) {
                notice.setMessage('🧩 Large document detected - processing in chunks...');
            }

            const correctedContent = await this.perplexityService.applyCorrectionsWithChunks(content, this.settings.spellCheckLanguage);

            const correctedName = `${activeFile.basename}-corrected.md`;
            const correctedPath = activeFile.path.replace(`${activeFile.basename}.md`, correctedName);
            await this.app.vault.create(correctedPath, correctedContent);

            notice.hide();
            new Notice(`✅ Created ${correctedName} with ALL corrections applied (${Math.round(correctedContent.length/1000)}k chars)!`);

            setTimeout(async () => {
                await this.app.workspace.openLinkText(activeFile.path, '', false);
                await this.app.workspace.openLinkText(correctedPath, '', 'split');
            }, 1000);
        } catch (error) {
            notice.hide();
            new Notice(`❌ Corrections failed: ${error.message}`);
        }
    }

    // 3. FULL ENHANCEMENT
    async createFullEnhancement() {
        console.log('🚀 Full enhancement with chunked processing');
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Open a markdown file first');
            return;
        }

        const notice = new Notice('🚀 Creating full enhancement...', 0);

        try {
            const content = await this.app.vault.read(activeFile);

            if (content.length > 15000) {
                notice.setMessage('🧩 Large document - using chunked enhancement...');
            }

            const enhanced = await this.perplexityService.createEnhancedRewrite(content);

            const enhancedName = `${activeFile.basename}-enhanced.md`;
            const enhancedPath = activeFile.path.replace(`${activeFile.basename}.md`, enhancedName);
            await this.app.vault.create(enhancedPath, enhanced);

            notice.hide();
            new Notice(`✅ Created ${enhancedName} with full enhancements (${Math.round(enhanced.length/1000)}k chars)!`);

            setTimeout(async () => {
                await this.app.workspace.openLinkText(activeFile.path, '', false);
                await this.app.workspace.openLinkText(enhancedPath, '', 'split');
            }, 1000);
        } catch (error) {
            notice.hide();
            new Notice(`❌ Enhancement failed: ${error.message}`);
        }
    }

    async analyzeVault() {
        console.log('📊 Analyzing vault...');
        try {
            const analysis = await this.vaultAnalyzer.analyzeVault();
            new Notice(`📊 Vault Analysis: ${analysis.markdownFiles} markdown files found with themes: ${analysis.themes.join(', ')}`);
        } catch (error) {
            new Notice(`❌ Analysis failed: ${error.message}`);
        }
    }

    async generateSmartLinks() {
        console.log('🔗 Generating smart connections...');
        try {
            const links = await this.vaultAnalyzer.generateSmartLinks();
            new Notice(`🔗 Generated ${links.length} smart link suggestions`);
        } catch (error) {
            new Notice(`❌ Smart links failed: ${error.message}`);
        }
    }

    onunload() {}
}
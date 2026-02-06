import { Modal, App, Setting, Notice, MarkdownView } from 'obsidian';
import PerplexityPlugin from '../../PerplexityPlugin';
import { SpellCheckStrategyFactory } from '../../services/SpellCheckStrategy';
import { SpellCheckResultsModal } from './SpellCheckResultsModal';

interface SpellCheckContext {
    settings?: any;
    onProgress?: (progress: number, message: string) => void;
    onSectionComplete?: (section: number, total: number, result: any) => void;
    onModeSwitchSuggestion?: (suggestedMode: string, reason: string) => void;
}

type SpellCheckMode = 'auto' | 'full' | 'incremental';

export class SpellCheckEnhancementModal extends Modal {
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
                settings: this.plugin.settings,
                onProgress: (progress: number, message: string) => {
                    notice.setMessage(`⏳ ${message} (${progress}%)`);
                },
                onModeSwitchSuggestion: (mode: string, reason: string) => {
                    new Notice(`💡 Suggestion: Switch to ${mode} mode - ${reason}`);
                }
            };

            const strategy = SpellCheckStrategyFactory.createStrategy(
                this.plugin.settings.spellCheckMode,
                this.plugin.perplexityService,
                this.plugin.settings
            );

            const result = await strategy.check(content, this.plugin.settings.spellCheckLanguage, context);

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
            const enhanced = await this.plugin.perplexityService.createEnhancedRewrite(content, this.plugin.settings.spellCheckLanguage);

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

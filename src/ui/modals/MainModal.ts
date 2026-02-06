import { Modal, App, Setting } from 'obsidian';
import PerplexityPlugin from '../../PerplexityPlugin';
import { SpellCheckEnhancementModal } from './SpellCheckModal';
import { HelpModal } from './HelpModal';

export class PerplexityMainModal extends Modal {
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

import { PluginSettingTab, Setting, App, Plugin } from 'obsidian';
import PerplexityPlugin from '../PerplexityPlugin';
import { SpellCheckMode } from '../types';

export class PerplexitySettingTab extends PluginSettingTab {
    plugin: PerplexityPlugin;

    constructor(app: App, plugin: Plugin) {
        super(app, plugin as PerplexityPlugin);
        this.plugin = plugin as PerplexityPlugin;
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

        new Setting(containerEl)
            .setName('Spell Check Mode')
            .setDesc('How to check spelling in long documents')
            .addDropdown(dropdown => dropdown
                .addOption('auto', '🤖 Auto (Smart)')
                .addOption('full', '✅ Full (Complete Coverage)')
                .addOption('incremental', '💰 Incremental (Cost-Safe)')
                .setValue(this.plugin.settings.spellCheckMode)
                .onChange(async (value) => {
                    this.plugin.settings.spellCheckMode = value as SpellCheckMode;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('hr');

        new Setting(containerEl)
            .setName('Full Mode Chunk Size')
            .setDesc('Characters per chunk when checking long documents')
            .addSlider(slider => slider
                .setLimits(2000, 10000, 1000)
                .setValue(this.plugin.settings.fullModeChunkSize)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.fullModeChunkSize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto Mode Error Threshold')
            .setDesc('Errors per 1000 characters that trigger full check suggestion')
            .addSlider(slider => slider
                .setLimits(1, 10, 0.5)
                .setValue(this.plugin.settings.autoModeThreshold)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.autoModeThreshold = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('hr');

        new Setting(containerEl)
            .setName('Incremental Mode Section Size')
            .setDesc('Characters per section in incremental mode')
            .addSlider(slider => slider
                .setLimits(2000, 8000, 1000)
                .setValue(this.plugin.settings.incrementalModeSectionSize)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.incrementalModeSectionSize = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('hr');

        new Setting(containerEl)
            .setName('Smart Linking Mode')
            .setDesc('Analysis mode for generating smart links')
            .addDropdown(dropdown => dropdown
                .addOption('current', 'Current File')
                .addOption('all', 'All Files')
                .setValue(this.plugin.settings.smartLinkingMode)
                .onChange(async (value) => {
                    this.plugin.settings.smartLinkingMode = value as 'current' | 'all';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('RTL Support')
            .setDesc('Right-to-left text direction for Arabic and other RTL languages')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rtlSupport)
                .onChange(async (value) => {
                    this.plugin.settings.rtlSupport = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('hr');

        new Setting(containerEl)
            .setName('Enable Caching')
            .setDesc('Cache API responses to reduce costs')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.cacheEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.cacheEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto Format')
            .setDesc('Automatically apply formatting fixes when spell checking')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoFormat)
                .onChange(async (value) => {
                    this.plugin.settings.autoFormat = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('hr');

        new Setting(containerEl)
            .setName('Excluded Extensions')
            .setDesc('File types to exclude from analysis (comma-separated)')
            .addText(text => text
                .setValue(this.plugin.settings.excludedExtensions.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.excludedExtensions = value.split(',').map(e => e.trim());
                    await this.plugin.saveSettings();
                }));
    }
}

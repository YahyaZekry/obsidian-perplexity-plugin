import { Modal, App, Notice, MarkdownView, TFile } from 'obsidian';

export class SmartLinksModal extends Modal {
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

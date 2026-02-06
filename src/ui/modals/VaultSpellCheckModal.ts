import { Modal, App } from 'obsidian';

export class VaultAnalysisModal extends Modal {
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

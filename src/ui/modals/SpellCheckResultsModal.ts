import { Modal, App, Notice, TFile, MarkdownView } from 'obsidian';
import PerplexityPlugin from '../../PerplexityPlugin';

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

export class SpellCheckResultsModal extends Modal {
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
                const correctionText = div.createEl('p');
                correctionText.textContent = `"${correction.original}" → "${correction.suggested}"`;
                if (isRTL) {
                    correctionText.addClass('rtl-text');
                }
                
                const lineText = div.createEl('p');
                lineText.textContent = `Line ${correction.line} (${Math.round(correction.confidence * 100)}% confidence)`;
                if (isRTL) {
                    lineText.addClass('rtl-text');
                }

                const context = correction.context || 'No context available';
                const contextDiv = div.createDiv({ cls: 'error-context' });
                if (isRTL) {
                    contextDiv.addClass('rtl-content');
                }
                contextDiv.createEl('strong', { text: '📄 Context:' });
                const contextText = contextDiv.createEl('p', { cls: 'context-text' });
                
                try {
                    const highlightedContext = context.replace(
                        new RegExp(`(${correction.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
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
                
                const issueText = div.createEl('p');
                issueText.textContent = `Line ${issue.line}: ${issue.issue}`;
                if (isRTL) {
                    issueText.addClass('rtl-text');
                }
                
                const fixText = div.createEl('p');
                fixText.textContent = `Fix: ${issue.suggestion}`;
                if (isRTL) {
                    fixText.addClass('rtl-text');
                }

                if (issue.originalText && issue.suggestedText) {
                    const contextDiv = div.createDiv({ cls: 'error-context' });
                    if (isRTL) {
                        contextDiv.addClass('rtl-content');
                    }
                    contextDiv.createEl('strong', { text: '📄 Context:' });
                    const contextText = contextDiv.createEl('p', { cls: 'context-text' });
                    
                    try {
                        const highlightedContext = issue.originalText.replace(
                            new RegExp(`(${issue.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
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
            // Replace all occurrences
            const regex = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            const newContent = content.replace(regex, suggested);
            await this.app.vault.modify(this.file, newContent);

            div.style.opacity = '0.5';
            new Notice(`✅ Applied: ${original.substring(0, 30)}...`);
        } catch (error) {
            console.error('Apply single correction error:', error);
            new Notice(`❌ Failed: ${error.message}`);
        }
    }

    private async applyAllCorrections() {
        const notice = new Notice('⏳ Applying all corrections...', 0);
        try {
            let content = await this.app.vault.read(this.file);
            this.result.corrections.forEach((correction: any) => {
                const regex = new RegExp(correction.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                content = content.replace(regex, correction.suggested);
            });
            await this.app.vault.modify(this.file, content);
            notice.hide();
            new Notice(`✅ Applied ${this.result.corrections.length} corrections!`);
            this.close();
        } catch (error) {
            console.error('Apply all corrections error:', error);
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
                    const regex = new RegExp(issue.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    content = content.replace(regex, issue.suggestedText);
                }
            });
            await this.app.vault.modify(this.file, content);
            notice.hide();
            new Notice(`✅ Applied ${fixableIssues.length} formatting fixes!`);
            this.close();
        } catch (error) {
            console.error('Apply all fixes error:', error);
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

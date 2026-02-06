import { App, Notice, TFile } from 'obsidian';

export class UIUtils {
    static showNotice(message: string, duration: number = 3000): Notice {
        return new Notice(message, duration);
    }

    static showErrorNotice(message: string, duration: number = 5000): Notice {
        return new Notice(`❌ ${message}`, duration);
    }

    static showSuccessNotice(message: string, duration: number = 3000): Notice {
        return new Notice(`✅ ${message}`, duration);
    }

    static showLoadingNotice(message: string): Notice {
        return new Notice(`⏳ ${message}`, 0);
    }

    static hideNotice(notice: Notice): void {
        notice.hide();
    }

    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    static formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    }

    static isValidMarkdownFile(file: TFile): boolean {
        return file && file.extension === 'md';
    }

    static getFileNameWithoutExtension(file: TFile): string {
        return file.basename;
    }
}

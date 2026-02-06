import { TFile } from 'obsidian';
import { PerplexityPluginSettings } from '../types';

export class FileFilter {
    private settings: PerplexityPluginSettings;

    constructor(settings: PerplexityPluginSettings) {
        this.settings = settings;
    }

    /**
     * Check if a file should be excluded based on its extension
     * @param file - The file to check
     * @returns true if the file should be excluded
     */
    isExcluded(file: TFile): boolean {
        // Check file extension against excluded extensions list
        const fileExtension = file.extension.toLowerCase();
        return this.settings.excludedExtensions.includes(fileExtension);
    }

    /**
     * Filter files into included and excluded categories
     * @param files - Array of files to filter
     * @returns Object with included files, excluded files, and breakdown by extension
     */
    filterFiles(files: TFile[]): { included: TFile[]; excluded: TFile[]; breakdown: Record<string, number> } {
        const included: TFile[] = [];
        const excluded: TFile[] = [];
        const breakdown: Record<string, number> = {};

        files.forEach(file => {
            const ext = file.extension.toLowerCase();
            
            // Update breakdown
            if (!breakdown[ext]) {
                breakdown[ext] = 0;
            }
            breakdown[ext]++;

            // Check if file should be excluded
            if (this.isExcluded(file)) {
                excluded.push(file);
            } else {
                included.push(file);
            }
        });

        return { included, excluded, breakdown };
    }
}

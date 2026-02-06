import { TFile } from 'obsidian';

export interface FileFilter {
    shouldIncludeFile(file: TFile, excludedExtensions: string[]): boolean;
    filterFiles(files: TFile[], excludedExtensions: string[]): TFile[];
}

import { App, TFile } from 'obsidian';

export interface SafeFileWriter {
    writeFile(app: App, file: TFile, content: string): Promise<void>;
    createFile(app: App, path: string, content: string): Promise<TFile>;
}

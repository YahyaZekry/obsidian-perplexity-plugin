import { SpellCheckResult, SpellCheckMode, PerplexityPluginSettings, SpellCheckContext } from '../types';

export interface SpellCheckStrategy {
    check(content: string, language: string, context: SpellCheckContext): Promise<SpellCheckResult>;
    supportsIncremental(): boolean;
    canSwitchTo(mode: SpellCheckMode): boolean;
    getName(): string;
    getEstimatedCost(contentLength: number): number;
}

export class FullChunkedStrategy implements SpellCheckStrategy {
    constructor(private service: any) {}

    async check(content: string, language: string, context: SpellCheckContext): Promise<SpellCheckResult> {
        const settings = context.settings;
        const chunkSize = settings?.fullModeChunkSize || 4000;
        const showProgress = settings?.fullModeShowProgress !== false;

        if (content.length <= chunkSize) {
            return await this.service.checkSpellingAndFormat(content, language);
        }

        const sections = this.splitByHeaders(content, chunkSize);
        const results: SpellCheckResult = {
            corrections: [],
            formattingIssues: []
        };

        let lineOffset = 0;

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];

            if (showProgress && context.onProgress) {
                const progress = Math.round(((i + 1) / sections.length) * 100);
                context.onProgress(progress, `Checking section ${i + 1} of ${sections.length}`);
            }

            try {
                const sectionResult = await this.service.checkSpellingAndFormat(section, language);
                
                const adjustedCorrections = sectionResult.corrections.map((c: any) => ({
                    ...c,
                    line: c.line + lineOffset
                }));
                const adjustedIssues = sectionResult.formattingIssues.map((i: any) => ({
                    ...i,
                    line: i.line + lineOffset
                }));

                results.corrections.push(...adjustedCorrections);
                results.formattingIssues.push(...adjustedIssues);

                if (context.onSectionComplete) {
                    context.onSectionComplete(i + 1, sections.length, {
                        corrections: adjustedCorrections,
                        formattingIssues: adjustedIssues
                    });
                }

                lineOffset += section.split('\n').length;

                if (i < sections.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            } catch (error) {
                console.error(`Error checking section ${i + 1}:`, error);
            }
        }

        return results;
    }

    supportsIncremental(): boolean {
        return false;
    }

    canSwitchTo(mode: SpellCheckMode): boolean {
        return mode === 'incremental';
    }

    getName(): string {
        return 'Full (Complete Coverage)';
    }

    getEstimatedCost(contentLength: number): number {
        const chunkSize = 4000;
        const chunks = Math.ceil(contentLength / chunkSize);
        return chunks;
    }

    private splitByHeaders(content: string, chunkSize: number): string[] {
        const headerSplit = content.split(/\n(?=##? )/);
        const sections: string[] = [];
        let currentSection = '';

        for (const piece of headerSplit) {
            if (currentSection.length + piece.length > chunkSize && currentSection) {
                sections.push(currentSection.trim());
                currentSection = piece;
            } else {
                currentSection += (currentSection ? '\n\n' : '') + piece;
            }
        }

        if (currentSection) {
            sections.push(currentSection.trim());
        }

        return sections;
    }
}

export class IncrementalStrategy implements SpellCheckStrategy {
    private sectionSize: number;
    private currentSection: number = 0;
    private totalSections: number = 0;
    private allResults: SpellCheckResult | null = null;
    private originalContent: string;

    constructor(private service: any, settings: PerplexityPluginSettings) {
        this.sectionSize = settings.incrementalModeSectionSize || 5000;
    }

    async check(content: string, language: string, context: SpellCheckContext): Promise<SpellCheckResult> {
        this.originalContent = content;
        this.currentSection = 0;
        this.totalSections = Math.ceil(content.length / this.sectionSize);
        this.allResults = {
            corrections: [],
            formattingIssues: []
        };

        return await this.checkNextSection(content, language, context);
    }

    async checkNextSection(content: string, language: string, context: SpellCheckContext): Promise<SpellCheckResult> {
        if (this.currentSection >= this.totalSections) {
            return this.allResults!;
        }

        const startPos = this.currentSection * this.sectionSize;
        const endPos = Math.min(startPos + this.sectionSize, content.length);
        const sectionContent = content.substring(startPos, endPos);

        if (context.onProgress) {
            const progress = Math.round(((this.currentSection + 1) / this.totalSections) * 100);
            const sectionLabel = this.currentSection === 0 ? 'first' : 'next';
            context.onProgress(progress, `Checking ${sectionLabel} section`);
        }

        try {
            const sectionResult = await this.service.checkSpellingAndFormat(sectionContent, language);
            
            const lineOffset = content.substring(0, startPos).split('\n').length;
            const adjustedCorrections = sectionResult.corrections.map((c: any) => ({
                ...c,
                line: c.line + lineOffset
            }));
            const adjustedIssues = sectionResult.formattingIssues.map((i: any) => ({
                ...i,
                line: i.line + lineOffset
            }));

            this.allResults!.corrections.push(...adjustedCorrections);
            this.allResults!.formattingIssues.push(...adjustedIssues);

            this.currentSection++;

            if (context.onSectionComplete) {
                context.onSectionComplete(this.currentSection, this.totalSections, {
                    corrections: adjustedCorrections,
                    formattingIssues: adjustedIssues
                });
            }

            return {
                corrections: adjustedCorrections,
                formattingIssues: adjustedIssues
            };
        } catch (error) {
            console.error('Incremental section check error:', error);
            return { corrections: [], formattingIssues: [] };
        }
    }

    hasMoreSections(): boolean {
        return this.currentSection < this.totalSections;
    }

    getCurrentSectionNumber(): number {
        return this.currentSection;
    }

    getTotalSections(): number {
        return this.totalSections;
    }

    getAllResults(): SpellCheckResult {
        return this.allResults || { corrections: [], formattingIssues: [] };
    }

    supportsIncremental(): boolean {
        return true;
    }

    canSwitchTo(mode: SpellCheckMode): boolean {
        return mode === 'full';
    }

    getName(): string {
        return 'Incremental (Cost-Safe)';
    }

    getEstimatedCost(contentLength: number): number {
        return 1;
    }
}

export class AutoStrategy implements SpellCheckStrategy {
    private fullStrategy: FullChunkedStrategy;
    private threshold: number;

    constructor(private service: any, settings: PerplexityPluginSettings) {
        this.fullStrategy = new FullChunkedStrategy(service);
        this.threshold = settings.autoModeThreshold || 3;
    }

    async check(content: string, language: string, context: SpellCheckContext): Promise<SpellCheckResult> {
        const firstSectionSize = 5000;
        const firstSection = content.substring(0, Math.min(firstSectionSize, content.length));

        if (context.onProgress) {
            context.onProgress(10, 'Analyzing document quality...');
        }

        const firstResult = await this.service.checkSpellingAndFormat(firstSection, language);
        
        const errorCount = firstResult.corrections.length + firstResult.formattingIssues.length;
        const sectionLength = firstSection.length / 1000;
        const errorDensity = errorCount / sectionLength;

        const shouldRunFull = errorDensity >= this.threshold;

        if (shouldRunFull && context.onModeSwitchSuggestion) {
            const suggestionReason = `Found ${errorCount} errors in first ${Math.round(sectionLength)}k characters (${errorDensity.toFixed(1)} errors/k). Threshold is ${this.threshold} errors/k.`;
            context.onModeSwitchSuggestion('full', suggestionReason);
        }

        if (content.length <= firstSectionSize) {
            return firstResult;
        }

        if (shouldRunFull) {
            if (context.onProgress) {
                context.onProgress(100, 'High error density detected - suggestion shown');
            }
            return firstResult;
        } else {
            if (context.onProgress) {
                context.onProgress(100, 'Document quality is good - first section checked');
            }
            return firstResult;
        }
    }

    supportsIncremental(): boolean {
        return false;
    }

    canSwitchTo(mode: SpellCheckMode): boolean {
        return mode === 'full';
    }

    getName(): string {
        return 'Auto (Smart)';
    }

    getEstimatedCost(contentLength: number): number {
        return 1;
    }
}

export class SpellCheckStrategyFactory {
    static createStrategy(
        mode: SpellCheckMode,
        service: any,
        settings: PerplexityPluginSettings
    ): SpellCheckStrategy {
        switch (mode) {
            case 'full':
                return new FullChunkedStrategy(service);
            case 'incremental':
                return new IncrementalStrategy(service, settings);
            case 'auto':
                return new AutoStrategy(service, settings);
            default:
                throw new Error(`Unknown spell check mode: ${mode}`);
        }
    }
}

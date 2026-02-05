import { App, TFile } from 'obsidian';
import { VaultAnalysisResult, SmartLinkSuggestion } from '../types';
import { CacheManager } from './CacheManager';

export class VaultAnalyzer {
    constructor(
        private app: App,
        private cacheManager: CacheManager
    ) {}

    async analyzeVault(): Promise<VaultAnalysisResult> {
        const allFiles = this.app.vault.getFiles();
        const markdownFiles = allFiles.filter(f => f.extension === 'md');
        
        const themes = new Set<string>();
        const fileTypes: Record<string, number> = {};

        allFiles.forEach(file => {
            const ext = file.extension || 'no-ext';
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        });

        const chunkSize = 100;
        const chunks = this.chunkFiles(markdownFiles, chunkSize);
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const content = chunk.map(f => f.basename).join('\n');
            
            const cacheKey = `vault-analysis-chunk-${i}`;
            const cachedResult = await this.cacheManager.get(cacheKey, 24 * 60 * 60 * 1000);
            
            let chunkThemes: string[] = [];
            
            if (cachedResult) {
                chunkThemes = cachedResult;
                console.log(`✅ Using cached themes for chunk ${i + 1}`);
            } else {
                try {
                    chunkThemes = await this.analyzeChunkWithAPI(content);
                    await this.cacheManager.set(cacheKey, chunkThemes, 24 * 60 * 60 * 1000);
                    console.log(`✅ Analyzed chunk ${i + 1}/${chunks.length}`);
                } catch (error) {
                    console.error(`❌ Failed to analyze chunk ${i + 1}:`, error);
                }
            }
            
            chunkThemes.forEach(t => themes.add(t));
            
            if (i > 0 && i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return {
            totalFiles: allFiles.length,
            markdownFiles: markdownFiles.length,
            themes: Array.from(themes),
            fileTypes
        };
    }

    private async analyzeChunkWithAPI(fileContents: string): Promise<string[]> {
        const cacheKey = `analysis:${this.simpleHash(fileContents)}`;

        try {
            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getApiKey()}`
                },
                body: JSON.stringify({
                    model: 'sonar',
                    messages: [
                        {
                            role: 'system',
                            content: `Analyze these markdown file names and identify the main themes and topics present. Return ONLY a JSON array of theme strings.

Example output: ["Machine Learning", "Neural Networks", "Data Science"]

Focus on identifying:
- Subject areas and domains
- Technologies and frameworks
- Concepts and methodologies
- Content types (tutorial, reference, notes)

Return ONLY the JSON array, no explanations.`
                        },
                        {
                            role: 'user',
                            content: `Analyze these files and identify themes:\n${fileContents}`
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.3
                })
            });

            const data = await response.json();
            let apiContent = data.choices[0].message.content;
            
            apiContent = apiContent.replace(/```[\s\S]*?```/g, '');
            
            const jsonMatch = apiContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            const arrayMatch = apiContent.match(/\[[^\]]*\]/);
            if (arrayMatch) {
                return JSON.parse(arrayMatch[0]);
            }

            return [];
        } catch (error) {
            console.error('Vault analysis API error:', error);
            return [];
        }
    }

    private chunkFiles(files: TFile[], size: number): TFile[][] {
        const chunks: TFile[][] = [];
        
        for (let i = 0; i < files.length; i += size) {
            chunks.push(files.slice(i, i + size));
        }
        
        return chunks;
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    private getApiKey(): string {
        const plugin = (this.app as any).plugins.plugins['obsidian-perplexity-plugin'];
        return plugin?.settings?.apiKey || '';
    }

    async generateSmartLinks(mode: 'current' | 'all'): Promise<SmartLinkSuggestion[]> {
        const activeFile = this.app.workspace.getActiveFile();
        
        if (!activeFile) {
            return [];
        }

        const files = this.app.vault.getFiles()
            .filter(f => f.extension === 'md')
            .filter(f => f.path !== activeFile.path);

        let filesToAnalyze = files;
        
        if (mode === 'current') {
            filesToAnalyze = files.slice(0, 20);
        }

        const suggestions: SmartLinkSuggestion[] = [];
        
        for (const file of filesToAnalyze) {
            const cacheKey = `smart-link:${activeFile.path}:${file.path}`;
            const cached = await this.cacheManager.get(cacheKey, 24 * 60 * 60 * 1000);
            
            if (cached) {
                suggestions.push(cached);
            } else {
                const suggestion = await this.compareFiles(activeFile, file);
                if (suggestion) {
                    suggestions.push(suggestion);
                    await this.cacheManager.set(cacheKey, suggestion, 24 * 60 * 60 * 1000);
                }
            }
        }

        return suggestions.sort((a, b) => b.relevance - a.relevance).slice(0, 20);
    }

    private async compareFiles(fileA: TFile, fileB: TFile): Promise<SmartLinkSuggestion | null> {
        try {
            const contentA = await this.app.vault.read(fileA);
            const contentB = await this.app.vault.read(fileB);
            
            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getApiKey()}`
                },
                body: JSON.stringify({
                    model: 'sonar-medium-online',
                    messages: [
                        {
                            role: 'system',
                            content: `Compare two markdown files and determine if they should be linked. Return ONLY JSON:

{
  "shouldLink": true/false,
  "relevance": 0.0-1.0,
  "connectionType": "conceptual|sequential|complementary|reference",
  "reasoning": "brief explanation",
  "commonThemes": ["theme1", "theme2"],
  "contentPreview": "first 200 chars of target file"
}

Consider:
- Shared topics or themes
- Sequential relationship (one builds on the other)
- Complementary information
- Cross-references

Return ONLY the JSON object.`
                        },
                        {
                            role: 'user',
                            content: `Compare these files:

File A (${fileA.basename}):
${contentA.substring(0, 3000)}

File B (${fileB.basename}):
${contentB.substring(0, 3000)}`
                        }
                    ],
                    max_tokens: 1500,
                    temperature: 0.2
                })
            });

            const data = await response.json();
            let content = data.choices[0].message.content;
            
            content = content.replace(/```[\s\S]*?```/g, '');
            content = content.replace(/[\s\S]*?<\/think>/g, '');
            
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                
                if (result.shouldLink && result.relevance > 0.3) {
                    return {
                        title: fileB.basename,
                        path: fileB.path,
                        relevance: result.relevance,
                        connectionType: result.connectionType,
                        reasoning: result.reasoning,
                        commonThemes: result.commonThemes || [],
                        contentPreview: result.contentPreview || contentB.substring(0, 200)
                    };
                }
            }

            return null;
        } catch (error) {
            console.error(`Failed to compare ${fileA.basename} with ${fileB.basename}:`, error);
            return null;
        }
    }
}

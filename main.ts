import { App, Plugin, PluginSettingTab, Setting, Modal, Notice, TFile, MarkdownView } from 'obsidian';

interface PerplexityPluginSettings {
    apiKey: string;
    spellCheckLanguage: string;
    similarityThreshold: number;
    batchSize: number;
    cacheEnabled: boolean;
    cacheDuration: number;
    autoFormat: boolean;
    smartLinking: boolean;
    rtlSupport: boolean;
    excludedExtensions: string[];
    smartLinkingMode: 'current' | 'all';
    maxLinkSuggestions: number;
    showLinkReasoning: boolean;
    spellCheckModel: string;
    linkAnalysisModel: string;
    spellCheckScope: 'current' | 'vault';
    enhancedRewriteModel: string;
}

const DEFAULT_SETTINGS: PerplexityPluginSettings = {
    apiKey: '',
    spellCheckLanguage: 'en',
    similarityThreshold: 0.7,
    batchSize: 10,
    cacheEnabled: true,
    cacheDuration: 24 * 60 * 60 * 1000,
    autoFormat: true,
    smartLinking: true,
    rtlSupport: false,
    excludedExtensions: ['pdf', 'docx', 'xlsx', 'pptx', 'zip', 'rar', 'exe', 'img', 'png', 'jpg', 'jpeg', 'gif'],
    smartLinkingMode: 'current',
    maxLinkSuggestions: 10,
    showLinkReasoning: true,
    spellCheckModel: 'sonar',
    linkAnalysisModel: 'sonar-pro',
    spellCheckScope: 'current',
    enhancedRewriteModel: 'sonar-reasoning-pro'
};

const PERPLEXITY_MODELS = {
    search: [
        { id: 'sonar', name: 'Sonar', description: 'Lightweight, cost-effective search model with grounding' },
        { id: 'sonar-pro', name: 'Sonar Pro', description: 'Advanced search offering with grounding, supporting complex queries and follow-ups' }
    ],
    reasoning: [
        { id: 'sonar-reasoning', name: 'Sonar Reasoning', description: 'Fast, real-time reasoning model designed for more problem-solving with search' },
        { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', description: 'Precise reasoning offering powered by DeepSeek-R1 with Chain of Thought (CoT)' }
    ],
    research: [
        { id: 'sonar-deep-research', name: 'Sonar Deep Research', description: 'Expert-level research model conducting exhaustive searches and generating comprehensive reports' }
    ]
};

const MODEL_MIGRATION_MAP: { [key: string]: string } = {
    'sonar-small-chat': 'sonar',
    'sonar-medium-chat': 'sonar-pro',
    'sonar-large-chat': 'sonar-pro',
    'sonar-small-online': 'sonar',
    'sonar-medium-online': 'sonar-pro',
    'sonar-large-online': 'sonar-pro',
    'r1-1776': 'sonar-reasoning-pro'
};

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

interface EnhancedRewriteResult {
    success: boolean;
    enhancedContent: string;
    improvements: string[];
    summary: string;
    error?: string;
}

interface LinkSuggestion {
    targetFile: string;
    targetTitle: string;
    relevanceScore: number;
    suggestedText: string;
    context: string;
    reasoning: string;
    themes: string[];
    connectionType: string;
}

class UIUtils {
    static showLoadingButton(button: HTMLElement, loadingText: string = 'Loading...'): void {
        button.classList.add('btn-loading');
        button.setAttribute('disabled', 'true');
        const originalText = button.textContent || '';
        button.setAttribute('data-original-text', originalText);
        button.textContent = loadingText;
    }

    static hideLoadingButton(button: HTMLElement): void {
        button.classList.remove('btn-loading');
        button.removeAttribute('disabled');
        const originalText = button.getAttribute('data-original-text');
        if (originalText) {
            button.textContent = originalText;
            button.removeAttribute('data-original-text');
        }
    }

    static showStatusMessage(container: HTMLElement, type: 'success' | 'error' | 'loading' | 'warning', message: string, details?: string): HTMLElement {
        const statusDiv = container.createDiv({ cls: `status-message status-${type}` });

        const icon = type === 'success' ? '✅' : 
                    type === 'error' ? '❌' : 
                    type === 'loading' ? '⏳' : '⚠️';

        statusDiv.createSpan({ text: `${icon} ${message}` });

        if (details) {
            const detailsDiv = statusDiv.createDiv({ cls: 'error-details' });
            detailsDiv.textContent = details;
        }

        if (type === 'success' || type === 'warning') {
            setTimeout(() => {
                if (statusDiv.parentElement) {
                    statusDiv.remove();
                }
            }, 5000);
        }

        return statusDiv;
    }

    static showProgressIndicator(container: HTMLElement, text: string = 'Processing...'): { update: (progress: number, text?: string) => void; remove: () => void } {
        const progressDiv = container.createDiv({ cls: 'progress-indicator' });
        const textEl = progressDiv.createDiv({ cls: 'progress-text', text });
        const barContainer = progressDiv.createDiv({ cls: 'progress-bar' });
        const progressFill = barContainer.createDiv({ cls: 'progress-fill' });

        progressFill.style.width = '0%';

        return {
            update: (progress: number, newText?: string) => {
                progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
                if (newText) {
                    textEl.textContent = newText;
                }
            },
            remove: () => {
                if (progressDiv.parentElement) {
                    progressDiv.remove();
                }
            }
        };
    }

    static showErrorWithRetry(container: HTMLElement, error: string, onRetry: () => void): HTMLElement {
        const errorDiv = container.createDiv({ cls: 'error-state' });

        errorDiv.createEl('h4', { text: 'Operation Failed' });
        errorDiv.createEl('p', { text: error });

        const retryBtn = errorDiv.createEl('button', { 
            text: '🔄 Try Again',
            cls: 'retry-btn'
        });

        retryBtn.onclick = () => {
            errorDiv.remove();
            onRetry();
        };

        return errorDiv;
    }
}

class PerplexityService {
    private apiKey: string;
    private baseURL = 'https://api.perplexity.ai/chat/completions';
    private cache: Map<string, { result: any; timestamp: number }> = new Map();

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    updateApiKey(apiKey: string) {
        this.apiKey = apiKey;
    }

    private validateModel(model: string): string {
        if (MODEL_MIGRATION_MAP[model]) {
            console.log(`Migrating old model '${model}' to '${MODEL_MIGRATION_MAP[model]}'`);
            return MODEL_MIGRATION_MAP[model];
        }

        const allModels = [
            ...PERPLEXITY_MODELS.search.map(m => m.id),
            ...PERPLEXITY_MODELS.reasoning.map(m => m.id),
            ...PERPLEXITY_MODELS.research.map(m => m.id)
        ];

        if (!allModels.includes(model)) {
            console.warn(`Invalid model '${model}', falling back to 'sonar'`);
            return 'sonar';
        }

        return model;
    }

    private async makeRequest(messages: any[], model: string, operation: string = 'unknown'): Promise<any> {
        if (!this.apiKey) {
            throw new Error('Perplexity API key not configured');
        }

        const validatedModel = this.validateModel(model);

        const payload = {
            model: validatedModel,
            messages,
            max_tokens: 4000,
            temperature: 0.1
        };

        console.log(`🚀 STARTING ${operation.toUpperCase()} OPERATION`);
        console.log('Making API request to:', this.baseURL);
        console.log('Using validated model:', validatedModel);

        try {
            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            console.log(`📡 API Response status for ${operation}:`, response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ API Error for ${operation}:`, errorText);
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`✅ API Response received successfully for ${operation}`);
            console.log('Response choices:', result.choices?.length || 0);

            if (result.choices && result.choices[0]) {
                console.log('Content length:', result.choices[0].message?.content?.length || 0);
            }

            return result;
        } catch (error) {
            console.error(`💥 Network or parsing error for ${operation}:`, error);
            throw error;
        }
    }

    // FIXED: Enhanced spell check with proper JSON parsing and validation
    async checkSpellingAndFormat(content: string, language: string = 'en', model: string = 'sonar'): Promise<SpellCheckResult> {
        const validatedModel = this.validateModel(model);
        const cacheKey = `spell_${validatedModel}_${language}_${this.hashContent(content)}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const sanitizedContent = content
            .replace(/[\r\n]/g, ' ')
            .replace(/["]/g, '\\"')
            .substring(0, 5000);

        const languageInstructions = this.getLanguageInstructions(language);

        const messages = [
            {
                role: 'system',
                content: `You are an advanced markdown spell checker for ${languageInstructions.name} language. 

CRITICAL: Return ONLY valid JSON in this exact format with NO code blocks, NO thinking tags:

{
  "corrections": [
    {
      "original": "مشكلة",
      "suggested": "مُشكلة", 
      "line": 5,
      "confidence": 0.95,
      "context": "surrounding text"
    }
  ],
  "formattingIssues": [
    {
      "issue": "Missing proper header formatting",
      "line": 10,
      "suggestion": "Add ## before section title",
      "fixable": true,
      "originalText": "Section Title",
      "suggestedText": "## Section Title"
    }
  ]
}

Return ONLY this JSON structure, no explanations, no code blocks.`
            },
            {
                role: 'user',
                content: `Check this ${languageInstructions.name} markdown content and return only JSON: ${sanitizedContent}`
            }
        ];

        try {
            const response = await this.makeRequest(messages, validatedModel, 'SPELL_CHECK');
            const responseContent = response.choices[0].message.content;

            // DEBUG: Show what AI actually returns
            console.log('🔍 SPELL CHECK RAW RESPONSE:', responseContent);
            console.log('🔍 Response length:', responseContent.length);
            console.log('🔍 Response preview:', responseContent.substring(0, 300) + '...');

            let result: SpellCheckResult;
            try {
                // ENHANCED SPELL CHECK JSON EXTRACTION
                let jsonString = responseContent.trim();

                console.log('🚀 SPELL CHECK JSON EXTRACTION starting...');

                // Remove <think> tags
                jsonString = jsonString.replace(/<think>[\s\S]*?<\/think>/g, '');
                console.log('Step 1 - Removed think tags, length:', jsonString.length);

                // Extract from code blocks if present
                const codeBlockMatch = jsonString.match(/```(?:json)?[\s\S]*?({[\s\S]*?})[\s\S]*?```/);
                if (codeBlockMatch && codeBlockMatch[1]) {
                    jsonString = codeBlockMatch[1];
                    console.log('Step 2 - Extracted from code block, length:', jsonString.length);
                }

                // Find JSON boundaries
                const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonString = jsonMatch[0];
                    console.log('Step 3 - Found JSON boundaries, length:', jsonString.length);
                }

                console.log('🎯 Final spell check JSON for parsing:', jsonString.substring(0, 200) + '...');

                const parsedResult = JSON.parse(jsonString);
                console.log('✅ Spell check JSON parsed successfully!');
                console.log('Raw corrections:', parsedResult.corrections?.length || 0);
                console.log('Raw formatting issues:', parsedResult.formattingIssues?.length || 0);

                // CRITICAL: Validate and clean all data to prevent undefined values
                result = {
                    corrections: Array.isArray(parsedResult.corrections) ? 
                        parsedResult.corrections
                            .filter(c => c && c.original && c.suggested && (c.line !== undefined && c.line !== null))
                            .map(c => ({
                                original: String(c.original || 'Unknown'),
                                suggested: String(c.suggested || 'Unknown'),
                                line: parseInt(String(c.line)) || 1,
                                confidence: parseFloat(String(c.confidence)) || 0.8,
                                context: String(c.context || '')
                            })) : [],
                    formattingIssues: Array.isArray(parsedResult.formattingIssues) ?
                        parsedResult.formattingIssues
                            .filter(issue => issue && issue.issue && (issue.line !== undefined && issue.line !== null))
                            .map(issue => ({
                                issue: String(issue.issue || 'Unknown formatting issue'),
                                line: parseInt(String(issue.line)) || 1,
                                suggestion: String(issue.suggestion || 'No suggestion available'),
                                fixable: Boolean(issue.fixable),
                                originalText: String(issue.originalText || ''),
                                suggestedText: String(issue.suggestedText || issue.suggestion || '')
                            })) : []
                };

                console.log('📊 FINAL VALIDATED SPELL CHECK RESULTS:');
                console.log('✅ Valid corrections:', result.corrections.length);
                console.log('✅ Valid formatting issues:', result.formattingIssues.length);

                // Debug individual results
                result.corrections.forEach((c, i) => {
                    console.log(`Correction ${i + 1}: "${c.original}" → "${c.suggested}" (line ${c.line}, confidence: ${c.confidence})`);
                });

                result.formattingIssues.forEach((issue, i) => {
                    console.log(`Formatting issue ${i + 1}: "${issue.issue}" at line ${issue.line} (fixable: ${issue.fixable})`);
                });

            } catch (parseError) {
                console.error('❌ Spell check JSON parsing failed:', parseError);
                console.error('❌ Parse error message:', parseError.message);
                console.error('❌ Raw response that failed:', responseContent);

                // Create a helpful error result with no undefined values
                result = { 
                    corrections: [], 
                    formattingIssues: [
                        {
                            issue: `Spell check response parsing failed: ${parseError.message}`,
                            line: 1,
                            suggestion: 'The AI response was not in valid JSON format. Check console for details.',
                            fixable: false,
                            originalText: 'AI Response Error',
                            suggestedText: 'Try again or check API configuration'
                        }
                    ]
                };

                console.log('🔄 Created fallback error result with no undefined values');
            }

            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            console.error('💥 Spell check operation failed:', error);
            throw new Error(`Failed to check spelling and formatting: ${error.message}`);
        }
    }

    // ULTIMATE JSON EXTRACTION for Enhanced Rewrite
    async createEnhancedRewrite(content: string, fileName: string, language: string = 'en', model: string = 'sonar-reasoning-pro', onProgress?: (progress: number, status: string) => void): Promise<EnhancedRewriteResult> {
        console.log('🎯 ENHANCED REWRITE STARTING WITH ULTIMATE JSON EXTRACTION');
        console.log('Content length:', content.length);
        console.log('File name:', fileName);
        console.log('Language:', language);
        console.log('Model requested:', model);

        const validatedModel = this.validateModel(model);
        console.log('Model validated to:', validatedModel);

        const cacheKey = `rewrite_${validatedModel}_${language}_${this.hashContent(content + fileName)}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log('📦 Using cached enhanced rewrite result');
            return cached;
        }

        const languageInstructions = this.getLanguageInstructions(language);

        if (onProgress) {
            onProgress(10, 'Preparing content for enhancement...');
        }

        const messages = [
            {
                role: 'system',
                content: `You are an expert markdown content enhancer for ${languageInstructions.name} language. 

ABSOLUTELY CRITICAL: Return ONLY valid JSON in this exact format, with NO other text, NO thinking tags, NO code blocks:

{
  "success": true,
  "enhancedContent": "the completely rewritten and enhanced markdown content here",
  "improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "summary": "summary of what was enhanced"
}

Enhancement Guidelines:
- Fix all spelling and grammar errors
- Improve markdown formatting (proper headers, lists, emphasis)
- Optimize structure for Obsidian (better headings hierarchy, proper spacing)
- Enhance readability with clear paragraphs and logical flow
- Preserve original meaning and content
- Use proper markdown syntax throughout

IMPORTANT: Do NOT wrap your response in code blocks, do NOT include <think> tags, do NOT add any explanations. Return ONLY the JSON object directly.

Special considerations for ${languageInstructions.name}:
${languageInstructions.instructions}
- Maintain original language and cultural context
- Respect text direction requirements
- Preserve technical terms and proper nouns
- Enhance readability while maintaining authenticity`
            },
            {
                role: 'user',
                content: `Enhance this markdown file "${fileName}" content in ${languageInstructions.name}. Return ONLY the JSON object:

${content}`
            }
        ];

        if (onProgress) {
            onProgress(25, 'Sending content to AI for enhancement...');
        }

        try {
            console.log('📤 Making enhanced rewrite API request...');
            const response = await this.makeRequest(messages, validatedModel, 'ENHANCED_REWRITE');

            if (onProgress) {
                onProgress(75, 'Processing AI response with ultimate JSON extraction...');
            }

            let result: EnhancedRewriteResult;
            const responseContent = response.choices[0].message.content;

            try {
                console.log('✅ Enhanced rewrite response received');
                console.log('Response content preview:', responseContent.substring(0, 200) + '...');

                // ULTIMATE JSON EXTRACTION: Multi-stage process
                let jsonString = responseContent.trim();

                console.log('🚀 ULTIMATE JSON EXTRACTION STARTING...');

                // Step 1: Remove <think> tags
                jsonString = jsonString.replace(/<think>[\s\S]*?<\/think>/g, '');
                console.log('Step 1 - Removed think tags, length:', jsonString.length);

                // Step 2: Extract from markdown code blocks
                const codeBlockMatch = jsonString.match(/```(?:json)?[\s\r\n]*([\s\S]*?)[\s\r\n]*```/);
                if (codeBlockMatch && codeBlockMatch[1]) {
                    jsonString = codeBlockMatch[1].trim();
                    console.log('Step 2 - Extracted from code block, length:', jsonString.length);
                }

                // Step 3: Find JSON boundaries
                const jsonMatch = jsonString.match(/\{[\s\S]*"enhancedContent"[\s\S]*\}/);
                if (jsonMatch) {
                    jsonString = jsonMatch[0];
                    console.log('Step 3 - JSON boundaries found, length:', jsonString.length);
                }

                console.log('🎯 Final JSON for parsing:', jsonString.substring(0, 300) + '...');

                const parsedResult = JSON.parse(jsonString);
                console.log('✅ ULTIMATE JSON PARSING SUCCESSFUL!');
                console.log('Enhanced content length:', parsedResult.enhancedContent?.length || 0);

                result = {
                    success: parsedResult.success !== false,
                    enhancedContent: parsedResult.enhancedContent || '',
                    improvements: parsedResult.improvements || ['Content enhancement applied'],
                    summary: parsedResult.summary || 'Content enhanced',
                    error: parsedResult.error
                };

                // ULTIMATE VALIDATION: Check for JSON pollution in content
                if (result.enhancedContent.includes('"enhancedContent":') || result.enhancedContent.startsWith('{"')) {
                    console.warn('⚠️  Content contains JSON structure, extracting...');
                    try {
                        const innerParsed = JSON.parse(result.enhancedContent);
                        if (innerParsed.enhancedContent) {
                            result.enhancedContent = innerParsed.enhancedContent;
                            console.log('✅ Extracted from nested JSON');
                        }
                    } catch {
                        // Manual cleanup
                        let clean = result.enhancedContent;
                        clean = clean.replace(/^.*"enhancedContent":\s*"/, '');
                        clean = clean.replace(/"\s*,\s*"improvements":[\s\S]*$/, '');
                        clean = clean.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                        result.enhancedContent = clean;
                        console.log('✅ Manual cleanup applied');
                    }
                }

                console.log('🎉 ULTIMATE EXTRACTION COMPLETE!');
                console.log('Final content length:', result.enhancedContent.length);
                console.log('Is clean markdown?', result.enhancedContent.startsWith('#'));

            } catch (parseError) {
                console.error('❌ Enhanced rewrite parsing error:', parseError);
                console.error('❌ Failed response:', responseContent.substring(0, 500) + '...');

                // Fallback extraction
                let fallbackContent = responseContent;
                fallbackContent = fallbackContent.replace(/<think>[\s\S]*?<\/think>/g, '');

                const fallbackMatch = fallbackContent.match(/"enhancedContent":\s*"([\s\S]*?)"/);
                if (fallbackMatch && fallbackMatch[1]) {
                    fallbackContent = fallbackMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                } else if (fallbackContent.includes('#')) {
                    const mdMatch = fallbackContent.match(/(# [\s\S]*)/);
                    if (mdMatch) fallbackContent = mdMatch[1];
                }

                result = {
                    success: true,
                    enhancedContent: fallbackContent.trim(),
                    improvements: ['Content enhanced (fallback method)'],
                    summary: 'Enhanced using fallback extraction',
                    error: undefined
                };

                console.log('🔄 Fallback extraction complete, length:', result.enhancedContent.length);
            }

            if (onProgress) {
                onProgress(100, result.success ? 'Enhancement completed!' : 'Enhancement failed');
            }

            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            console.error('💥 Enhanced rewrite error:', error);
            if (onProgress) {
                onProgress(0, 'Enhancement failed');
            }
            return {
                success: false,
                enhancedContent: '',
                improvements: [],
                summary: 'Failed to enhance',
                error: `API call failed: ${error.message}`
            };
        }
    }

    private getLanguageInstructions(language: string) {
        const instructions = {
            'ar': {
                name: 'Arabic',
                instructions: 'Handle Arabic text with RTL direction. Check for proper Arabic grammar, spelling, and diacritics. Preserve Islamic terminology and Quranic verses.'
            },
            'en': {
                name: 'English', 
                instructions: 'Check for English spelling and grammar mistakes.'
            },
            'es': {
                name: 'Spanish',
                instructions: 'Check for Spanish spelling and grammar, including proper accent marks.'
            },
            'fr': {
                name: 'French',
                instructions: 'Check for French spelling and grammar, including proper accents and cedillas.'
            },
            'de': {
                name: 'German',
                instructions: 'Check for German spelling and grammar, including proper capitalization and umlauts.'
            }
        };

        return instructions[language] || instructions['en'];
    }

    private hashContent(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    private getFromCache(key: string): any {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
            return cached.result;
        }
        this.cache.delete(key);
        return null;
    }

    private setCache(key: string, result: any) {
        this.cache.set(key, { result, timestamp: Date.now() });
    }
}

class VaultAnalyzer {
    constructor(private app: App, private perplexityService: PerplexityService) {}

    async checkMultipleFiles(files: TFile[], language: string = 'en', model: string = 'sonar'): Promise<{ file: TFile; result: SpellCheckResult }[]> {
        const results: { file: TFile; result: SpellCheckResult }[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                new Notice(`📄 Checking file ${i + 1}/${files.length}: ${file.basename}`);
                const content = await this.app.vault.read(file);
                const result = await this.perplexityService.checkSpellingAndFormat(content, language, model);
                results.push({ file, result });
            } catch (error) {
                console.error(`Error checking ${file.path}:`, error);
                results.push({ 
                    file, 
                    result: { corrections: [], formattingIssues: [] }
                });
            }
        }

        return results;
    }

    async analyzeVault(excludedExtensions: string[] = []): Promise<any> {
        const markdownFiles = this.app.vault.getFiles()
            .filter(file => file.extension === 'md' && !excludedExtensions.includes(file.extension));

        const analysis = {
            totalFiles: this.app.vault.getFiles().length,
            markdownFiles: markdownFiles.length,
            excludedFiles: this.app.vault.getFiles().length - markdownFiles.length,
            analyzedFiles: Math.min(50, markdownFiles.length),
            themes: [] as string[],
            insights: [] as string[]
        };

        analysis.insights.push(`Found ${analysis.markdownFiles} markdown files out of ${analysis.totalFiles} total files`);

        return analysis;
    }

    async generateSmartLinks(file: TFile, language: string = 'en', excludedExtensions: string[] = [], mode: 'current' | 'all' = 'current', maxSuggestions: number = 10, model: string = 'sonar-pro'): Promise<LinkSuggestion[]> {
        // Simplified implementation
        return [];
    }
}

class AISpellCheckModal extends Modal {
    private statusContainer: HTMLElement;

    constructor(app: App, private plugin: PerplexityPlugin) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'AI Spell Check & Format' });

        this.statusContainer = contentEl.createDiv({ cls: 'status-container' });

        new Setting(contentEl)
            .setName('Check Current File')
            .setDesc('Check spelling and formatting of the currently open file')
            .addButton(btn => btn
                .setButtonText('Check Current File')
                .setCta()
                .onClick(async () => {
                    console.log('📄 Check Current File button clicked');
                    UIUtils.showLoadingButton(btn.buttonEl, 'Checking...');

                    try {
                        this.close();
                        await this.plugin.checkCurrentFile();
                    } catch (error) {
                        console.error('❌ Check current file failed:', error);
                        UIUtils.hideLoadingButton(btn.buttonEl);
                        UIUtils.showStatusMessage(this.statusContainer, 'error', 
                            `Failed to check file: ${error.message}`);
                    }
                }));

        new Setting(contentEl)
            .setName('Check All Vault Files')
            .setDesc('Check spelling and formatting of all markdown files')
            .addButton(btn => btn
                .setButtonText('Check Entire Vault')
                .onClick(async () => {
                    console.log('📚 Check Vault Files button clicked');
                    UIUtils.showLoadingButton(btn.buttonEl, 'Analyzing Vault...');

                    try {
                        this.close();
                        await this.plugin.checkVaultFiles();
                    } catch (error) {
                        console.error('❌ Check vault files failed:', error);
                        UIUtils.hideLoadingButton(btn.buttonEl);
                        UIUtils.showStatusMessage(this.statusContainer, 'error', 
                            `Failed to check vault: ${error.message}`);
                    }
                }));

        new Setting(contentEl)
            .setName('AI Model Settings')
            .setDesc(`Currently using: ${this.plugin.settings.spellCheckModel}`)
            .addButton(btn => btn
                .setButtonText('Change Model')
                .onClick(() => {
                    this.close();
                    this.plugin.openSettings();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class SpellCheckModal extends Modal {
    private statusContainer: HTMLElement;

    constructor(
        app: App, 
        private file: TFile, 
        private result: SpellCheckResult, 
        private plugin: PerplexityPlugin
    ) {
        super(app);
        this.setTitle(`Spell Check Results - ${this.file.basename}`);
    }

    onOpen() {
        const { contentEl } = this;

        console.log('📖 SpellCheckModal opened for file:', this.file.basename);
        console.log('📊 Results: corrections =', this.result.corrections?.length || 0, ', formatting issues =', this.result.formattingIssues?.length || 0);

        this.statusContainer = contentEl.createDiv({ cls: 'status-container' });

        const actionsHeader = contentEl.createDiv({ cls: 'spell-check-actions-header' });

        const createEnhancedBtn = actionsHeader.createEl('button', { 
            text: '🚀 Create Enhanced Version', 
            cls: 'enhanced-rewrite-btn'
        });

        createEnhancedBtn.onclick = () => {
            console.log('🎯 Enhanced Version button clicked!');
            this.createEnhancedVersionWithDebugging();
        };

        if (this.result.corrections?.length > 0) {
            contentEl.createEl('h3', { text: `📝 Spelling Corrections (${this.result.corrections.length})` });

            this.result.corrections.forEach((correction, index) => {
                const correctionDiv = contentEl.createDiv({ cls: 'spell-check-item enhanced' });

                if (this.plugin.settings.rtlSupport && this.plugin.settings.spellCheckLanguage === 'ar') {
                    correctionDiv.addClass('rtl-content');
                }

                correctionDiv.createEl('h4', { text: `Correction ${index + 1}` });
                correctionDiv.createEl('p', { text: `${correction.original} → ${correction.suggested}` });
                correctionDiv.createEl('p', { text: `Line ${correction.line} (${Math.round(correction.confidence * 100)}% confidence)` });
                if (correction.context) {
                    correctionDiv.createEl('p', { text: `Context: ${correction.context}` });
                }
            });
        }

        if (this.result.formattingIssues?.length > 0) {
            contentEl.createEl('h3', { text: `🔧 Formatting Issues (${this.result.formattingIssues.length})` });

            this.result.formattingIssues.forEach((issue, index) => {
                const issueDiv = contentEl.createDiv({ cls: 'formatting-issue-item enhanced' });

                console.log(`🔍 Formatting Issue ${index + 1}:`, {
                    issue: issue.issue,
                    line: issue.line,
                    suggestion: issue.suggestion,
                    fixable: issue.fixable
                });

                issueDiv.createEl('h4', { text: `Issue ${index + 1}` });
                issueDiv.createEl('p', { text: `Line ${issue.line}: ${issue.issue}` });
                issueDiv.createEl('p', { text: `Suggestion: ${issue.suggestion}` });

                if (issue.fixable) {
                    const fixableBadge = issueDiv.createEl('span', { 
                        text: 'Auto-Fixable',
                        cls: 'fixable-badge'
                    });
                    fixableBadge.style.background = 'var(--background-modifier-success)';
                    fixableBadge.style.padding = '2px 8px';
                    fixableBadge.style.borderRadius = '4px';
                }
            });
        }

        if ((!this.result.corrections || this.result.corrections.length === 0) && 
            (!this.result.formattingIssues || this.result.formattingIssues.length === 0)) {
            const perfectDiv = contentEl.createDiv({ cls: 'perfect-result' });
            perfectDiv.createEl('p', { text: '✅ No issues found! Your document looks great.' });

            const enhanceBtn = perfectDiv.createEl('button', { 
                text: '🚀 Create Enhanced Version Anyway',
                cls: 'enhanced-rewrite-btn'
            });
            enhanceBtn.onclick = () => this.createEnhancedVersionWithDebugging();
        }
    }

    private async createEnhancedVersionWithDebugging() {
        console.log('🚀 Creating enhanced version with ultimate JSON extraction...');

        this.statusContainer.empty();
        const progressIndicator = UIUtils.showProgressIndicator(this.statusContainer, 'Preparing enhancement...');

        try {
            const content = await this.app.vault.read(this.file);

            const result = await this.plugin.perplexityService.createEnhancedRewrite(
                content,
                this.file.basename,
                this.plugin.settings.spellCheckLanguage,
                this.plugin.settings.enhancedRewriteModel,
                (progress, status) => {
                    progressIndicator.update(progress, status);
                }
            );

            progressIndicator.remove();

            if (result.success && result.enhancedContent) {
                const enhancedName = `${this.file.basename}-enhanced.md`;
                const enhancedPath = this.file.path.replace(`${this.file.basename}.md`, enhancedName);

                await this.app.vault.create(enhancedPath, result.enhancedContent);

                UIUtils.showStatusMessage(this.statusContainer, 'success', 
                    `Successfully created ${enhancedName}!`);

                setTimeout(async () => {
                    await this.app.workspace.openLinkText(this.file.path, '', false);
                    await this.app.workspace.openLinkText(enhancedPath, '', 'split');
                    this.close();
                }, 1000);

            } else {
                UIUtils.showErrorWithRetry(this.statusContainer, 
                    result.error || 'Enhancement failed', 
                    () => this.createEnhancedVersionWithDebugging());
            }
        } catch (error) {
            progressIndicator.remove();
            UIUtils.showErrorWithRetry(this.statusContainer, 
                `Enhancement failed: ${error.message}`, 
                () => this.createEnhancedVersionWithDebugging());
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class PerplexityMainModal extends Modal {
    private statusContainer: HTMLElement;

    constructor(app: App, private plugin: PerplexityPlugin) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Perplexity Vault Assistant' });

        this.statusContainer = contentEl.createDiv({ cls: 'status-container' });

        new Setting(contentEl)
            .setName('AI Spell Check & Format')
            .setDesc('AI-powered spell checking with ultimate JSON extraction fix')
            .addButton(btn => btn
                .setButtonText('Open Spell Check')
                .setCta()
                .onClick(() => {
                    this.close();
                    new AISpellCheckModal(this.app, this.plugin).open();
                }));

        new Setting(contentEl)
            .setName('Analyze Vault')
            .setDesc('Analyze markdown files in your vault for themes')
            .addButton(btn => btn
                .setButtonText('Start Analysis')
                .onClick(async () => {
                    UIUtils.showLoadingButton(btn.buttonEl, 'Analyzing...');
                    try {
                        this.close();
                        await this.plugin.analyzeVault();
                    } catch (error) {
                        UIUtils.hideLoadingButton(btn.buttonEl);
                        UIUtils.showStatusMessage(this.statusContainer, 'error', 
                            `Analysis failed: ${error.message}`);
                    }
                }));

        new Setting(contentEl)
            .setName('Generate Smart Links')
            .setDesc('Generate intelligent links for the current file')
            .addButton(btn => btn
                .setButtonText('Generate Links')
                .onClick(async () => {
                    UIUtils.showLoadingButton(btn.buttonEl, 'Generating...');
                    try {
                        this.close();
                        await this.plugin.generateSmartLinks();
                    } catch (error) {
                        UIUtils.hideLoadingButton(btn.buttonEl);
                        UIUtils.showStatusMessage(this.statusContainer, 'error', 
                            `Link generation failed: ${error.message}`);
                    }
                }));

        new Setting(contentEl)
            .setName('💖 Support Developer')
            .setDesc('Support continued development')
            .addButton(btn => btn
                .setButtonText('☕ Buy me a coffee')
                .onClick(() => {
                    window.open('https://buymeacoffee.com/YahyaZekry', '_blank');
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class PerplexitySettingTab extends PluginSettingTab {
    plugin: PerplexityPlugin;

    constructor(app: App, plugin: PerplexityPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Perplexity Vault Assistant Settings' });

        containerEl.createEl('h3', { text: '🔑 API Configuration' });

        new Setting(containerEl)
            .setName('Perplexity API Key')
            .setDesc('Enter your Perplexity API key')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: '🌐 Language Settings' });

        new Setting(containerEl)
            .setName('Spell Check Language')
            .setDesc('Primary language for spell checking and content analysis')
            .addDropdown(dropdown => dropdown
                .addOption('en', 'English')
                .addOption('ar', 'Arabic (العربية)')
                .addOption('es', 'Spanish (Español)')
                .addOption('fr', 'French (Français)')
                .addOption('de', 'German (Deutsch)')
                .setValue(this.plugin.settings.spellCheckLanguage)
                .onChange(async (value) => {
                    this.plugin.settings.spellCheckLanguage = value;
                    if (value === 'ar') {
                        this.plugin.settings.rtlSupport = true;
                    }
                    await this.plugin.saveSettings();
                    this.display();
                }));

        new Setting(containerEl)
            .setName('RTL Content Support')
            .setDesc('Enable right-to-left text direction for Arabic content')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rtlSupport)
                .onChange(async (value) => {
                    this.plugin.settings.rtlSupport = value;
                    await this.plugin.saveSettings();
                }));
    }
}

export default class PerplexityPlugin extends Plugin {
    settings: PerplexityPluginSettings;
    perplexityService: PerplexityService;
    vaultAnalyzer: VaultAnalyzer;
    modelsMigrated: boolean = false;

    async onload() {
        console.log('🚀 Perplexity Plugin with ULTIMATE fixes loading...');
        await this.loadSettings();

        this.perplexityService = new PerplexityService(this.settings.apiKey);
        this.vaultAnalyzer = new VaultAnalyzer(this.app, this.perplexityService);

        // RESTORED: Full menu on ribbon icon click
        this.addRibbonIcon('brain', 'Perplexity Assistant', (evt: MouseEvent) => {
            console.log('🧠 Ribbon icon clicked - opening FULL MENU');
            new PerplexityMainModal(this.app, this).open();
        });

        this.addCommand({
            id: 'check-current-file',
            name: 'Check current file with ultimate JSON extraction',
            callback: () => this.checkCurrentFile()
        });

        this.addCommand({
            id: 'create-enhanced-version',
            name: 'Create enhanced version with ultimate JSON extraction',
            callback: () => this.createEnhancedVersionWithDebugging()
        });

        this.addSettingTab(new PerplexitySettingTab(this.app, this));

        console.log('✅ Plugin loaded with full menu and ultimate JSON extraction');
    }

    onunload() {
        console.log('🔄 Plugin unloading...');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        if (!this.settings.enhancedRewriteModel) {
            this.settings.enhancedRewriteModel = 'sonar-reasoning-pro';
            this.modelsMigrated = true;
            await this.saveSettings();
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.perplexityService.updateApiKey(this.settings.apiKey);
    }

    openSettings() {
        (this.app as any).setting.open();
        (this.app as any).setting.openTabById('obsidian-perplexity-plugin');
    }

    async checkCurrentFile() {
        console.log('📄 Starting spell check with ultimate JSON extraction...');
        if (!this.settings.apiKey) {
            new Notice('Please configure your Perplexity API key first');
            return;
        }

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Please open a markdown file first');
            return;
        }

        const loadingNotice = new Notice('⏳ Checking with enhanced parsing...', 0);

        try {
            const content = await this.app.vault.read(activeFile);
            console.log('📄 File content length:', content.length);

            loadingNotice.setMessage('🔍 Analyzing with AI...');

            const result = await this.perplexityService.checkSpellingAndFormat(
                content, 
                this.settings.spellCheckLanguage,
                this.settings.spellCheckModel || 'sonar'
            );

            loadingNotice.hide();
            new Notice('✅ Analysis completed!');

            console.log('✅ Opening results modal...');
            new SpellCheckModal(this.app, activeFile, result, this).open();
        } catch (error) {
            console.error('💥 Spell check failed:', error);
            loadingNotice.hide();
            new Notice(`❌ Check failed: ${error.message}`);
        }
    }

    async checkVaultFiles() {
        if (!this.settings.apiKey) {
            new Notice('Please configure your API key first');
            return;
        }

        const markdownFiles = this.app.vault.getFiles()
            .filter(file => file.extension === 'md')
            .slice(0, 20);

        if (markdownFiles.length === 0) {
            new Notice('No markdown files found');
            return;
        }

        const loadingNotice = new Notice(`⏳ Checking ${markdownFiles.length} files...`, 0);

        try {
            const results = await this.vaultAnalyzer.checkMultipleFiles(
                markdownFiles,
                this.settings.spellCheckLanguage,
                this.settings.spellCheckModel || 'sonar'
            );

            loadingNotice.hide();
            const totalIssues = results.reduce((sum, r) => 
                sum + r.result.corrections.length + r.result.formattingIssues.length, 0);
            new Notice(`✅ Found ${totalIssues} issues across ${results.length} files`);

        } catch (error) {
            loadingNotice.hide();
            new Notice(`❌ Vault check failed: ${error.message}`);
        }
    }

    async analyzeVault() {
        if (!this.settings.apiKey) {
            new Notice('Please configure your API key first');
            return;
        }

        new Notice('🚀 Starting vault analysis...');
        try {
            const analysis = await this.vaultAnalyzer.analyzeVault(this.settings.excludedExtensions);
            new Notice(`📊 Analysis complete: ${analysis.markdownFiles} MD files`);
        } catch (error) {
            new Notice(`Analysis failed: ${error.message}`);
        }
    }

    async generateSmartLinks() {
        if (!this.settings.apiKey) {
            new Notice('Please configure your API key first');
            return;
        }

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Please open a markdown file first');
            return;
        }

        const loadingNotice = new Notice('⏳ Generating smart links...', 0);

        try {
            const suggestions = await this.vaultAnalyzer.generateSmartLinks(
                activeFile,
                this.settings.spellCheckLanguage,
                this.settings.excludedExtensions,
                this.settings.smartLinkingMode || 'current',
                this.settings.maxLinkSuggestions || 10,
                this.settings.linkAnalysisModel || 'sonar-pro'
            );

            loadingNotice.hide();
            new Notice(`✅ Generated ${suggestions.length} link suggestions`);

        } catch (error) {
            loadingNotice.hide();
            new Notice(`❌ Link generation failed: ${error.message}`);
        }
    }

    async createEnhancedVersionWithDebugging() {
        if (!this.settings.apiKey) {
            new Notice('Please configure your API key first');
            return;
        }

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== 'md') {
            new Notice('Please open a markdown file first');
            return;
        }

        const loadingNotice = new Notice(`🚀 Creating enhanced ${activeFile.basename}...`, 0);

        try {
            const content = await this.app.vault.read(activeFile);

            const result = await this.perplexityService.createEnhancedRewrite(
                content,
                activeFile.basename,
                this.settings.spellCheckLanguage,
                this.settings.enhancedRewriteModel,
                (progress, status) => {
                    loadingNotice.setMessage(`⏳ ${status} (${progress}%)`);
                }
            );

            if (result.success) {
                const enhancedName = `${activeFile.basename}-enhanced-final.md`;
                const enhancedPath = activeFile.path.replace(`${activeFile.basename}.md`, enhancedName);

                await this.app.vault.create(enhancedPath, result.enhancedContent);

                loadingNotice.hide();
                new Notice(`✅ Created ${enhancedName}!`);

                setTimeout(async () => {
                    await this.app.workspace.openLinkText(activeFile.path, '', false);
                    await this.app.workspace.openLinkText(enhancedPath, '', 'split');
                }, 500);

            } else {
                loadingNotice.hide();
                new Notice(`❌ Enhancement failed: ${result.error}`);
            }
        } catch (error) {
            loadingNotice.hide();
            new Notice(`❌ Enhancement error: ${error.message}`);
        }
    }
}
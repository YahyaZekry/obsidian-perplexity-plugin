import { CacheManager } from './CacheManager';

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
    spellCheckPrompt: 'standard' | 'superprompt';

    spellCheckMode: 'auto' | 'full' | 'incremental';
    fullModeChunkSize: number;
    fullModeShowProgress: boolean;
    autoModeThreshold: number;
    incrementalModeSectionSize: number;
    vaultSpellCheckMode: 'auto' | 'full' | 'incremental';
    vaultFullModeChunkSize: number;
    vaultAutoModeThreshold: number;
    allowModeSwitching: boolean;
}

export class PerplexityService {
    constructor(
        private cacheManager: CacheManager,
        private settings: PerplexityPluginSettings
    ) {}

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    async checkSpellingAndFormat(content: string, language: string): Promise<SpellCheckResult> {
        const cacheKey = `spell:${language}:${this.simpleHash(content)}:${this.settings.spellCheckPrompt}`;
        const cached = await this.cacheManager.get(cacheKey, this.settings.cacheDuration);
        
        if (cached && this.settings.cacheEnabled) {
            return cached;
        }

        let systemPrompt = '';
        
        if (this.settings.spellCheckPrompt === 'superprompt') {
            systemPrompt = `Type: Context-Aware Linguistic Validator
Purpose: Orthographic and Grammatical Error Detection for ${language}
Paradigm: Multi-Pass Verification with Confidence Gating
Objective: Detect errors while eliminating false positives from technical terms, proper nouns, and code

For all corrections: confidence >= 0.75 and verifiable_in_context = true
For all arabic_token (if ${language} === 'ar'): preserve diacritics = IMMUTABLE
For all protected_element in {\`code\`, [[links]], URLs, ^block-ids}: skip_validation()

scan(text, line_by_line)
for each token:
  if orthographic_error(token):
    flag(token, type="spelling", confidence=calculate())
  if grammatical_violation(token_sequence):
    flag(sequence, type="grammar", confidence=calculate())
  if formatting_anomaly(token):
    flag(token, type="formatting", confidence=calculate())

for each flagged_error:
  if is_proper_noun(error.original):
    if capitalized_correctly: SKIP
  
  if is_technical_term(error.original):
    if appears_multiple_times: SKIP
  
  if is_domain_specific(error.original, ${language}):
    if context_suggests_valid: SKIP
  
  if error.confidence < 0.75:
    DISCARD
  
  if error.original == error.suggested:
    DISCARD
  
  else:
    KEEP(error)

IF ${language === 'ar' ? 'true' : 'false'}:
  - NEVER suggest removing diacritics (َ ِ ُ ّ ْ ً ٌ ٍ)
  - NEVER suggest adding diacritics if absent
  - Respect hamza variants (أ إ ء ؤ ئ) as potentially valid
  - Consider ة/ه endings context-dependent

IF ${language === 'en' ? 'true' : 'false'}:
  - Accept both US/UK spellings (color/colour, realize/realise)
  - Preserve intentional capitalization in headings
  - Don't flag contractions (won't, can't, it's)

UNIVERSAL:
  - Extract FULL sentence for context field (not fragments)
  - Line numbers start at 1 (not 0)
  - originalText/suggestedText must show actual character differences

{
  "corrections": [
    {
      "original": "detected_error",
      "suggested": "correction",
      "line": integer >= 1,
      "confidence": float [0.75-1.0],
      "context": "complete_sentence_containing_error"
    }
  ],
  "formattingIssues": [
    {
      "issue": "description",
      "line": integer >= 1,
      "suggestion": "fix_description",
      "fixable": boolean,
      "originalText": "problematic_segment",
      "suggestedText": "corrected_segment"
    }
  ]
}

META_PROMPT1: Execute multi-pass detection with context verification. Return ONLY valid JSON per output_schema.
META_PROMPT2: Prioritize precision over recall—better to miss an error than flag correct text.`;
        } else {
            systemPrompt = `Act as a precise spell checker and grammar validator for ${language}. Analyze the provided text and return ONLY a JSON object with zero corrections if no errors exist.

**RESPONSE FORMAT (STRICT JSON ONLY):**
{
  "corrections": [
    {
      "original": "incorect",
      "suggested": "incorrect",
      "line": 1,
      "confidence": 0.95,
      "context": "This is an incorect sentence."
    }
  ],
  "formattingIssues": [
    {
      "issue": "Missing comma after introductory clause",
      "line": 2,
      "suggestion": "Add comma after 'However'",
      "fixable": true,
      "originalText": "However I disagree",
      "suggestedText": "However, I disagree"
    }
  ]
}

**FIELD DEFINITIONS:**
- corrections: Spelling errors, incorrect word usage, grammatical mistakes
- formattingIssues: Punctuation, spacing, capitalization, structural problems
- confidence: 0.0-1.0 score indicating certainty
- context: FULL sentence containing the error (not truncated)

**CRITICAL RULES:**
- ${language === 'ar' ? 'ARABIC-SPECIFIC: PRESERVE all diacritics (تشكيل/tashkeel marks) exactly as they appear – do NOT add, remove, or modify them' : 'Preserve original diacritics and special characters'}
- Only flag actual errors; do NOT "improve" stylistic choices or rephrase for clarity
- Do NOT suggest changes to proper nouns, technical terms, or code unless clearly misspelled
- Line numbers are 1-indexed
- If no errors: return {"corrections": [], "formattingIssues": []}
- Never explain, apologize, or add markdown code blocks around the JSON`;
        }

        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.settings.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.settings.spellCheckModel || 'sonar',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: `Check: ${content.substring(0, 5000)}`
                    }
                ],
                max_tokens: 4000,
                temperature: 0.1
            })
        });

        const data = await response.json();
        let responseContent = data.choices[0].message.content;
        
        responseContent = responseContent.replace(/[\s\S]*?<\/think>/g, '');
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) responseContent = jsonMatch[0];

        const parsed = JSON.parse(responseContent);
        console.log('✅ API Response:', parsed); // Debug log

        // Add fallback context if not provided
        const result: SpellCheckResult = {
            corrections: (parsed.corrections || []).map((c: any) => ({
                ...c,
                context: c.context || 'No context available'
            })).filter((c: any) => c.original && c.suggested),
            formattingIssues: (parsed.formattingIssues || []).map((i: any) => ({
                ...i,
                originalText: i.originalText || 'No original text available',
                suggestedText: i.suggestedText || 'No suggested text available'
            })).filter((i: any) => i.issue)
        };

        if (this.settings.cacheEnabled) {
            await this.cacheManager.set(cacheKey, result, this.settings.cacheDuration);
        }

        return result;
    }
    
    async applyCorrectionsWithChunks(content: string, language: string): Promise<string> {
        if (content.length > 15000) {
            const sections = content.split(/\n(?=##? )/);
            const correctedSections: string[] = [];

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i].trim();
                if (!section) continue;

                try {
                    const correctedSection = await this.applySectionCorrections(section, language);
                    correctedSections.push(correctedSection);
                    await new Promise(resolve => setTimeout(resolve, 800));
                } catch (error) {
                    console.error(`Section ${i + 1} correction failed:`, error);
                    correctedSections.push(section);
                }
            }

            return correctedSections.join('\n\n');
        }

        return await this.applySectionCorrections(content, language);
    }

    async createEnhancedRewrite(content: string, language: string): Promise<string> {
        if (content.length > 15000) {
            const sections = content.split(/\n(?=##? )/);
            const enhanced: string[] = [];

            for (const section of sections) {
                if (section.trim()) {
                    try {
                        const result = await this.enhanceSection(section, language);
                        enhanced.push(result);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch {
                        enhanced.push(section);
                    }
                }
            }

            return enhanced.join('\n\n');
        }

        return await this.enhanceSection(content, language);
    }

    async applySectionCorrections(content: string, language: string): Promise<string> {
        const messages = [
            {
                role: 'system',
                content: `You are a precise text correction engine for ${language}. Apply spelling and grammar fixes while preserving ALL Obsidian markdown syntax and document structure.

**YOUR TASK:**
Apply corrections to spelling errors and grammar mistakes ONLY. Return the corrected text in plain text format (NO JSON, NO markdown code blocks, NO explanations).

**ABSOLUTE PROTECTIONS (NEVER MODIFY THESE):**
- Wiki-links: [[Page Name]] or [[Page Name|Display Text]]
- Embeds: ![[Image.png]] or ![[Note#Heading]]
- Frontmatter: --- key: value --- (preserve exact formatting)
- Code blocks: \`\`\`language ... \`\`\` (preserve content inside)
- Inline code: \`code snippets\`
- Math blocks: $$...$$ or $...$
- Callouts: > [!NOTE], > [!WARNING], etc.
- HTML tags: <br>, <u>, etc.
- Tables: | column | column | (preserve pipe structure)
- Block IDs: ^block-id
- Footnotes: [^1], [^1]: text
- URLs: [text](https://...) or bare URLs

**CORRECTION SCOPE:**
- Fix spelling errors (e.g., "recieve" → "receive")
- Fix grammar mistakes (e.g., "they is" → "they are")
- Fix punctuation spacing (e.g., "word , word" → "word, word")
- Fix capitalization at sentence start ONLY if clearly wrong

**FORBIDDEN ACTIONS:**
- Do NOT rephrase sentences for "better flow"
- Do NOT change active/passive voice
- Do NOT replace words with synonyms
- Do NOT add or remove line breaks
- Do NOT "improve" bullet points or numbered lists
- Do NOT change heading levels (# ## ###)
- Do NOT alter the structure of tables
- Do NOT remove or add diacritics/tashkeel in Arabic text

**OUTPUT RULES:**
- Return ONLY the corrected text
- NO markdown code blocks (\`\`\`) around the output
- NO explanations, comments, or "Here is the corrected text:"
- NO "---" separators before or after
- Preserve exact line breaks and spacing from input`
            },
            {
                role: 'user', 
                content: `Apply ONLY spelling and formatting corrections to this content (keep everything else exactly the same):

${content}`
            }
        ];

        try {
            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.settings.spellCheckModel || 'sonar',
                    messages,
                    max_tokens: 6000,
                    temperature: 0.1
                })
            });

            const data = await response.json();
            let corrected = data.choices[0].message.content.trim();
            
            corrected = corrected.replace(/[\s\S]*?<\/think>/g, '');
            corrected = corrected.replace(/```[\s\S]*?```/g, '');
            corrected = corrected.trim();

            return corrected.length > 50 ? corrected : content;
        } catch (error) {
            console.error('Section correction error:', error);
            return content;
        }
    }

    async enhanceSection(content: string, language: string): Promise<string> {
        const messages = [
            {
                role: 'system',
                content: "You are an expert Obsidian markdown editor and content strategist for " + language + ". Enhance the provided markdown file to improve clarity, structure, and Obsidian-native functionality while preserving the core meaning and intent.\n\n**ENHANCEMENT SCOPE:**\n\n**Content Improvements:**\n- Strengthen weak or vague phrasing with precise language\n- Fix logical flow between sections and paragraphs\n- Remove redundancies and filler words\n- Convert passive voice to active where it improves clarity\n- Break up overly long sentences and dense paragraphs\n- Add transitional phrases between disconnected ideas\n\n**Obsidian Structure Optimization:**\n- Improve heading hierarchy (H1→H2→H3) for logical nesting\n- Convert plain lists to proper Obsidian callouts where semantically appropriate:\n  - Use > [!NOTE] for important context\n  - Use > [!TIP] for actionable advice\n  - Use > [!WARNING] for critical caveats\n  - Use > [!EXAMPLE] for illustrative cases\n- Enhance wiki-links: [[Page]] → [[Page|Natural Link Text]] when context helps\n- Suggest relevant but currently unlinked concepts as [[Potential Links]]\n- Convert inline URLs to markdown links: [descriptive text](URL)\n- Format frontmatter cleanly (YAML style) with consistent indentation\n\n**Formatting Polish:**\n- Standardize bullet styles (- vs *) within documents\n- Ensure consistent spacing before/after headings and lists\n- Fix table alignment and column widths\n- Apply proper code block language identifiers (```python, ```javascript)\n- Clean up excessive blank lines (max 1 between paragraphs)\n\n**NON-NEGOTIABLE PRESERVATION:**\n- Do NOT change factual claims or data\n- Do NOT alter code logic inside code blocks\n- Do NOT remove existing [[wiki-links]] (improve their display text only)\n- Do NOT change the original author's voice/tone dramatically\n- Do NOT add external information not implied by the original text\n- For Arabic: Maintain original diacritics if present; don't add/remove tashkil\n\n**OUTPUT REQUIREMENTS:**\n- Return ONLY the enhanced markdown content\n- NO markdown code blocks around the output (```md or ```)\n- NO explanatory comments or \"Enhanced version:\" preamble\n- NO trailing notes about what was changed\n- Preserve document's original line ending style (LF/CRLF)"
            },
            {
                role: 'user',
                content: "Enhance this content:\n\n" + content
            }
        ];

        try {
            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.settings.enhancedRewriteModel || 'sonar-reasoning-pro',
                    messages,
                    max_tokens: 6000,
                    temperature: 0.1
                })
            });

            const data = await response.json();
            let enhanced = data.choices[0].message.content.trim();
            enhanced = enhanced.replace(/[\s\S]*?<\/think>/g, '');
            enhanced = enhanced.replace(/```[\s\S]*?```/g, '');
            return enhanced.startsWith('#') ? enhanced : content;
        } catch {
            return content;
        }
    }
}

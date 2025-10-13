# Perplexity Vault Assistant 🐻

_AI-powered vault intelligence with the strength of a bear, fueled by semantic connections_ 🧉

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple.svg)](https://obsidian.md/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.7.4-blue.svg)](https://www.typescriptlang.org/)
[![AI Powered](https://img.shields.io/badge/AI-Perplexity-orange.svg)](https://perplexity.ai)

Transform your Obsidian vault into an intelligent knowledge system with AI-powered analysis, spell checking, formatting, and smart linking using Perplexity's advanced models.

---

## ✨ Intelligent Features

### 🧠 **AI-Powered Analysis**
- **Advanced Understanding** - Perplexity AI analyzes markdown files with deep semantic comprehension
- **Content Intelligence** - Understands context, themes, and relationships across your entire vault
- **Smart Processing** - Automatically excludes non-readable files (PDFs, images, archives) for optimal performance

### 📝 **Smart Spell Checking**
- **Context-Aware Corrections** - AI understands context to provide accurate suggestions
- **Multi-Language Support** - Full support for English, Arabic (العربية), Spanish, French, and German
- **Syntax Preservation** - Maintains markdown formatting while correcting content
- **RTL Support** - Right-to-left text direction for Arabic and other RTL languages

### 🔗 **Intelligent Linking System**
- **Semantic Connections** - AI identifies meaningful relationships between notes
- **Detailed Reasoning** - Explains why connections make sense with AI-generated explanations
- **Connection Types** - Categorizes links as Conceptual, Sequential, Complementary, or Reference
- **Relevance Scoring** - AI-calculated similarity percentages for each suggestion
- **Dual Analysis Modes** - Current file focus or comprehensive vault-wide analysis

### 🌐 **Multi-Language Excellence**
- **English** (en) - Complete spell checking and semantic analysis
- **Arabic** (العربية) - Native RTL support with Arabic typography and grammar
- **Spanish** (Español) - Accent and grammar checking with cultural context
- **French** (Français) - Proper accent marks and cedilla support
- **German** (Deutsch) - Capitalization rules and umlaut handling

### 🎨 **Enhanced User Experience**
- **Beautiful Interface** - Clean, intuitive design with enhanced suggestions
- **Performance Optimized** - Caching and batch processing for large vaults
- **Built-in Documentation** - Complete help system accessible within the plugin
- **Smart Filtering** - Configurable file type exclusions with visual settings display

---

## 🧉 **Technology Stack**

**Core Framework**
- **Obsidian API** - Latest plugin architecture with modern TypeScript patterns
- **TypeScript 4.7.4** - Type-safe development with comprehensive interfaces
- **ESBuild 0.17.3** - Lightning-fast bundling with production optimizations

**AI & Language Processing**
- **Perplexity API** - Advanced language models for semantic understanding
- **Multi-Language NLP** - Context-aware processing for 5 major languages
- **Semantic Analysis** - Deep content understanding and relationship mapping

**Development & Build**
- **ESLint 5.29.0** - Code quality and consistency enforcement
- **Node.js 16+** - Modern JavaScript runtime with full ES2022 support
- **Turbopack Dev Mode** - Ultra-fast development builds and hot reload

**Performance & Optimization**
- **Intelligent Caching** - 24-hour result caching to minimize API costs
- **Batch Processing** - Efficient handling of large vault operations
- **Smart Filtering** - Automatic exclusion of binary and non-text files

---

## 🚀 Getting Started

### **Prerequisites**
- Obsidian desktop application
- Perplexity API key from [perplexity.ai](https://perplexity.ai)
- Node.js 16+ (for development)

### **Installation Options**

#### **From GitHub Releases (Recommended)**
```bash
# 1. Download latest release from GitHub
# 2. Extract files to your vault:
~/.obsidian/plugins/obsidian-perplexity-plugin/

# 3. Enable in Obsidian Settings → Community Plugins
```

#### **Development Installation**
```bash
# Clone and build
git clone https://github.com/YahyaZekry/obsidian-perplexity-plugin.git
cd obsidian-perplexity-plugin

# Install dependencies
npm install

# Build for production
npm run build

# Development mode with hot reload
npm run dev
```

### **Configuration Setup**
1. **API Configuration** - Add your Perplexity API key in plugin settings
2. **Language Selection** - Choose your primary language for analysis
3. **File Filtering** - Configure excluded file types (automatic defaults included)
4. **Smart Linking** - Set analysis mode and similarity thresholds
5. **Performance Tuning** - Enable caching and adjust batch processing settings

---

## 📁 **Plugin Architecture**

```
obsidian-perplexity-plugin/
├── src/
│   ├── main.ts              # Plugin entry point and Obsidian API integration
│   ├── PerplexityService.ts # Core AI service with API management
│   ├── LanguageSupport.ts   # Multi-language processing and RTL support
│   ├── SmartLinking.ts      # Intelligent connection analysis
│   ├── FileProcessor.ts     # Vault analysis and file filtering
│   └── UI/
│       ├── SettingsTab.ts   # Configuration interface
│       ├── LinkingModal.ts  # Smart suggestions display
│       └── ProgressModal.ts # Operation feedback
├── styles.css               # Custom styling and RTL support
├── manifest.json            # Plugin metadata and permissions
└── esbuild.config.mjs       # Build configuration with optimization
```

---

## 🎯 **Core Usage**

### **🧠 Vault Intelligence**
```
Command: "Perplexity: Analyze entire vault"
• Provides comprehensive content overview
• Shows file type breakdown and exclusions
• Identifies key themes and knowledge clusters
```

### **📝 Smart Corrections**
```
Command: "Perplexity: Check spelling and format"
• Context-aware spell checking
• Preserves markdown syntax
• Multi-language grammar analysis
```

### **🔗 Intelligent Connections**
```
Command: "Perplexity: Generate smart links"
• AI-powered relationship discovery
• Detailed reasoning for each suggestion
• Relevance scoring and connection types
```

### **📖 Built-in Help**
```
Command: "Perplexity: Show documentation"
• Complete usage guide
• Troubleshooting assistance
• Feature examples and tips
```

---

## ⚙️ **Advanced Configuration**

### **AI & Performance Settings**
- **Model Selection** - Choose between `sonar-small-chat` (economical) and `sonar-medium-online` (comprehensive)
- **Caching Strategy** - 24-hour intelligent caching reduces costs by up to 80%
- **Rate Limiting** - Built-in API request management for optimal performance
- **Batch Processing** - Configurable chunk sizes for large vault operations

### **Language & Localization**
- **RTL Interface** - Automatic right-to-left layout for Arabic content
- **Font Support** - Native typography for all supported languages
- **Mixed Content** - Handles multilingual documents seamlessly

### **Smart Linking Intelligence**
- **Analysis Modes** - Current file focus vs. comprehensive vault analysis
- **Similarity Thresholds** - Fine-tune suggestion relevance (0.3-0.9)
- **Connection Types** - Conceptual, Sequential, Complementary, Reference classifications
- **Suggestion Limits** - Control result quantity (3-20 suggestions)

---

## 🌟 **Arabic Language Excellence**

Comprehensive Arabic support designed for native speakers and Arabic content creators:

### **Native Arabic Features**
- **✅ RTL Interface** - Complete right-to-left user interface
- **✅ Arabic Typography** - Proper font rendering and text shaping
- **✅ Grammar Analysis** - Context-aware Arabic grammar checking
- **✅ Semantic Understanding** - AI comprehends Arabic content themes
- **✅ Mixed Content** - Seamless Arabic-English document support
- **✅ Cultural Context** - Understands Arabic linguistic nuances

---

## 💰 **API Cost Optimization**

**Smart Cost Management**
- **Intelligent Caching** - Results cached for 24 hours (saves ~80% on repeat operations)
- **File Filtering** - Automatic exclusion of binary files reduces unnecessary API calls
- **Batch Processing** - Efficient request grouping minimizes API overhead
- **Model Selection** - Choose appropriate models for different use cases

**Estimated Costs** (Perplexity API pricing)
- **Spell Checking** - ~$0.20 per 1M tokens (sonar-small-chat)
- **Smart Analysis** - ~$1.00 per 1M tokens (sonar-medium-online)
- **Typical Usage** - $2-5 monthly for active vault management

---

## 🛠️ **Development**

### **Building the Plugin**
```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build

# Type checking
npx tsc --noEmit --skipLibCheck
```

### **Contributing**
1. Fork the repository
2. Create feature branch (`git checkout -b feature/bear-enhancement`)
3. Commit changes (`git commit -m '🐻 Add bear-strength feature'`)
4. Push to branch (`git push origin feature/bear-enhancement`)
5. Open Pull Request with detailed description

### **Adding Language Support**
```typescript
// Add new language in LanguageSupport.ts
export const SUPPORTED_LANGUAGES = {
  // ... existing languages
  'pt': { name: 'Português', rtl: false, instructions: '...' }
};
```

---

## 🔒 **Privacy & Security**

- **🔐 Secure Storage** - API keys encrypted in Obsidian's secure settings
- **🏠 Local Processing** - File analysis and filtering performed locally
- **🚫 No Data Retention** - No content permanently stored on external servers
- **📄 Markdown Only** - Only text content sent for AI analysis
- **🛡️ Smart Filtering** - Binary files automatically excluded from processing

---

## 🐛 **Troubleshooting**

### **Common Solutions**

**"API key not configured"**
```
→ Settings → Community Plugins → Perplexity Vault Assistant
→ Enter API key from perplexity.ai
```

**Smart links showing irrelevant results**
```
→ Lower similarity threshold in settings
→ Try "Current File" mode for focused analysis
→ Ensure target files have substantial content
```

**Arabic text not displaying correctly**
```
→ Enable RTL support in plugin settings
→ Verify Arabic fonts installed on system
→ Check Obsidian language configuration
```

**Performance issues with large vaults**
```
→ Enable caching in settings (should be default)
→ Increase similarity threshold for fewer suggestions
→ Use "Current File" mode instead of vault-wide analysis
→ Configure file exclusions to skip large binary files
```

---

## 📋 **Changelog**

### **v1.1.0** (Latest) - Enhanced Intelligence
- **🆕 Advanced Smart Linking** - AI reasoning and connection types
- **🆕 Dual Analysis Modes** - Current file vs. vault-wide analysis
- **🆕 File Type Management** - Visual exclusion settings with breakdown
- **🆕 Connection Classification** - Conceptual, Sequential, Complementary, Reference
- **🆕 Target Preview** - Preview files before adding links
- **⚡ Performance Boost** - Optimized for large vaults with intelligent caching
- **🌐 Enhanced Arabic** - Improved RTL support and Arabic typography

### **v1.0.0** - Foundation Release
- Core AI-powered spell checking and basic smart linking
- Multi-language support with RTL capabilities
- Perplexity API integration with cost optimization

---

## 🗺️ **Roadmap**

### **Coming Soon**
- 📱 **Mobile Optimization** - Enhanced mobile Obsidian experience
- 🔍 **Advanced Search** - AI-powered vault search integration
- 📊 **Analytics Dashboard** - Usage insights and link suggestion analytics
- 🎯 **Custom Dictionaries** - Personal vocabulary management
- 🤖 **Model Options** - Support for additional AI providers
- 🌍 **Language Expansion** - Japanese, Korean, Russian support

---

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for complete details.

**Copyright (c) 2025 The Bear Code**

---

## 👨‍💻 **Author**

**Yahya Zekry** • The Bear Code  
- GitHub: [@YahyaZekry](https://github.com/YahyaZekry)  
- LinkedIn: [Professional Profile](https://www.linkedin.com/in/yahyazekry/)  
- Email: [yahyazekry@gmail.com](mailto:yahyazekry@gmail.com)

---

## 🤝 **Support & Community**

**🐛 Found a Bug?** [Report Issues](https://github.com/YahyaZekry/obsidian-perplexity-plugin/issues)  
**💡 Feature Request?** [Join Discussions](https://github.com/YahyaZekry/obsidian-perplexity-plugin/discussions)  
**❓ Need Help?** Check built-in documentation or create an issue  

---

**Built with ❤️ for the global Obsidian community • The Bear Code philosophy: Strong connections, intelligent solutions 🐻🧉**

<div align="center">
  <a href="https://buymeacoffee.com/YahyaZekry" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Support The Bear Code" height="45" />
  </a>
</div>

<div align="center">
  <sub>Fueling intelligent vault management, one mate session at a time 🧉</sub>
</div>
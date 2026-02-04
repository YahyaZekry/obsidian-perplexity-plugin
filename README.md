# Perplexity Vault Assistant

AI-powered vault management with spell checking, formatting, and smart linking using the Perplexity API.

## Features

🧠 **AI-Powered Analysis**: Uses Perplexity's advanced AI models to understand your vault content (MD files only)

📝 **Smart Spell Checking**: Context-aware spell checking with multi-language support including Arabic

🔗 **Intelligent Linking**: Semantic links between related notes with detailed AI reasoning

🌐 **Multi-Language Support**: Full support for English, Arabic, Spanish, French, and German

📁 **Smart File Filtering**: Automatically excludes non-readable files (PDFs, images, etc.) from analysis

⚡ **Performance Optimized**: Built with caching and batch processing for large vaults

🎨 **Beautiful UI**: Clean, intuitive interface with enhanced link suggestions

📖 **Built-in Documentation**: Complete help system accessible within the plugin

💖 **Support Integration**: Easy access to support the continued development

## Language Support

### Fully Supported Languages
- **English** (en) - Complete spell checking and analysis
- **Arabic** (ar) - [translate:العربية] with RTL support and Arabic text analysis  
- **Spanish** (es) - [translate:Español] with accent and grammar checking
- **French** (fr) - [translate:Français] with accent marks and cedillas
- **German** (de) - [translate:Deutsch] with capitalization and umlauts

### Arabic Features
- ✅ Right-to-left (RTL) text direction
- ✅ Arabic spell checking and grammar
- ✅ Arabic content analysis and semantic linking
- ✅ Mixed Arabic-English content support
- ✅ Arabic UI elements and help text
- ✅ Proper Arabic typography and fonts

## Smart Linking Features

### Two Analysis Modes

**Current File Mode** (Default)
- Analyzes the currently open markdown file
- Compares it against other files in your vault
- Shows file title in the modal: "Smart Links for: [filename]"
- Provides focused suggestions for the current document

**All Files Mode** (Advanced)
- Analyzes relationships between all markdown files
- Provides comprehensive vault-wide link suggestions
- More resource-intensive but thorough analysis

### Enhanced Link Suggestions
Each suggestion includes:
- **Relevance Percentage**: AI-calculated similarity score
- **Detailed Reasoning**: Why Perplexity suggests this link
- **Connection Type**: Conceptual, Sequential, Complementary, or Reference
- **Common Themes**: Shared topics between the files
- **Content Preview**: Brief excerpt from the target file
- **Smart Actions**: Add link with context or preview the target file

## File Type Filtering

### Automatic Exclusions
The plugin automatically excludes files that Perplexity AI cannot read:
- **Documents**: PDF, DOCX, XLSX, PPTX
- **Archives**: ZIP, RAR, 7Z
- **Images**: PNG, JPG, JPEG, GIF
- **Executables**: EXE, DMG, APP
- **Custom Extensions**: Fully configurable in settings

### Benefits
- **Improved Performance**: Faster analysis by focusing on readable content
- **Better Accuracy**: AI analysis focused on actual text content
- **Cost Optimization**: Reduced API calls by excluding non-text files
- **Vault Overview**: See breakdown of all file types in your vault

## Installation

### From GitHub Releases (Recommended)
1. Download the latest release from the [Releases page](https://github.com/yahyaZekry/obsidian-perplexity-plugin/releases)
2. Extract the files to your vault's `.obsidian/plugins/obsidian-perplexity-plugin/` directory
3. Enable the plugin in Obsidian's Community Plugins settings

### Manual Installation
1. Clone this repository
2. Run `npm install` to install dependencies  
3. Run `npm run build` to compile the plugin
4. Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/obsidian-perplexity-plugin/` directory
5. Enable the plugin in Obsidian's Community Plugins settings

## Setup

1. Get a Perplexity API key from [perplexity.ai](https://perplexity.ai)
2. Open Obsidian Settings → Community Plugins → Perplexity Vault Assistant
3. Enter your API key in the settings
4. Select your preferred language (Arabic users: RTL support is automatically enabled)
5. Configure file exclusions and smart linking preferences
6. Set your preferred analysis mode and similarity threshold

## Usage

### Main Features

**🧠 Vault Analysis**
- Command: "Perplexity: Analyze entire vault (MD files only)"
- Analyzes only markdown files in your vault
- Shows file type breakdown and exclusions
- Provides insights about your content themes

**📝 Spell Check & Format**  
- Command: "Perplexity: Check current file spelling and format"
- Right-click menu option on files
- Context-aware checking that preserves markdown syntax
- Supports Arabic, English, Spanish, French, and German

**🔗 Smart Links with AI Reasoning**
- Command: "Perplexity: Generate smart links with detailed reasoning"
- Two modes: Current file analysis or vault-wide analysis
- Detailed explanations for each suggestion
- Shows connection types and common themes
- Preview target files before adding links

**📖 Help & Documentation**
- Command: "Perplexity: Show help and documentation"
- Complete built-in documentation
- Usage examples and troubleshooting

### Interface

**Ribbon Icon**: Click the brain icon in the ribbon for quick access to all features

**Command Palette**: All features are accessible via the command palette (Ctrl/Cmd + P)

**Enhanced Smart Links Modal**: 
- Shows current file name in title
- Displays relevance percentages
- Provides detailed AI reasoning
- Shows connection types and themes
- Allows preview of target files

## Configuration

### API Settings
- **Perplexity API Key**: Your API key from perplexity.ai
- **Language**: Primary language for spell checking and analysis
- **RTL Support**: Automatic for Arabic, manual toggle for other RTL languages

### File Filtering Settings
- **Excluded Extensions**: Customize which file types to exclude from analysis
- **Visual Display**: See current exclusions in settings
- **Default Exclusions**: PDF, DOCX, images, archives, executables

### Smart Linking Settings
- **Analysis Mode**: Choose between Current File or All Files analysis
- **Maximum Suggestions**: Control how many suggestions to show (3-20)
- **Show Reasoning**: Toggle detailed explanations on/off
- **Similarity Threshold**: Control how selective the suggestions are (0.3-0.9)

### Performance Settings
- **Similarity Threshold**: Minimum similarity score for link suggestions
- **Enable Caching**: Cache API responses to reduce costs and improve speed
- **Batch Processing**: Control how many files are processed simultaneously

### Feature Toggles
- **Auto Format**: Automatically apply formatting fixes when spell checking
- **Smart Linking**: Enable/disable AI-powered link suggestions
- **RTL Support**: Right-to-left text direction for Arabic and other RTL languages

## How Smart Linking Works

### Analysis Process
1. **File Selection**: Plugin analyzes the current open file (shown in modal title)
2. **Content Analysis**: Perplexity AI examines the content and themes
3. **Comparison**: Compares with other markdown files (excluding PDFs, images, etc.)
4. **Relevance Scoring**: AI calculates similarity percentages
5. **Reasoning Generation**: AI explains why each link makes sense
6. **Theme Identification**: Finds common topics and concepts

### Connection Types
- **Conceptual**: Files sharing similar ideas or topics
- **Sequential**: Files that follow a logical sequence or progression
- **Complementary**: Files that provide additional or supporting information
- **Reference**: Files that cite or reference each other

### AI Reasoning Examples
- "Both files discuss machine learning concepts and share themes around neural networks and training data"
- "Sequential connection: This file appears to build upon the concepts introduced in the target file"
- "Complementary relationship: The target file provides practical examples for the theoretical concepts in this file"

## Arabic Language Support

This plugin provides comprehensive Arabic language support:

### Features for Arabic Users
- **Native Arabic spell checking** with proper grammar analysis
- **RTL interface** that automatically adjusts for Arabic content
- **Mixed content support** for Arabic text with English technical terms
- **Arabic typography** with proper font rendering
- **Semantic analysis** that understands Arabic context and meaning
- **Smart linking** that works with Arabic content and themes

### Setup for Arabic
1. Set language to "Arabic (العربية)" in plugin settings
2. RTL support is automatically enabled
3. Interface will adjust to right-to-left layout
4. Arabic fonts and typography will be applied
5. All modals and suggestions will display in RTL format

## API Usage & Costs

This plugin uses the Perplexity API, which may incur costs based on your usage:

- **Spell Checking**: Uses `sonar-small-chat` model (~$0.20 per 1M tokens)
- **Smart Link Analysis**: Uses `sonar-medium-online` model (~$1.00 per 1M tokens)
- **Caching**: Results are cached for 24 hours by default to minimize API calls
- **File Filtering**: Automatically excludes non-readable files to reduce unnecessary API calls

### Cost Optimization Tips
1. Enable caching (enabled by default)
2. Use appropriate similarity thresholds to limit suggestions
3. Configure file exclusions to avoid analyzing non-text files
4. Choose Current File mode for focused analysis vs All Files mode
5. Set reasonable maximum suggestions limit

## Development

### Building the Plugin
```bash
npm install
npm run build
```

### Development Mode
```bash
npm run dev
```

### Adding New Languages
1. Update the `getLanguageInstructions()` method in `PerplexityService`
2. Add language option to settings dropdown
3. Test with sample content in the target language
4. Update documentation

### Adding New File Exclusions
File exclusions can be customized in settings. The plugin automatically excludes:
- Document formats that contain binary data
- Compressed archives
- Executable files
- Image and media files

## Privacy & Security

- **API Keys**: Stored securely in Obsidian's encrypted settings
- **Data Privacy**: Only markdown file content is sent to Perplexity API for analysis
- **Local Processing**: File filtering and basic operations performed locally
- **No Data Storage**: No content is permanently stored on external servers
- **Smart Filtering**: Non-readable files are excluded from analysis automatically

## Support the Developer

If you find this plugin helpful, please consider supporting its continued development:

### 💖 Buy Me a Coffee
**[☕ Support on Buy Me a Coffee](https://buymeacoffee.com/YahyaZekry)**

Your support helps:
- 🚀 Add new features and language support
- 🐛 Fix bugs and improve performance
- 📚 Create better documentation
- 🌐 Expand multilingual capabilities
- 💝 Keep the plugin free for everyone

## Troubleshooting

### Common Issues

**"API key not configured"**
- Go to Settings → Community Plugins → Perplexity Vault Assistant
- Enter your API key from perplexity.ai

**Smart links not showing relevant results**
- Check your similarity threshold (try lowering it)
- Ensure you're using Current File mode for focused analysis
- Verify the current file has substantial content for analysis
- Check that target files are markdown (.md) and not excluded

**Arabic text not displaying properly**
- Enable RTL support in plugin settings
- Ensure your system has Arabic fonts installed
- Check that Obsidian's language settings support Arabic

**"No markdown files found" during vault analysis**
- Check your excluded extensions list
- Ensure you have .md files in your vault
- Verify files are not in excluded folders

**Plugin running slowly**
- Reduce batch processing size in settings
- Enable caching to avoid repeated API calls
- Use Current File mode instead of All Files mode
- Increase similarity threshold to get fewer, more relevant suggestions

### Debug Mode
Enable Developer Tools in Obsidian (View → Developer → Toggle Developer Tools) to see detailed logs and error messages.

### Getting Help
1. Check the built-in help system (Command: "Perplexity: Show help and documentation")
2. Review this README for setup and usage instructions
3. Report bugs on [GitHub Issues](https://github.com/yahyaZekry/obsidian-perplexity-plugin/issues)
4. Join discussions on [GitHub Discussions](https://github.com/yahyaZekry/obsidian-perplexity-plugin/discussions)

## Changelog

### v1.1.0 (2025-10-11)
- **NEW**: Enhanced smart linking with detailed AI reasoning
- **NEW**: Two analysis modes - Current File and All Files
- **NEW**: File type exclusion settings with visual display
- **NEW**: Connection type classification (Conceptual, Sequential, etc.)
- **NEW**: Common themes identification for link suggestions
- **NEW**: Preview target files before adding links
- **NEW**: Vault analysis now shows file type breakdown
- **IMPROVED**: Arabic and RTL language support
- **IMPROVED**: Enhanced UI with better link suggestion display
- **IMPROVED**: Performance optimizations for large vaults
- **IMPROVED**: Better error handling and user feedback

### v1.0.0 (2025-10-11)
- Initial release with basic features

## Roadmap

### Upcoming Features
- 📱 Mobile app optimization
- 🔍 Advanced search integration within suggestions
- 📊 Analytics dashboard for link suggestions
- 🎯 Custom dictionary management
- 🌍 Additional language support
- 🤖 More AI model options
- 📈 Link suggestion confidence learning

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Obsidian Plugin API](https://docs.obsidian.md/)
- Powered by [Perplexity AI](https://perplexity.ai)
- Arabic language support inspired by the Arabic-speaking Obsidian community
- Thanks to all contributors and supporters
- Special thanks for feedback on smart linking improvements

---

**Made with ❤️ for the global Obsidian community**

**[☕ Support the Developer](https://buymeacoffee.com/YahyaZekry)** • **[🐛 Report Issues](https://github.com/yahyaZekry/obsidian-perplexity-plugin/issues)** • **[💡 Request Features](https://github.com/yahyaZekry/obsidian-perplexity-plugin/discussions)**
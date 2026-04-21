# Discord Message Translator - Development Guidelines

## Project Overview

A Chrome Extension that automatically translates Discord messages, supporting multiple translation APIs with intelligent caching.

## Technology Stack

| Category | Choice |
|----------|--------|
| Runtime | Node.js v20+ |
| Language | TypeScript (no Vanilla JS) |
| Build Tool | Vite |
| Package Manager | npm |
| UI Library | DaisyUI (Tailwind CSS) |
| Storage | Chrome Storage API (chrome.storage.local, 10MB) |
| Extension | Manifest V3 |

## Directory Structure

```
src/
├── background/       # Service Worker
├── content/          # Content Script (injected into Discord)
├── popup/            # Popup UI
├── options/          # Settings page
├── lib/
│   ├── api/          # Translation API clients
│   ├── cache/        # Cache implementation (abstracted interface)
│   └── utils/        # Utility functions
└── types/            # TypeScript type definitions
```

## Coding Conventions

### General Rules
- Always use TypeScript with strict mode
- Prefer `const` over `let`; avoid `var`
- Use async/await over Promise chains
- Use meaningful variable and function names

### DOM Manipulation
- Use `textContent` for text injection (never `innerHTML` for user content)
- Sanitize all user inputs
- Prefer ID-based selectors over class-based for Discord elements (more stable)

### API Keys & Security
- Store API keys in `chrome.storage.sync` (Chrome auto-encrypts)
- Never expose API keys in DOM or console logs
- All external API calls go through Background Service Worker

### Error Handling
- Always wrap async operations in try-catch
- Log errors with context: `console.error('[ModuleName] Error description:', error)`
- Provide user-friendly error messages in UI

### Cache Design
- Use `ITranslationStorage` interface for all cache operations
- Implement LRU cleanup when storage exceeds 80% capacity
- Default TTL: 7 days

## Design Principles

1. **Abstraction**: Use interfaces for swappable implementations (e.g., storage backend)
2. **Performance First**: Only translate visible messages (Intersection Observer)
3. **Rate Limiting**: Debounce and queue API requests
4. **Graceful Degradation**: Multiple fallback selectors for Discord DOM changes

## Commit Strategy
- Keep commits focused and atomic

### Commit Conventions
Write clear commit messages using Conventional Commits (https://www.conventionalcommits.org/en/v1.0.0/) style.

- The subject MUST BE written in English whenever possible
- For everything else, use clear language, primarily English
- If you ask a user for a JIRA ticket or GitHub Issue number and receive a meaningful response, include `Refs: <Ticket>` in the footer (e.g., if no string is returned, there is no need to include it)

## Branch Strategy
- main: For Production. DO NOT PUSH DIRECTORY.
- develop: Integration Branch. MUST BE REQUIRED PR.
- feature/<short-description>: Feature Developments
- fix/<short-description>: Bug Fixes
- bugfix/<short-description>: Bug Fixes (same as fix)
- release/<version>: Release Candidates. MUST BE REQURIED PR.

Create these branches from the develop branch unless otherwise instructed.  
For example, fix branches for specific feature branches do not need to be create from develop.

## PR (Pull Request) Strategy
- Write subjects using Conventional Commits (https://www.conventionalcommits.org/en/v1.0.0/) style.
- All descriptions should be written in English by default

## References

- Architecture details: `docs/dev/ARCHITECTURE.md`
- User documentation: `README.md`

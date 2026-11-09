# Fanfic — recommendations for your taste

**English** · [Русский](README.ru.md)

An assistant that finds fanfiction to match your taste. You chat with it in Russian, and it:

- searches for new stories by fandom, pairing, and favorite author: directly on AO3, Author.Today, and Wattpad; with your permission, through web search on Ficbook, FanFiction.net, Quotev, Dreamwidth, and Feisovet;
- filters out unwanted tags, abandoned stories, and works you have already read;
- optionally reads descriptions, reviews, and excerpts to check stories against your preferences;
- builds a recommendation page you can open in a browser and save.

It remembers what you have read, what you disliked, and why. Rejected stories are excluded from later recommendations.

## Requirements

1. A computer; the workflow has been checked on macOS.
2. An AI assistant that can read and write local files and run commands. Compatibility with every model has not been tested. Instructions are available for [Claude Code](https://claude.com/claude-code); Codex and other assistants can read [AGENTS.md](AGENTS.md).
3. [Node.js](https://nodejs.org), which runs the search scripts. Development checks use its built-in `node --test` runner. No additional npm packages are required.
4. Browser access is useful for AO3. If a scripted request is blocked, the assistant can use your AO3 browser tab through a compatible browser tool or ask you to run the supplied snippet yourself.

## Getting started

Run these commands in a terminal:

```sh
git clone https://github.com/szmelikyan/fanfic.git ~/fanfic
cd ~/fanfic
cp config/config.example.json config/config.json
claude      # or the command for your AI assistant
```

Set `reader_name` to your name in `config/config.json`. Then talk to the assistant. At first launch it asks about language, fandoms, preferred and excluded tags, and whether stories must be complete, and saves your answers.

The reader conversation is currently configured for Russian. The English README documents the same workflow; it does not change that conversation setting.

## Things you can say

- `fanfic scan` — find new stories across all your fandoms;
- `fanfic scan <fandom>` — search one fandom;
- `fanfic settings` — view or change your preferences;
- “Here are my AO3 bookmarks; my username is …” — let the assistant learn from your existing favorites;
- “Already read it” or “Not for me, too much angst” — exclude the story and record the reason;
- “Search Ficbook too” — allow a web search on that platform.

## Your data

Preferences, notes, reading history, and discovered works are stored locally in `data/reader/`. These files are excluded from the program repository. If backups are configured, they are uploaded separately to your personal repository.

At the end of a session, the assistant can back up your reader data to a private GitHub repository. Configure this under `backup` in `config/config.json`.

For multiple readers, use a separate folder for each person, such as `~/fanfic` and `~/fanfic-<name>`, so their preferences stay separate.

## Website rules

The assistant follows the platform rules in [modes/fanfic.md](modes/fanfic.md). It does not bypass access controls, open restricted sections, download other people's stories for redistribution, or invent recommendations. On Ficbook, FanFiction.net, Quotev, Dreamwidth, and Feisovet, it uses web search and individual result pages only after you agree. Access and available metadata depend on the platform.

## For developers and other assistants

Read `AGENTS.md` for session steps, reader data rules, and equivalents for different assistants. `CLAUDE.md` loads those instructions for Claude Code. The skill in `.claude/skills/fanfic/` points to the workflow in `modes/fanfic.md`. Assistants without automatic skill discovery can read the Markdown files directly and run the same commands.

The command-line tools use Node.js without additional dependencies:

| File | Purpose |
| --- | --- |
| `fanfic.mjs` | Settings, scans of AO3/Author.Today/Wattpad, reviews, bookmarks, `check`, `similar`, and recommendation pages |
| `lib/fanfic.mjs` | Platform page parsing and tag filters |
| `lib/http.mjs`, `lib/bridge.mjs` | Requests with delays and caching; connection to the reader's AO3 browser tab |
| `reader.mjs` | Reader's rejected and completed stories |
| `scripts/fanfic-scan.sh` | Full scan in batches, for background or scheduled runs |
| `sync.mjs` | Git synchronization between readers' program copies, configured by `sync_with` |
| `backup.mjs` | Session-end reader data backup to a personal repository, configured by `backup` |

Run the existing tests from the repository root:

```sh
npm test
```

Core instructions are Markdown and configuration uses JSON. Browser access, web search, and optional Claude-specific UI features require equivalent tools in other environments; `AGENTS.md` describes the alternatives. This does not establish compatibility with every assistant.

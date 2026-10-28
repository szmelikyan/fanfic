# fanfic — прототип

ИИ-подбор фанфиков. Диалог ведёт Claude Code (агент читает `CLAUDE.md` и `modes/fanfic.md`), детерминированную работу делают Node-скрипты без зависимостей. Вынесено из `book-recs`: книги — там, фанфики — здесь.

## Запуск

```
cd ~/fanfic        # Света
cd ~/fanfic-marat  # Марат
claude
```

и пишите агенту: `fanfic scan`, `fanfic scan <фандом>`, `fanfic settings` или просто словами.

Настройки — `config/config.json` (образец — `config/config.example.json`):
- `reader_name` — хозяин папки;
- `sync_with` — копии других читателей, из которых `node sync.mjs` забирает правки скриптов;
- `book_recs` — папка книжной программы этого читателя: из её `data/fandoms.json` берутся теги AO3 книжных фандомов;
- `contact` — e-mail в User-Agent.

## Что где

| Файл | Назначение |
|---|---|
| `fanfic.mjs` | настройки, скан AO3 и Author.Today, отзывы, сохранёнки, `check`, `similar` |
| `lib/fanfic.mjs` | разбор страниц площадок и фильтры по тегам |
| `lib/http.mjs`, `lib/bridge.mjs` | запросы с паузами и кэшем; мост к вкладке AO3 в браузере читателя |
| `reader.mjs` | отвергнутые и прочитанные фики читателя |
| `scripts/fanfic-scan.sh` | полный скан по частям (для фона и расписания) |
| `sync.mjs` | синхронизация копий читателей через git |
| `data/reader/` | данные читателя: настройки, сканы, источники, заметки (не в git) |

## Тесты

```
npm test
```

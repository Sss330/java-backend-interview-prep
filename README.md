# java-backend-interview-prep

git config -f .gitmodules --remove-section submodule.themes/hugo-book   

## Локальный запуск

Установить Hugo 

https://gohugo.io/installation/

Склонировать проект

```bash
git clone --recurse-submodules git@github.com:zhukovsd/java-backend-interview-prep.git
```

Зайти в директорию проекта

```bash
cd java-backend-interview-prep
```
Запустить локальный сервер с проектом

```bash
hugo serve
```

Проект будет доступен на localhost:1313. Любое изменение в файлах проекта будет триггерить пересборку, т.е. все изменения будут отображаться на localhost

## Russian and English versions

All **382 technical questions and answers across 22 categories** are available
in both languages, including Java, Spring, microservices, databases, testing,
and deployment. The English home page, navigation, search, and table of contents
are localized too. Work-experience questions, thought exercises, live-coding
tasks, and external reading materials remain in their original language.

Russian URLs are unchanged. English pages use the `/en/` prefix; open
`/en/questions/` under the site's base URL for the full English question list.
The **Русский / English** links above the content switch the current page and
preserve question fragments. Both versions and the switcher work without
JavaScript. When JavaScript and browser storage are available, the preference
is remembered. `?lang=en` and `?lang=ru` override it, including on old collections
links. English URLs always explicitly select English.

English data is stored under `data/translations/en/tech-questions/`, mirroring
the paths in `data/tech-questions/`. The translation is static: the published
site makes no requests to a translation service. Initial prose drafts were
prepared with Google Translate, followed by editing of question wording and
technical terminology. Code structure and source links are retained; comments
and example text are translated. Selected technical clarifications are linked
to primary documentation in the answers.

When changing a question, update its English entry using the same ID. Each
English entry stores `source_hash`: SHA-256 of the original Russian question,
a newline, and its answer (UTF-8). Recompute the hash after reviewing the new
translation. Hugo rejects missing, duplicate, or stale translations; popularity
figures are read from the source so statistical updates do not require a new
translation. New categories also need matching `.en.md` content pages.

### Translation checks

The production build uses Hugo Extended 0.154.5. Data and browser checks are
provided in `scripts/check-translations.cjs` and `scripts/check-site-language.cjs`.
They check all categories, source hashes, code, tables, links, both locales,
English search, language persistence, mobile layout, and no-JavaScript behavior.

Example on Windows, keeping QA dependencies outside the repository:

```powershell
$qaModules = Join-Path $env:TEMP 'java-prep-browser-check'
npm install --prefix $qaModules @iarna/toml playwright --no-audit --no-fund
$qaModules = Join-Path $qaModules 'node_modules'
hugo --minify
node scripts/check-translations.cjs (Join-Path $qaModules '@iarna/toml')
node scripts/check-site-language.cjs (Join-Path $qaModules 'playwright') 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' (Join-Path $qaModules '@iarna/toml')
```

Use an installed Chromium browser's executable path for the browser argument.
The browser check serves the build locally and blocks external requests.

---

Новый контент можно добавлять с помощью Hugo для правильной работы с метадатой в .md файлах

```bash
hugo new content content/{file_name.md}
```

Сайт:
> https://zhukovsd.github.io/java-backend-interview-prep/

## Добавление новой категории вопросов

1. Добавить `.md` файл с контентом аналогичным другим файлам с категориями
2. Добавить пустой `.toml` файл который находится по тому же пути и с таким же названием как ранее созданный `.md` файл  
   Если файл категории создан по пути `/content/Прочее/FP.md`  
   То `.toml` файл должен быть создан по пути `/data/Прочее/FP.toml`  
3. Добавить новую категрию в `data-generator-config.toml`
   ```toml
   [[categories]]
   name = "Функциональное программирование"
   answers_filepath = "Прочее/FP.md"
   ```
4. Добавить новый лист в Google таблицу с ответам. Название листа соответствует паттерну в `data-generator-config.toml`. Текущий паттерн `Ответы - {}`, значит название листа должно быть `Ответы - Функциональное программирование`
5. Прогнать пайплайн для заполнения нового `.toml` файла данными из таблицы, смерджить PR

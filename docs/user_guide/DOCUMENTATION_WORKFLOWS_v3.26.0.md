# SMRITI Retail OS — Documentation Workflows Guide (v3.26.0)

## 1. What this guide covers

This page explains the top 5 documentation workflows that fit SMRITI Retail OS, plus the recommended "best of them" approach and how to create each type of documentation.

## 2. Top 5 documentation workflows

### 2.1 Markdown source + custom HTML renderer

- **Why it works:** clean authoring, version control friendly, easy content updates, and full control over presentation.
- **Best for:** manuals, user guides, release notes, and internal knowledge pages.
- **What we already have:** `docs/user_guide/*.md` and `scripts/render_user_manuals.mjs`.

### 2.2 Static documentation portal / site generator

- **Why it works:** automatic navigation, search, multi-page site structure, and documentation scalability.
- **Tools:** Docusaurus, VitePress, MkDocs, VuePress.
- **Best for:** expanding from a single manual into a full product documentation portal.

### 2.3 Standalone HTML pages with SVG and animation

- **Why it works:** eye-catching demo-style documentation and polished presentation for stakeholders.
- **Best for:** product showcases, training manuals, and executive demos.
- **Our current implementation:** `toot/*.html` generated with inline SVG and sleek CSS.

### 2.4 Central index page + versioned docs

- **Why it works:** provides a single entry point for all manuals and versioned releases.
- **Best for:** documentation portals where users need quick navigation across modules.
- **What we built:** `toot/index.html`.

### 2.5 Blueprint-first documentation design

- **Why it works:** separates planning from delivery, preserves expert intent, and supports future governance.
- **Best for:** product launch documentation, policy alignment, and roadmap-driven manuals.
- **What we built:** `docs/implementation/documentation/SMRITI_User_Manual_Blueprint_v3.26.0.md`.

## 3. Best-of-them recommendation

### Recommended approach

**Use Markdown source + custom HTML renderer as the primary workflow.**

### Why this is the best choice for SMRITI Retail OS

- It is already implemented and proven in the repo.
- It keeps the content authoring process simple.
- It enables elegant HTML output with modern styling.
- It is easy to extend into a static portal or additional module manuals.

## 4. How we create each documentation type

### 4.1 Create Markdown + custom HTML renderer

1. Author content in Markdown under `docs/user_guide/`.
2. Include clear section headings, bullet lists, and example workflows.
3. Run `node scripts/render_user_manuals.mjs`.
4. Open the generated HTML files in `toot/`.

### 4.2 Create a static documentation portal

1. Choose a static site generator: Docusaurus or VitePress.
2. Configure the site to read Markdown from `docs/user_guide/`.
3. Add a sidebar and search.
4. Build the site and deploy to `toot/` or a documentation hosting environment.

### 4.3 Create standalone HTML pages with SVG/animation

1. Render the Markdown pages to HTML.
2. Add CSS and SVG assets to the page shell.
3. Use animated backgrounds, cards, and hero sections.
4. Keep page content readable and accessible.

### 4.4 Create a central index page

1. Generate an `index.html` that lists every generated manual.
2. Keep titles and filenames easy to scan.
3. Add page styling and search hints.
4. Regenerate the index each time new manuals are added.

### 4.5 Create a blueprint-first manual

1. Draft the documentation blueprint in `docs/implementation/documentation/`.
2. Define purpose, audience, structure, scope, and validation.
3. Use the blueprint as a guide for authoring Markdown.
4. Keep the blueprint versioned with the product release.

## 5. What to do next

- Continue authoring manuals in Markdown.
- Keep the render script as the single source of truth for HTML output.
- Add new module manuals as `docs/user_guide/*.md` files.
- Use `toot/index.html` to review and share the docs with stakeholders.

## 6. Practical goal for today

Deliver a polished SMRITI documentation hub where:

- the manual source is Markdown,
- the generated output is modern HTML,
- the landing page is a sleek documentation index,
- the whole workflow supports future expansion.

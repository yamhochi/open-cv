# How resume-builder differs from open-slide

resume-builder runs on a local fork of [open-slide](https://github.com/open-slide/open-slide) (`@open-slide/core` 2.0.1, MIT, © Yiwei Ho). open-slide is a framework for writing presentations as React components. This fork adapts it to a single-page-document use case, a resume on A4 paper. The forked framework lives in [`framework/core/`](../framework/core).

## What changed

- **A4 canvas.** Pages are 794 × 1123 px (A4 portrait at 96 dpi) instead of 1920 × 1080. Thumbnails follow the canvas ratio, and PPTX export uses 96 dpi units so the exported page has the right physical size.
- **Present mode at 100%.** The page is shown at its real size (794px wide), centered, and scrolls when it is taller than the window. Left/right arrows change pages. Up/down, space and page up/down scroll. Mouse-wheel page turning is off.
- **Speaker notes removed.** The notes drawer, the presenter-view notes panel, the `notes` export, the notes editing endpoint and PPTX notes are gone. The presenter view (current page, next page, timer) remains.
- **Renamed interface.** "Slide" is "template" in the UI, and the app is called resume-builder.
- **Download button.** The editor toolbar has a labelled "Download" split button next to Present, built the same way. The main button exports a PDF and the chevron opens the full export menu (HTML, PDF, PPTX). It replaces the small icon button that used to sit in the middle of the toolbar.
- **New icon.** The sidebar logo and favicon are the pixel-art document icon (`framework/core/src/app/assets/logo.svg`, `favicon.svg`, and a 32×32 `favicon.ico` fallback) instead of the open-slide logo.
- **No in-app update.** The button that ran `pnpm up @open-slide/core` is removed, because it would replace this fork with the published package.
- **Rewritten authoring skills.** The coding-agent skills in `framework/core/skills/` describe a document-sized page (type scale, spacing, vertical budget) instead of a presentation slide, and document the `<Bullet>` / `<SubBullet text="…" />` convention that keeps every line separately editable.

Internal names are unchanged (`slides/`, `SlideModule`, `@open-slide/core`, `data-slide-loc`), so upstream code and tooling keep working.

## Where the changes live

| Area | Location |
| --- | --- |
| Framework source (editor UI, dev server, export) | `framework/core/src/` |
| Built framework files | `framework/core/dist/`, built from source by `pnpm install` and not committed |
| Authoring skills | `framework/core/skills/` |
| Unmodified upstream copy | git tag `upstream-src-2.0.1` |

To see exactly what the fork changed, diff against the tag:

```bash
git diff upstream-src-2.0.1 HEAD -- framework/core/src framework/core/skills
```

## Building

`framework/core/` is a normal source package, the same layout as upstream's `packages/core`. `pnpm install` builds it (`tsdown`, about a second) through the root `prepare` script, so `framework/core/dist/` always matches the source. To rebuild after editing the framework: `pnpm --filter @open-slide/core build`, then restart `pnpm dev`.

The source matches upstream 2.0.1 exactly except for the changes listed above. As a check, upstream's 2.0.1 source builds byte for byte to the `dist` that npm publishes.

## Updating from upstream

Don't run `pnpm up @open-slide/core`. It would replace the local fork with the npm package and undo the changes above. Two git references make an update an ordinary merge:

- `upstream-src-2.0.1` is upstream's 2.0.1 `packages/core`, unmodified, and is an ancestor of this branch.
- The same tag layout is used for each later release you take.

```bash
# 1. Put the new upstream release on its own branch, starting from the baseline
git switch -c upstream-src-X.Y.Z upstream-src-2.0.1
git clone --depth 1 --branch "@open-slide/core@X.Y.Z" https://github.com/open-slide/open-slide.git /tmp/open-slide-X.Y.Z
rsync -a --delete --exclude node_modules --exclude dist /tmp/open-slide-X.Y.Z/packages/core/ framework/core/
git add -A && git commit -m "Vendor @open-slide/core X.Y.Z unmodified" && git tag upstream-src-X.Y.Z

# 2. Merge it into your branch and resolve any conflicts in framework/core/src and skills/
git switch master
git merge upstream-src-X.Y.Z

# 3. Rebuild and check
pnpm install && pnpm sync:skills && pnpm dev
```

Conflicts show up only where upstream changed lines this fork also changed. As a dry run, merging upstream 2.1.0 (39 files changed since 2.0.1) into this fork conflicted in 9 files: 3 files the fork does not ship (the changelog and two e2e specs) and 6 it edited (the icons, `index.html`, the sidebar, `routes/slide.tsx` and the `slide-authoring` skill). Nothing was kept from that trial.

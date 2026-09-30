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
| Framework source (thumbnails, present mode, PPTX units, UI text) | `framework/core/src/` |
| Built framework files | `framework/core/dist/`, edited by `scripts/patch-framework-dist.mjs` |
| Authoring skills | `framework/core/skills/` |
| Unmodified upstream copy | git tag `upstream-2.0.1` |

To see exactly what the fork changed, diff against the tag:

```bash
git diff upstream-2.0.1 HEAD -- framework/core/src framework/core/skills
```

## Updating from upstream

Don't run `pnpm up @open-slide/core`. It would replace the local fork with the npm package and undo the changes above. The unmodified 2.0.1 copy is committed and tagged `upstream-2.0.1`, so git can merge a newer release against it:

```bash
# 1. Put the new upstream release on its own branch, starting from the baseline
git switch -c upstream-X.Y.Z upstream-2.0.1
npm pack @open-slide/core@X.Y.Z && tar -xzf open-slide-core-X.Y.Z.tgz
rsync -a --delete --exclude node_modules package/ framework/core/
git add -A && git commit -m "Vendor @open-slide/core X.Y.Z unmodified" && git tag upstream-X.Y.Z
rm -rf package open-slide-core-X.Y.Z.tgz

# 2. Merge it into your branch, then re-apply the changes to the built files
git switch master
git merge upstream-X.Y.Z          # will conflict in dist/ (hashed names); resolve src/ and skills/ by hand
git rm -rq framework/core/dist && git checkout upstream-X.Y.Z -- framework/core/dist
node scripts/patch-framework-dist.mjs
git add -A && git commit           # finish the merge

# 3. Reinstall and check
pnpm install && pnpm sync:skills && pnpm dev
```

`framework/core/dist/` is compiled output with hashed file names, so git can't merge it. Step 2 takes the new upstream `dist` and `scripts/patch-framework-dist.mjs` re-applies the fork's edits: A4 canvas, no speaker notes, disabled update button, and the "template" wording. The script fails loudly if upstream changed something it relies on. If it does, fix the script and re-run it on a fresh copy.

The `src/` changes (thumbnails, present mode, PPTX units, the removed notes UI) come through the git merge, so check them in the merge diff. This flow has not been run against a real newer release yet.

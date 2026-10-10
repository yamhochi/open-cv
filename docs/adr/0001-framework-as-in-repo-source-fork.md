---
status: accepted
---

# Keep the framework as an in-repo source fork under its original package name

The resume builder needs changes that open-slide's configuration cannot express (an A4 canvas, a different present mode, no speaker notes, a Word export), so it runs on a copy of open-slide's source in `framework/core/`, built on install, instead of the published `@open-slide/core` package. The package keeps its original name so slides, themes, skills and the framework's own import checks work unchanged.

## Considered options

- **Depend on the published package.** The canvas size and the plugin list are fixed inside the package, so none of the needed changes are possible this way.
- **Patch the compiled `dist`.** This was the first approach. The built files have hashed names, so git could not merge upstream updates into them, and every release needed a patch script.
- **A separate fork repository published to npm.** It would add a second repository, an npm scope and a publishing routine for a single consumer. It can be done later without undoing this decision.

## Consequences

- Taking an upstream release is a manual git merge, set up in `docs/FORK.md`.
- The name `@open-slide/core` is kept on purpose, as compatibility and an homage, not as a dependency. If the package is ever published, install it under that name with an npm alias.
- `framework/core/dist/` is not committed. `pnpm install` builds it.

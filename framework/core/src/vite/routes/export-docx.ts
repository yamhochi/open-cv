import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ViteDevServer } from 'vite';
import { SLIDE_ID_RE } from '../../editing/slide-ops.ts';
import { type ApiContext, json } from './context.ts';
import { findDocScript, docMarkdownPath, docRootOf } from './doc-markdown.ts';

// GET /__export-docx/:id   build docs/content/:id.md into a .docx with the project's
//                          scripts/doc/md-to-docx.mjs and return it as a download

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function run(
  script: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { cwd });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) => resolve({ code: 1, stderr: String(err) }));
    child.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });
}

export function registerExportDocxRoutes(server: ViteDevServer, ctx: ApiContext): void {
  server.middlewares.use('/__export-docx', async (req, res, next) => {
    if (req.method !== 'GET') return next();
    const url = new URL(req.url ?? '/', 'http://local');
    const match = url.pathname.match(/^\/([^/]+)$/);
    if (!match || !SLIDE_ID_RE.test(match[1])) return json(res, 400, { error: 'invalid slideId' });
    const slideId = match[1];

    const script = await findDocScript(ctx.userCwd);
    if (!script) return json(res, 404, { error: 'Word exporter not found (scripts/doc/md-to-docx.mjs)' });
    const root = docRootOf(script);
    const markdown = docMarkdownPath(root, slideId);
    try {
      await fs.access(markdown);
    } catch {
      return json(res, 404, { error: `no Content file at docs/content/${slideId}.md` });
    }

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'open-slide-docx-'));
    const out = path.join(tmp, `${slideId}.docx`);
    try {
      const { code, stderr } = await run(script, [slideId, out], root);
      if (code !== 0) return json(res, 500, { error: stderr.trim() || 'docx export failed' });
      const bytes = await fs.readFile(out);
      res.statusCode = 200;
      res.setHeader('Content-Type', DOCX_TYPE);
      res.setHeader('Content-Disposition', `attachment; filename="${slideId}.docx"`);
      res.setHeader('Content-Length', bytes.length);
      res.end(bytes);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
}

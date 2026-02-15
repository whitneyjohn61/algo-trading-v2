import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

/** Directory where docs live (relative to project root) */
const DOCS_DIR = path.resolve(__dirname, '../../../docs');

interface DocMeta {
  slug: string;
  title: string;
  category: string;
}

/**
 * Parse the HTML-comment metadata at the top of a markdown file.
 * Expected format: <!-- title: Display Title | category: User Guide -->
 */
function parseMeta(content: string, slug: string): DocMeta {
  const match = content.match(/<!--\s*title:\s*(.+?)\s*\|\s*category:\s*(.+?)\s*-->/);
  return {
    slug,
    title: match?.[1]?.trim() ?? slug,
    category: match?.[2]?.trim() ?? 'General',
  };
}

/**
 * GET /api/docs
 * List all available documentation topics with metadata.
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!fs.existsSync(DOCS_DIR)) {
      res.json({ success: true, data: [] });
      return;
    }

    const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
    const docs: DocMeta[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
      const slug = file.replace('.md', '');
      docs.push(parseMeta(content, slug));
    }

    // Sort: User Guide first, then Developer; alphabetical within each
    docs.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category === 'User Guide' ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    });

    res.json({ success: true, data: docs });
  } catch (err: any) {
    console.error('Error listing docs:', err.message);
    res.status(500).json({ error: 'Failed to list documentation' });
  }
});

/**
 * GET /api/docs/:slug
 * Get a single documentation file's content + metadata.
 */
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = req.params['slug'] as string;
    const filePath = path.join(DOCS_DIR, `${slug}.md`);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `Documentation not found: ${slug}` });
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const meta = parseMeta(content, slug);

    res.json({
      success: true,
      data: {
        ...meta,
        content,
      },
    });
  } catch (err: any) {
    console.error('Error reading doc:', err.message);
    res.status(500).json({ error: 'Failed to read documentation' });
  }
});

export default router;

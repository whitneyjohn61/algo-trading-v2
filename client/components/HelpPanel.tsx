'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, ChevronRight, Book, Code, FileText, AlertTriangle, BarChart3, TrendingUp, History, Wrench } from 'lucide-react';
import api from '@/lib/api';
import type { TabId } from './Sidebar';

interface DocMeta {
  slug: string;
  title: string;
  category: string;
}

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: TabId;
}

/** Map active dashboard tab to a default doc slug */
const TAB_DOC_MAP: Record<string, string> = {
  portfolio: 'PORTFOLIO',
  strategies: 'STRATEGIES',
  chart: 'STRATEGIES',
  backtest: 'BACKTESTING',
  accounts: 'SETUP',
  users: 'SETUP',
  system: 'TROUBLESHOOTING',
  settings: 'SETUP',
};

/** Icons for each doc slug */
const DOC_ICONS: Record<string, typeof Book> = {
  STRATEGIES: TrendingUp,
  PORTFOLIO: BarChart3,
  BACKTESTING: History,
  'RISK-MANAGEMENT': AlertTriangle,
  TROUBLESHOOTING: Wrench,
  SETUP: FileText,
  ARCHITECTURE: Code,
  'API-REFERENCE': Code,
  DEPLOYMENT: Code,
};

export function HelpPanel({ isOpen, onClose, activeTab }: HelpPanelProps) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  // Load doc list when panel opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    async function loadDocs() {
      setListLoading(true);
      try {
        const res = await api.docs.list();
        if (!cancelled && res.data) {
          setDocs(res.data);
        }
      } catch {
        // Silently fail — docs may not be available
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }

    loadDocs();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Auto-select context-relevant doc when panel opens
  useEffect(() => {
    if (!isOpen || docs.length === 0) return;

    const targetSlug = activeTab ? TAB_DOC_MAP[activeTab] : null;
    if (targetSlug && docs.some(d => d.slug === targetSlug)) {
      setSelectedSlug(targetSlug);
    } else if (!selectedSlug) {
      // Default to first doc if no context match
      setSelectedSlug(docs[0].slug);
    }
  }, [isOpen, docs, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load doc content when selection changes
  const loadContent = useCallback(async (slug: string) => {
    setLoading(true);
    setContent('');
    try {
      const res = await api.docs.get(slug);
      if (res.data?.content) {
        // Strip the metadata comment from display
        const cleaned = res.data.content.replace(/<!--[\s\S]*?-->\s*/, '');
        setContent(cleaned);
      }
    } catch {
      setContent('# Error\n\nFailed to load documentation.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSlug) {
      loadContent(selectedSlug);
    }
  }, [selectedSlug, loadContent]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const userGuideDocs = docs.filter(d => d.category === 'User Guide');
  const developerDocs = docs.filter(d => d.category === 'Developer');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[720px] max-w-full bg-white dark:bg-slate-800 shadow-2xl z-50 flex animate-slide-in-right">
        {/* Sidebar nav */}
        <div className="w-56 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 overflow-y-auto">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Book className="w-4 h-4" />
              Help &amp; Docs
            </h2>
          </div>

          {listLoading ? (
            <div className="p-4 text-xs text-slate-400">Loading...</div>
          ) : (
            <nav className="p-2">
              {userGuideDocs.length > 0 && (
                <DocSection
                  label="User Guide"
                  docs={userGuideDocs}
                  selectedSlug={selectedSlug}
                  onSelect={setSelectedSlug}
                />
              )}
              {developerDocs.length > 0 && (
                <DocSection
                  label="Developer"
                  docs={developerDocs}
                  selectedSlug={selectedSlug}
                  onSelect={setSelectedSlug}
                />
              )}
            </nav>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
              {docs.find(d => d.slug === selectedSlug)?.title ?? 'Documentation'}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Close help panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Markdown content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-sm text-slate-400">
                Loading documentation...
              </div>
            ) : (
              <article className="prose prose-sm dark:prose-invert prose-slate max-w-none
                prose-headings:scroll-mt-4
                prose-h1:text-xl prose-h1:font-bold prose-h1:mb-4
                prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3
                prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2
                prose-p:text-sm prose-p:leading-relaxed
                prose-li:text-sm
                prose-code:text-xs prose-code:bg-slate-100 prose-code:dark:bg-slate-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-slate-100 prose-pre:dark:bg-slate-900 prose-pre:text-xs prose-pre:rounded-lg
                prose-table:text-sm
                prose-th:text-left prose-th:font-semibold prose-th:px-3 prose-th:py-2 prose-th:bg-slate-50 prose-th:dark:bg-slate-700
                prose-td:px-3 prose-td:py-2 prose-td:border-t prose-td:border-slate-200 prose-td:dark:border-slate-600
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Sidebar section with category label and doc list */
function DocSection({
  label,
  docs,
  selectedSlug,
  onSelect,
}: {
  label: string;
  docs: DocMeta[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
        {label}
      </div>
      {docs.map(doc => {
        const Icon = DOC_ICONS[doc.slug] ?? FileText;
        const isActive = doc.slug === selectedSlug;
        return (
          <button
            key={doc.slug}
            onClick={() => onSelect(doc.slug)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
              isActive
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{doc.title}</span>
            {isActive && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

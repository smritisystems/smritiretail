/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 29.0.0
 * Created      : 2026-07-22
 * Modified     : 2026-07-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Article Viewer UI Component
 */

import React from 'react';
import { BookOpen, User, Calendar, Tag, ShieldCheck } from 'lucide-react';

interface ArticleProps {
  article: {
    id: string;
    category: string;
    title: string;
    summary: string;
    content: string;
    version: string;
    author: string;
    last_updated: string;
    tags: string[];
  };
}


export const ArticleViewer: React.FC<ArticleProps> = ({ article }) => {
  return (
    <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl p-8 shadow-xl">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-theme-divider">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-3 inline-block">
            {article.category}
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">{article.title}</h1>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-theme-surface-2 border border-theme-divider text-xs text-theme-body">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Version: <strong>{article.version}</strong></span>
        </div>
      </div>

      {/* Metadata Bar */}
      <div className="flex flex-wrap items-center gap-6 text-xs text-theme-muted mb-8 pb-6 border-b border-theme-divider">
        <div className="flex items-center gap-1.5">
          <User className="w-4 h-4 text-indigo-400" />
          <span>Author: <strong className="text-theme-heading">{article.author}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span>Updated: <strong className="text-theme-heading">{article.last_updated}</strong></span>
        </div>
      </div>

      {/* Summary Alert */}
      <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-200 text-xs leading-relaxed mb-8">
        <strong>Overview:</strong> {article.summary}
      </div>

      {/* Main Content Body */}
      <div className="prose prose-invert max-w-none text-theme-body text-sm leading-relaxed mb-8">
        <pre className="bg-theme-surface-3 p-4 rounded-xl border border-theme-divider font-mono text-xs text-indigo-300 whitespace-pre-wrap">
          {article.content}
        </pre>
      </div>

      {/* Tags Footer */}
      <div className="pt-6 border-t border-theme-divider flex items-center gap-2">
        <Tag className="w-4 h-4 text-theme-muted" />
        <div className="flex flex-wrap gap-2">
          {article.tags.map((tag, idx) => (
            <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-theme-surface-2 border border-theme-divider text-theme-muted">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

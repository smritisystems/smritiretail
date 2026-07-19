/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.1
 * Created      : 2026-07-10
 * Modified     : 2026-07-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { apiFetchV1 } from "../lib/apiFetch.ts";

interface WikiDoc {
  path: string;
  name: string;
  folder: string;
  title: string;
  snippet?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

interface WikiTabProps {
  onNotification: (title: string, message: string, type: "success" | "error") => void;
}

// Clean mapping of folder ids to beautiful human-readable module names
const FOLDER_NAMES: Record<string, string> = {
  "01-product": "Product Vision & Constitution",
  "02-user-guide": "Operations & User Guide",
  "03-admin-guide": "System Administration & Custodian",
  "04-installation": "Installation & Deployment",
  "05-developer": "Developer Runbooks & Pilots",
  "06-api": "API Integration Manuals",
  "07-kb": "Knowledge Base & FAQs",
  "08-architecture": "Architecture Change Proposals (ACP)",
  "09-release-notes": "System Release Logs",
  "Root": "General Documentation"
};

const SUGGESTED_QUESTIONS = [
  "What is the SMRITI core formula for Weeks of Cover (WOC)?",
  "Explain SMRITI OS Backup Encryption & Custodian Security.",
  "What are the integration specifications for Customer Growth Engine (CGE)?",
  "How are Barcodes validated in SMRITI OS?",
  "Detail the Tattly Threads pilot execution plan."
];

export const WikiTab: React.FC<WikiTabProps> = ({ onNotification }) => {
  const [docs, setDocs] = useState<WikiDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<WikiDoc[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Active Document
  const [activeDoc, setActiveDoc] = useState<WikiDoc | null>(null);
  const [activeContent, setActiveContent] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState<boolean>(false);

  // Copilot State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Greetings. I am the SMRITI Gyan Kendra Copilot. I have indexed the entire master documentation and knowledge base. Ask me any technical, operational, or architectural question about SMRITI Retail OS.",
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load all documents on mount
  useEffect(() => {
    fetchDocs();
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const data: WikiDoc[] = await apiFetchV1("/docs/list");
      setDocs(data);

      // Auto-select HOME, index, or first document if available
      const indexDoc = data.find(d => d.path.toLowerCase().includes("home")) ||
        data.find(d => d.path.toLowerCase().includes("index") || d.path.toLowerCase().includes("readme")) ||
        data[0];
      if (indexDoc) {
        handleSelectDoc(indexDoc);
      }
    } catch (err) {
      console.error(err);
      onNotification("Connection Error", "Could not reach SMRITI documentation server.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDoc = async (doc: WikiDoc) => {
    try {
      setActiveDoc(doc);
      setLoadingContent(true);
      const data = await apiFetchV1(`/docs/content?path=${encodeURIComponent(doc.path)}`);
      setActiveContent(data.content);
    } catch (err) {
      console.error(err);
      onNotification("Connection Error", "Could not fetch document content.", "error");
    } finally {
      setLoadingContent(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const data = await apiFetchV1(`/docs/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
  };

  const handleAskCopilot = async (questionText: string) => {
    if (!questionText.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: questionText,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const data = await apiFetchV1("/docs/ask", {
        method: "POST",
        body: JSON.stringify({ question: questionText })
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: data.reply,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      onNotification("Network Error", "Unable to reach SMRITI Copilot.", "error");
    } finally {
      setChatLoading(false);
    }
  };

  // Group docs by folder/module
  const groupedDocs = docs.reduce((acc, doc) => {
    const folder = doc.folder;
    if (!acc[folder]) {
      acc[folder] = [];
    }
    acc[folder].push(doc);
    return acc;
  }, {} as Record<string, WikiDoc[]>);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-[#121c3e]" id="smriti-wiki-desk">
      
      {/* LEFT COLUMN: Sidebar Navigation & Search */}
      <div className="w-full lg:w-80 bg-theme-surface-1 border-b lg:border-b-0 lg:border-r border-theme-divider flex flex-col h-1/3 lg:h-full">
        
        {/* Search header */}
        <div className="p-4 border-b border-theme-divider">
          <h3 className="font-display font-semibold text-xs text-theme-muted uppercase tracking-wider mb-2">Gyan Kendra Search</h3>
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search concepts, rules, guides..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value) clearSearch();
              }}
              className="w-full bg-theme-surface-4 text-theme-body text-xs px-3.5 py-2.5 rounded-lg border border-theme-divider focus:outline-none focus:border-[#2563EB] placeholder-[#4b5563]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-9 top-1/2 -translate-y-1/2 text-[#4b5563] hover:text-theme-body"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#2563EB] hover:bg-blue-600 text-white rounded p-1 flex items-center justify-center transition-all"
            >
              <span className="material-symbols-outlined text-xs">search</span>
            </button>
          </form>
        </div>

        {/* Documents Tree / Search results list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2 text-theme-muted">
              <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-mono">Indexing SMRITI Docs...</span>
            </div>
          ) : isSearching ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">Search Results ({searchResults.length})</span>
                <button onClick={clearSearch} className="text-[10px] text-theme-muted hover:text-theme-body underline font-mono">Back to Index</button>
              </div>

              {searchResults.length === 0 ? (
                <p className="text-xs text-theme-muted italic py-4">No matching SMRITI guidelines found. Try another query or ask the AI Copilot on the right panel.</p>
              ) : (
                searchResults.map(res => (
                  <button
                    key={res.path}
                    onClick={() => handleSelectDoc(res)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col space-y-1 ${
                      activeDoc?.path === res.path
                        ? "bg-[#1e2e5c] border-[#2563EB]"
                        : "bg-theme-surface-4 border-theme-divider hover:border-gray-500"
                    }`}
                  >
                    <span className="text-xs font-semibold text-theme-body font-display line-clamp-1">{res.title}</span>
                    <span className="text-[10px] text-theme-muted font-mono">{res.path}</span>
                    {res.snippet && (
                      <p className="text-[11px] text-theme-muted line-clamp-2 italic bg-theme-surface-1 p-1.5 rounded mt-1 border border-theme-divider border-dashed">
                        {res.snippet}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            Object.entries(groupedDocs).map(([folder, folderDocs]) => (
              <div key={folder} className="space-y-1.5">
                <h4 className="font-display font-bold text-[10px] text-theme-muted tracking-wider uppercase border-b border-theme-divider pb-1 flex items-center justify-between">
                  <span>{FOLDER_NAMES[folder] || folder}</span>
                  <span className="text-[9px] bg-theme-surface-3 px-1.5 py-0.2 rounded text-blue-300 font-mono font-medium">{folderDocs.length}</span>
                </h4>
                <div className="space-y-1 pl-1">
                  {folderDocs.map(doc => (
                    <button
                      key={doc.path}
                      onClick={() => handleSelectDoc(doc)}
                      className={`w-full text-left px-3 py-2 rounded text-xs transition-all flex items-center justify-between ${
                        activeDoc?.path === doc.path
                          ? "bg-[#2563EB] text-theme-body font-medium shadow"
                          : "text-theme-muted hover:bg-theme-surface-3 hover:text-theme-primary"
                      }`}
                    >
                      <span className="truncate pr-2">{doc.title}</span>
                      <span className="material-symbols-outlined text-[14px] opacity-60">description</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Architecture branding banner */}
        <div className="p-4 border-t border-theme-divider bg-theme-surface-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-blue-500 text-sm">security_update_good</span>
            <span className="text-[10px] text-theme-muted font-mono">GOVERNANCE VERIFIED</span>
          </div>
          <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-500 rounded px-1.5 py-0.2 font-mono">v1.0.1</span>
        </div>
      </div>

      {/* MIDDLE COLUMN: Document Reader */}
      <div className="flex-1 bg-[#121c3e] flex flex-col h-1/3 lg:h-full border-b lg:border-b-0 lg:border-r border-theme-divider overflow-hidden">
        
        {/* Document Header */}
        <div className="px-6 py-4 bg-theme-surface-1 border-b border-theme-divider flex items-center justify-between">
          <div>
            {activeDoc ? (
              <>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-blue-400 font-mono uppercase tracking-widest">{activeDoc.folder}</span>
                  <span className="text-[10px] text-[#4b5563] font-mono">•</span>
                  <span className="text-[10px] text-theme-muted font-mono">{activeDoc.name}</span>
                </div>
                <h2 className="font-display font-bold text-base text-theme-body tracking-tight mt-0.5">{activeDoc.title}</h2>
              </>
            ) : (
              <h2 className="font-display font-bold text-base text-theme-muted">No Document Selected</h2>
            )}
          </div>

          {activeDoc && (
            <button
              onClick={() => handleAskCopilot(`Explain this document: ${activeDoc.title}`)}
              className="bg-theme-surface-4 hover:bg-black border border-theme-divider text-blue-300 hover:text-theme-body px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-2 transition-all shadow-md"
            >
              <span className="material-symbols-outlined text-xs">smart_toy</span>
              <span>Ask AI About Page</span>
            </button>
          )}
        </div>

        {/* Document Content Box */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loadingContent ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-theme-muted font-mono">De-serializing SMRITI manifest segment...</p>
            </div>
          ) : activeContent ? (
            <article className="prose prose-invert max-w-none text-[#cbd5e1] text-xs leading-relaxed space-y-4">
              <div className="markdown-body">
                <ReactMarkdown>{activeContent}</ReactMarkdown>
              </div>
            </article>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-theme-muted py-20 space-y-4">
              <span className="material-symbols-outlined text-4xl opacity-40">find_in_page</span>
              <p className="text-xs max-w-sm text-center">Select an official SMRITI master document or rule guidebook from the left panel index to explore the single source of truth.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: AI Copilot Assistant */}
      <div className="w-full lg:w-96 bg-theme-surface-1 flex flex-col h-1/3 lg:h-full overflow-hidden">
        
        {/* Copilot Header */}
        <div className="px-5 py-4 bg-theme-surface-4 border-b border-theme-divider flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white border border-theme-divider">
              <span className="material-symbols-outlined text-sm">smart_toy</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-xs text-theme-body">SMRITI Gyan Kendra Copilot</h3>
              <p className="text-[10px] text-emerald-400 font-mono">Grounded LLM Explorer • Online</p>
            </div>
          </div>

          <button
            onClick={() => {
              setChatMessages([
                {
                  id: "welcome",
                  role: "assistant",
                  text: "Greetings. I am the SMRITI Gyan Kendra Copilot. I have indexed the entire master documentation and knowledge base. Ask me any technical, operational, or architectural question about SMRITI Retail OS.",
                  timestamp: new Date()
                }
              ]);
            }}
            className="text-theme-muted hover:text-theme-body"
            title="Reset Chat Session"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center space-x-1 text-[9px] text-theme-muted font-mono">
                <span>{msg.role === "user" ? "OPERATOR" : "SMRITI EXPERT AI"}</span>
                <span>•</span>
                <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed border ${
                  msg.role === "user"
                    ? "bg-[#2563EB] border-blue-500 text-theme-body"
                    : "bg-theme-surface-4 border-theme-divider text-theme-primary"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="markdown-body text-[11px] space-y-1.5 leading-relaxed">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="flex flex-col space-y-1 items-start">
              <span className="text-[9px] text-theme-muted font-mono">SMRITI EXPERT AI • CONSULTING LOCAL INDEX</span>
              <div className="bg-theme-surface-4 border border-theme-divider rounded-xl px-4 py-3 text-xs text-theme-muted flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggested Questions Section */}
        <div className="px-5 py-2.5 bg-theme-surface-4 border-t border-b border-theme-divider">
          <span className="text-[9px] text-theme-muted font-mono uppercase tracking-wider block mb-1.5">Common Inquiries:</span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
            {SUGGESTED_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleAskCopilot(q)}
                disabled={chatLoading}
                className="text-[10px] text-theme-muted hover:text-theme-body bg-theme-surface-1 hover:bg-theme-surface-3 border border-theme-divider rounded-md px-2 py-1 transition-all text-left truncate max-w-full disabled:opacity-50 disabled:pointer-events-none"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <div className="p-4 bg-theme-surface-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskCopilot(chatInput);
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              placeholder="Ask anything about SMRITI..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
              className="flex-1 bg-theme-surface-1 text-theme-body text-xs px-3.5 py-3 rounded-lg border border-theme-divider focus:outline-none focus:border-[#2563EB] disabled:opacity-50 placeholder-[#4b5563]"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#1e2e5c] disabled:text-[#4b5563] text-white rounded-lg p-3 flex items-center justify-center transition-all shadow-lg"
            >
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

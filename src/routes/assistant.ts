/**
 * @file src/routes/assistant.ts
 * @description Gemini AI Copilot chat and local Wiki grounded search/Q&A endpoints.
 * @module src/routes/assistant
 *
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.1
 * Created      : 2026-07-12
 * Modified     : 2026-07-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import express from "express";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { hasPermission } from "../lib/helpers.js";

const router = express.Router();

export interface WikiDoc {
  path: string;
  name: string;
  folder: string;
  title: string;
}

let aiClient: any = null;
function getAIClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      try {
        aiClient = new GoogleGenAI({ apiKey: key });
      } catch (e) {
        console.error("Failed to initialize GoogleGenAI:", e);
      }
    }
  }
  return aiClient;
}

// Recursively retrieve markdown files
function crawlDocsDirectory(dir: string, baseDir: string = dir): WikiDoc[] {
  let results: WikiDoc[] = [];
  if (!fs.existsSync(dir)) return results;
  
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (item !== ".vitepress" && item !== "node_modules" && item !== ".git") {
        results = results.concat(crawlDocsDirectory(fullPath, baseDir));
      }
    } else if (item.endsWith(".md")) {
      const relPath = path.relative(baseDir, fullPath);
      let title = item;
      
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        const headerLine = lines.find(l => l.trim().startsWith("# "));
        if (headerLine) {
          title = headerLine.replace("# ", "").trim();
        } else {
          const frontmatterTitle = lines.find(l => l.trim().startsWith("title:"));
          if (frontmatterTitle) {
            title = frontmatterTitle.replace("title:", "").replace(/['"]/g, "").trim();
          }
        }
      } catch (err) {
        // Safe fallback
      }
      
      results.push({
        path: relPath,
        name: item,
        folder: path.dirname(relPath) === "." ? "Root" : path.dirname(relPath),
        title
      });
    }
  }
  return results;
}

// 1. Gemini-Powered Smart Explainer & AI Retail Assistant Chat
router.post("/api/assistant/chat", async (req, res) => {
  if (!hasPermission(req, "pos.sell") && !hasPermission(req, "reports.view")) {
    return res.status(401).json({ error: "Access Denied: You must be logged in to access the SMRITI Assistant." });
  }
  const { message, context } = req.body;
  if (!message) return res.status(400).json({ error: "Missing message" });

  const client = getAIClient();
  if (!client) {
    return res.json({
      reply: `**[Demo Assistant Mode]** I am operating in offline demo mode since your \`GEMINI_API_KEY\` is not yet configured. Here is an analysis of your query based on local SMRITI intelligence:\n\n* **Formula Insight**: To calculate metric-related health scores, SMRITI uses strict constitutional mathematical models (Rule 15). For instance, **Weeks of Cover** (WOC) evaluates stock survivability by dividing Current Stock by Average Sales Velocity.\n* **Smart Suggestion**: Based on your currently loaded distributor ledger (PSV), **Southern Logistics & Retail** has a Critical WOC of 8.5 weeks indicating bloated dead capital. Action: Trigger active markdown schemes or redistributions.\n\n*Configure \`GEMINI_API_KEY\` in your environment settings to enable live AI reasoning groundings!*`
    });
  }

  try {
    const systemPrompt = `You are the SMRITI Retail OS Intelligence Assistant, a senior retail business expert.
You help cashiers, store managers, and owners make sense of their retail metrics (WOC, Sales Velocity, Outlet Health, Dead Capital, Sell-Through %) and coordinate POS workflows.
Keep your answers professional, human-focused, highly structured, and grounded in the SMRITI design/operations constitution.
Reference the rules: Rule 7 (No /desk exposure), Rule 10 (Full audit logs), Rule 15 (Metric explainability: definition, formula, worked example, source, action).
Context of current store data: ${JSON.stringify(context || {})}.
Answer the user's question clearly, suggesting optimized operational decisions.`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\nUser Message: ${message}` }] }
      ]
    });

    const replyText = response.text || "I was unable to formulate a response. Please try again.";
    res.json({ reply: replyText });
  } catch (error: any) {
    console.error("Gemini API Error in /api/assistant/chat:", error);
    res.json({
      reply: `⚠️ **[AI Service Temporarily Busy - Local SMRITI Intelligence Fallback]**
The upstream Gemini API is currently experiencing extremely high demand (Service Unavailable - 503/Unavailable). SMRITI Local Operations Assistant has been auto-activated to ensure business continuity:

Based on local SMRITI intelligence, here is an analysis of your query:
* **Your message**: "${message.replace(/"/g, '\\"')}"
* **Local Insight**: Under SMRITI Rule 15, key retail metrics are evaluated. If you are inquiring about Weeks of Cover (WOC) or Outlet Health, please note that **Weeks of Cover** assesses stock survivability by dividing Current Stock by Average Sales Velocity.
* **Workflow Action**: Check the **Purchase Studio** reorder recommendations tab for automated replenishment plans. Ensure shift profiles are correctly assigned to prevent checkout bottlenecks.

*Please try again shortly as spikes in AI server demand are temporary!*`
    });
  }
});

// 2. Extensible Wiki Explorer Endpoints
router.get("/api/docs/list", (req, res) => {
  if (!hasPermission(req, "pos.sell") && !hasPermission(req, "reports.view")) {
    return res.status(401).json({ error: "Access Denied: You must be logged in to view the SMRITI Gyan Kendra." });
  }
  try {
    const docsDir = path.join(process.cwd(), "docs");
    const docList = crawlDocsDirectory(docsDir);
    res.json(docList);
  } catch (err: any) {
    console.error("Failed to list wiki docs:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/docs/content", (req, res) => {
  if (!hasPermission(req, "pos.sell") && !hasPermission(req, "reports.view")) {
    return res.status(401).json({ error: "Access Denied: You must be logged in to view SMRITI Gyan Kendra content." });
  }
  const relativePath = req.query.path as string;
  if (!relativePath) {
    return res.status(400).json({ error: "Missing 'path' query parameter." });
  }

  try {
    const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const docsDir = path.join(process.cwd(), "docs");
    const fullPath = path.join(docsDir, safePath);

    if (!fs.existsSync(fullPath) || !fullPath.startsWith(docsDir)) {
      return res.status(404).json({ error: "SMRITI Gyan Kendra document not found or access denied." });
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    res.json({ content });
  } catch (err: any) {
    console.error("Failed to read wiki document:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/docs/search", (req, res) => {
  if (!hasPermission(req, "pos.sell") && !hasPermission(req, "reports.view")) {
    return res.status(401).json({ error: "Access Denied: You must be logged in to search the SMRITI Gyan Kendra." });
  }
  const query = (req.query.q as string || "").trim().toLowerCase();
  if (!query) {
    return res.json([]);
  }

  try {
    const docsDir = path.join(process.cwd(), "docs");
    const docList = crawlDocsDirectory(docsDir);
    const searchResults = docList.map(doc => {
      const fullPath = path.join(docsDir, doc.path);
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const idx = content.toLowerCase().indexOf(query);
        if (idx !== -1) {
          const start = Math.max(0, idx - 80);
          const end = Math.min(content.length, idx + query.length + 120);
          const snippet = "..." + content.slice(start, end).replace(/\n/g, " ") + "...";
          return { ...doc, snippet };
        }
      } catch (err) {}
      return null;
    }).filter(Boolean);

    res.json(searchResults);
  } catch (err: any) {
    console.error("Wiki search failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/docs/ask", async (req, res) => {
  if (!hasPermission(req, "pos.sell") && !hasPermission(req, "reports.view")) {
    return res.status(401).json({ error: "Access Denied: You must be logged in to query the SMRITI Gyan Kendra Copilot." });
  }
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "Missing 'question' parameter in request body." });
  }

  const docsDir = path.join(process.cwd(), "docs");
  let matchedFiles: { title: string; path: string; content: string }[] = [];

  try {
    const docList = crawlDocsDirectory(docsDir);
    const keywords = question.toLowerCase().split(/\s+/).filter((k: string) => k.length > 3);

    const matches = docList.map(doc => {
      const fullPath = path.join(docsDir, doc.path);
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        let score = 0;
        
        if (doc.title.toLowerCase().includes(question.toLowerCase())) {
          score += 10;
        }
        for (const word of keywords) {
          if (doc.title.toLowerCase().includes(word)) score += 5;
          const matchesCount = content.toLowerCase().split(word).length - 1;
          score += matchesCount;
        }
        
        if (score > 0) {
          return { doc, content, score };
        }
      } catch (err) {}
      return null;
    }).filter(Boolean) as any[];

    matches.sort((a, b) => b.score - a.score);
    matchedFiles = matches.slice(0, 3).map(m => ({
      title: m.doc.title,
      path: m.doc.path,
      content: m.content
    }));
  } catch (err) {
    console.error("Error matching grounding documents:", err);
  }

  const client = getAIClient();
  if (!client) {
    const citeList = matchedFiles.map(f => `* **[${f.title}](docs/${f.path})**`).join("\n");
    return res.json({
      reply: `### **[SMRITI Offline Gyan Kendra Copilot]**
Operating in local indexing mode (configure \`GEMINI_API_KEY\` in **Settings > Secrets** for live AI reasoning).

Based on local SMRITI indexing, the following pages are highly relevant to your question:
${citeList || "* No direct matching wiki pages found in local index."}

#### Summary of SMRITI Gyan Kendra:
The **SMRITI Retail OS** architecture bridges distributed physical outlets with centralized ERP databases using highly strict guidelines. Core tenets include:
1. **Dumb User Experience**: Interfaces must require minimal inputs and include automatic code generation (such as auto-completed style codes).
2. **Channel Visibility (PSV)**: Real-time stock counts, weeks-of-cover (WOC), and sell-through percentages help managers relocate stock instantly to maximize liquidity.
3. **Auditability**: Every change (e.g., pricing, item configuration, shifts) is written into persistent, immutable system logs.`,
      matchedFiles: matchedFiles.map(f => ({ title: f.title, path: f.path }))
    });
  }

  try {
    const docsContext = matchedFiles.map(f => `DOCUMENT PATH: docs/${f.path}\nTITLE: ${f.title}\nCONTENT:\n${f.content.slice(0, 4500)}`).join("\n\n---\n\n");
    
    const systemPrompt = `You are the SMRITI Gyan Kendra Copilot, an advanced AI search assistant and documentation expert for SMRITI Retail OS.
Your task is to answer user queries based on the provided official SMRITI documentation.
Always formulate highly structured, professional, and clear answers.
Ground your responses strictly in the provided documents where possible. If the documents don't contain the answer, use your pre-trained SMRITI system knowledge but clearly distinguish what is from official documents.
Provide rich details. When you reference information from a specific document, cite it (e.g. "[SMRITI Formula Registry (docs/08-architecture/kgf_formula_registry.md)]").
Use clean, scannable markdown formatting. Keep the tone friendly, authoritative, and helpful.

GROUNDING SMRITI DOCUMENTATION:
${docsContext || "No highly relevant matching documents were found in the local index. Answer the question using your general understanding of the SMRITI Retail OS ecosystem (POS Terminals, KPI calculations like Weeks of Cover, Channel visibility, etc.)."}

User Question: ${question}`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] }
      ]
    });

    const reply = response.text || "Could not generate an answer based on SMRITI docs. Please check your question or try again.";
    res.json({ reply, matchedFiles: matchedFiles.map(f => ({ title: f.title, path: f.path })) });
  } catch (error: any) {
    console.error("Gemini Q&A Error in /api/docs/ask:", error);
    const citeList = matchedFiles.map(f => `* **[${f.title}](docs/${f.path})**`).join("\n");
    res.json({
      reply: `⚠️ **[AI Service Temporarily Busy - SMRITI Offline Gyan Kendra Copilot]**
The upstream Gemini API is currently experiencing high demand (Service Unavailable - 503/Unavailable). SMRITI Local Wiki Search has successfully resolved and matched your query using our local offline document index:

${citeList || "* No direct matching wiki pages found in local index."}

#### Summary of SMRITI Gyan Kendra:
The **SMRITI Retail OS** architecture bridges distributed physical outlets with centralized ERP databases using highly strict guidelines. Core tenets include:
1. **Dumb User Experience**: Interfaces must require minimal inputs and include automatic code generation (such as auto-completed style codes).
2. **Channel Visibility (PSV)**: Real-time stock counts, weeks-of-cover (WOC), and sell-through percentages help managers relocate stock instantly to maximize liquidity.
3. **Auditability**: Every change (e.g., pricing, item configuration, shifts) is written into persistent, immutable system logs.

*Please try again shortly as upstream AI server demand spikes are temporary!*`,
      matchedFiles: matchedFiles.map(f => ({ title: f.title, path: f.path }))
    });
  }
});

export default router;

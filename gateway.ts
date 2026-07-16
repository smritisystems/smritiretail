import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { URL } from "url";

const PORT = parseInt(process.env.PORT || "3000", 10);
const PYTHON_CORE_HOST = process.env.PYTHON_CORE_HOST || "127.0.0.1:8000";
const DEST_PATH = path.resolve(process.cwd(), "dist");
const INDEX_HTML = path.join(DEST_PATH, "index.html");
const pythonCoreUrl = PYTHON_CORE_HOST.includes("://") ? PYTHON_CORE_HOST : `http://${PYTHON_CORE_HOST}`;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".mjs": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".map": "application/octet-stream",
  ".txt": "text/plain; charset=UTF-8",
  ".wasm": "application/wasm",
};

function getContentType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function sendIndexHtml(res: http.ServerResponse): void {
  if (!fs.existsSync(INDEX_HTML)) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=UTF-8" });
    res.end("Error: Missing dist/index.html. Run npm run build first.");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });
  fs.createReadStream(INDEX_HTML).pipe(res);
}

function serveStaticFile(filePath: string, res: http.ServerResponse): void {
  const resolvedPath = path.resolve(DEST_PATH, filePath);
  if (!resolvedPath.startsWith(DEST_PATH)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=UTF-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" });
      res.end("Not Found");
      return;
    }

    res.writeHead(200, { "Content-Type": getContentType(resolvedPath) });
    fs.createReadStream(resolvedPath).pipe(res);
  });
}

function proxyApiRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (!req.url) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=UTF-8" });
    res.end("Invalid request URL.");
    return;
  }

  const targetUrl = new URL(`${pythonCoreUrl}${req.url}`);
  const client = targetUrl.protocol === "https:" ? https : http;
  const headers = { ...req.headers } as Record<string, string>;
  headers.host = targetUrl.host;

  const proxy = client.request(
    {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers as http.OutgoingHttpHeaders);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxy.on("error", (error) => {
    res.writeHead(502, { "Content-Type": "application/json; charset=UTF-8" });
    res.end(JSON.stringify({ error: "Upstream python-core proxy failed.", details: String(error) }));
  });

  req.pipe(proxy, { end: true });
}

const HEALTH_CHECK_PATHS = new Set(["/ready", "/version", "/live", "/metrics"]);

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(parsedUrl.pathname || "");

  if (pathname.startsWith("/api/v1") || HEALTH_CHECK_PATHS.has(pathname)) {
    proxyApiRequest(req, res);
    return;
  }

  if (pathname === "/") {
    sendIndexHtml(res);
    return;
  }

  const staticPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const filePath = path.join(DEST_PATH, staticPath);
  const ext = path.extname(filePath);

  if (ext) {
    serveStaticFile(staticPath, res);
    return;
  }

  sendIndexHtml(res);
});

server.listen(PORT, () => {
  console.log(`SMRITI static server is running on http://0.0.0.0:${PORT}`);
  console.log(`Proxying /api/v1 requests to ${pythonCoreUrl}`);
});

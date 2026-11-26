const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../vercel.json');
const REPO_ROOT = path.join(__dirname, '..');
const SITE = path.join(REPO_ROOT, 'site');
const PUBLIC_CONTENT_ROOTS = new Set([
  'certifications', 'glossary', 'i18n', 'interviews', 'landscape', 'manuals', 'phases', 'projects',
]);
const PUBLIC_CONTENT_EXTENSIONS = new Set([
  '.css', '.html', '.jl', '.js', '.json', '.md', '.mjs', '.png', '.py', '.rs', '.svg', '.toml', '.ts', '.txt', '.webp', '.yaml', '.yml',
]);
const MIME_TYPES = {
  '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon', '.jl': 'text/plain', '.js': 'application/javascript',
  '.json': 'application/json', '.md': 'text/markdown', '.mjs': 'application/javascript', '.png': 'image/png',
  '.py': 'text/plain', '.rs': 'text/plain', '.svg': 'image/svg+xml', '.toml': 'text/plain', '.ts': 'text/plain',
  '.txt': 'text/markdown', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml', '.yaml': 'text/plain', '.yml': 'text/plain',
};
const handlers = {
  '/api/markdown': require('../api/markdown'), '/api/v1/markdown': require('../api/v1/markdown'),
  '/api/v1/catalog': require('../api/v1/catalog'), '/api/v1/resource': require('../api/v1/resource'),
  '/api/mcp': require('../api/mcp'), '/api/not-found': require('../api/not-found'),
  '/api/lesson': require('../api/lesson'), '/api/certification': require('../api/certification'),
  '/api/og': require('../api/og'),
};

function queryObject(params) {
  const result = Object.create(null);
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
}

function matches(rule, req) {
  return (rule.has || []).every(condition => {
    const insensitive = condition.value.startsWith('(?i)');
    const pattern = new RegExp(insensitive ? condition.value.slice(4) : condition.value, insensitive ? 'i' : '');
    return condition.type === 'header' && pattern.test(req.headers[condition.key] || '');
  });
}

function compile(source) {
  const names = [];
  const pattern = source.replace(/:(\w+)\(([^)]+)\)/g, (_, name, body) => { names.push(name); return `(${body})`; }).replace(/\.html$/, '\\.html');
  return { names, regex: new RegExp('^' + pattern + '$') };
}

function fill(destination, names, match) {
  return names.reduce((out, name, index) => out.replace(`:${name}`, match[index + 1] || ''), destination);
}

function publicRepositoryContent(pathname) {
  const rawSegments = pathname.split('/').slice(1);
  if (rawSegments[rawSegments.length - 1] === '') rawSegments.pop();
  if (!rawSegments.length || rawSegments.some(segment => !segment)) return null;

  let segments;
  try {
    segments = rawSegments.map(segment => decodeURIComponent(segment));
  } catch {
    return null;
  }
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.startsWith('.') || /[\\/\0]/.test(segment))) return null;
  if (!PUBLIC_CONTENT_ROOTS.has(segments[0])) return null;

  const filename = path.resolve(REPO_ROOT, ...segments);
  if (!filename.startsWith(REPO_ROOT + path.sep)) return null;

  let actualPath;
  let stat;
  try {
    actualPath = fs.realpathSync(filename);
    if (!actualPath.startsWith(REPO_ROOT + path.sep)) return null;
    stat = fs.statSync(actualPath);
  } catch {
    return null;
  }

  if (!stat.isDirectory() && (!stat.isFile() || !PUBLIC_CONTENT_EXTENSIONS.has(path.extname(actualPath).toLowerCase()))) return null;
  return { filename: actualPath, isDirectory: stat.isDirectory(), size: stat.isFile() ? stat.size : null };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function directoryListing(directory, pathname) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.') && !entry.isSymbolicLink())
    .filter(entry => entry.isDirectory() || PUBLIC_CONTENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const links = entries.map(entry => {
    const name = entry.name + (entry.isDirectory() ? '/' : '');
    const href = encodeURIComponent(entry.name) + (entry.isDirectory() ? '/' : '');
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(name)}</a></li>`;
  }).join('');
  const label = `Directory listing for ${pathname}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(label)}</title></head><body><h1>${escapeHtml(label)}</h1><ul>${links}</ul></body></html>`;
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/site' || url.pathname.startsWith('/site/')) {
        const destination = url.pathname.slice('/site'.length) || '/';
        res.writeHead(308, { Location: destination + url.search });
        return res.end();
      }
      for (const rule of config.redirects || []) {
        const { names, regex } = compile(rule.source);
        const match = url.pathname.match(regex);
        if (!match || (rule.missing || []).some(condition => url.searchParams.has(condition.key))) continue;
        const destination = fill(rule.destination, names, match);
        res.writeHead(rule.permanent ? 308 : 307, { Location: destination + url.search });
        return res.end();
      }
      for (const rule of config.headers) if (new RegExp('^' + rule.source + '$').test(url.pathname)) {
        for (const header of rule.headers) res.setHeader(header.key, header.value);
      }
      let destination = url.pathname;
      let routed = false;
      for (const rule of config.routes) {
        const match = url.pathname.match(new RegExp('^' + rule.src + '$'));
        if (match && (!rule.methods || rule.methods.includes(req.method)) && matches(rule, req)) {
          destination = rule.dest.replace(/\$(\d+)/g, (_, n) => match[Number(n)]);
          routed = true;
          break;
        }
      }
      const isFile = name => {
        const filename = path.resolve(SITE, '.' + name);
        return filename.startsWith(SITE + path.sep) && fs.existsSync(filename) && fs.statSync(filename).isFile();
      };
      if (!routed && destination === '/') destination = '/index.html';
      if (!routed && !handlers[destination] && !isFile(destination)) {
        const paramMatch = rule => /:\w+\(/.test(rule.source) && url.pathname.match(compile(rule.source).regex);
        const rule = config.rewrites.find(rule => ((rule.source === url.pathname || paramMatch(rule)) && matches(rule, req))
          || (rule.source === '/api/:missing*' && url.pathname.startsWith('/api/')));
        if (rule) destination = fill(rule.destination, compile(rule.source).names, paramMatch(rule) || []);
      }
      const target = new URL(destination, 'http://127.0.0.1');
      for (const [key, value] of target.searchParams) url.searchParams.append(key, value);
      req.query = queryObject(url.searchParams);
      if (handlers[target.pathname]) return await handlers[target.pathname](req, res);
      const siteFilename = path.resolve(SITE, '.' + target.pathname);
      const siteFileExists = siteFilename.startsWith(SITE + path.sep)
        && fs.existsSync(siteFilename) && fs.statSync(siteFilename).isFile();
      if (siteFileExists) {
        res.setHeader('Content-Type', MIME_TYPES[path.extname(siteFilename).toLowerCase()] || 'application/octet-stream');
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(siteFilename).pipe(res);
      }

      const content = publicRepositoryContent(target.pathname);
      if (content && (req.method === 'GET' || req.method === 'HEAD')) {
        res.setHeader('Cache-Control', 'no-cache');
        if (content.isDirectory) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          if (req.method === 'HEAD') return res.end();
          const pathname = target.pathname.endsWith('/') ? target.pathname : target.pathname + '/';
          return res.end(directoryListing(content.filename, pathname));
        }
        res.setHeader('Content-Type', MIME_TYPES[path.extname(content.filename).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Content-Length', String(content.size));
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(content.filename).pipe(res);
      }

      if (!content) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(path.join(SITE, '404.html')));
      }
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Read-only local content endpoint.');
    } catch {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Local preview failed.');
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || process.argv[2] || 3000);
  createServer().listen(port, '127.0.0.1', () => console.log(`Local site: http://localhost:${port} (site at /)`));
}
module.exports = { createServer };

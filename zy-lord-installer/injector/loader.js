// zycord-injector
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

const patchInfoPath = path.join(__dirname, 'patch-info.json');
if (!fs.existsSync(patchInfoPath)) {
  return;
}

const patchInfo = JSON.parse(fs.readFileSync(patchInfoPath, 'utf8'));
const zycordRoot = patchInfo.zycordRoot || patchInfo.zylordRoot;
module.paths.unshift(path.join(zycordRoot, 'node_modules'));

const fsExtra = require('fs-extra');
const yaml = require('yaml');
const simpleGit = require('simple-git');
const { app, BrowserWindow } = require('electron');

const CONFIG_CANDIDATES = ['zycord.yml', 'zy-lord.yml'];
const PLUGINS_DIR = path.join(zycordRoot, 'plugins');
const COMMAND_PORT = 47653;
const ALLOWED_COMMANDS = new Set(['up', 'down', 'pull', 'ps', 'start', 'build', 'logs']);
const DEFAULT_REPO_SLUG = 'cryphor/ZyLord';

function resolveConfigFile() {
  for (const file of CONFIG_CANDIDATES) {
    const fullPath = path.join(zycordRoot, file);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return path.join(zycordRoot, 'zycord.yml');
}

const CONFIG_FILE = resolveConfigFile();

function log(message) {
  console.log(`[Zycord] ${message}`);
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(zycordRoot, 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function parseGithubSlug(url) {
  const match = String(url || '').match(/github\.com[:/]([^/]+\/[^/.]+)/);
  return match ? match[1].replace(/\.git$/, '') : null;
}

async function findGitRoot(startDir) {
  let dir = path.resolve(startDir);
  const { root } = path.parse(dir);

  while (true) {
    if (await fsExtra.pathExists(path.join(dir, '.git'))) {
      return dir;
    }
    if (dir === root) {
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return null;
}

async function getRepoSlug() {
  const gitRoot = await findGitRoot(zycordRoot);

  if (gitRoot) {
    try {
      const git = simpleGit(gitRoot);
      const remotes = await git.getRemotes(true);
      const origin = remotes.find((remote) => remote.name === 'origin');
      const slug = parseGithubSlug(origin?.refs?.fetch);
      if (slug) {
        return slug;
      }
    } catch (err) {
      log(`Could not read git remote: ${err.message}`);
    }
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(zycordRoot, 'package.json'), 'utf8'));
    const slug = parseGithubSlug(pkg.repository?.url || pkg.homepage);
    if (slug) {
      return slug;
    }
  } catch {}

  return DEFAULT_REPO_SLUG;
}

function fetchJson(url) {
  if (typeof fetch === 'function') {
    return fetch(url, {
      headers: { 'User-Agent': 'Zycord-Updater', Accept: 'application/vnd.github+json' }
    }).then(async (res) => ({
      ok: res.ok,
      status: res.status,
      data: await res.json()
    }));
  }

  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Zycord-Updater', Accept: 'application/vnd.github+json' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: JSON.parse(body) });
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function getLocalVersionInfo() {
  const version = readPackageVersion();
  const repoSlug = await getRepoSlug();
  const repo = `https://github.com/${repoSlug}`;
  let commit = null;
  let commitFull = null;

  const gitRoot = await findGitRoot(zycordRoot);
  if (gitRoot) {
    try {
      const git = simpleGit(gitRoot);
      commitFull = (await git.revparse(['HEAD'])).trim();
      commit = commitFull.slice(0, 7);
    } catch (err) {
      log(`Could not read local git commit: ${err.message}`);
    }
  }

  if (!commitFull && patchInfo.installedCommit) {
    commitFull = String(patchInfo.installedCommit).trim();
    commit = commitFull.slice(0, 7);
  }

  return { version, commit, commitFull, repo, repoSlug, gitRoot };
}

async function fetchRemoteMainInfo(repoSlug, gitRoot) {
  const repoUrl = `https://github.com/${repoSlug}.git`;
  const remoteGit = simpleGit();
  const remoteOut = await remoteGit.listRemote([repoUrl, 'refs/heads/main']);
  const remoteLine = remoteOut.trim().split('\n').find((line) => line.includes('refs/heads/main'));

  if (!remoteLine) {
    throw new Error('Could not resolve remote main branch');
  }

  const remoteCommitFull = remoteLine.split('\t')[0].trim();
  let message = null;
  let author = null;

  if (gitRoot) {
    try {
      const localGit = simpleGit(gitRoot);
      await localGit.raw(['fetch', '--depth', '1', repoUrl, `+refs/heads/main:refs/remotes/zycord-upstream/main`]);
      const log = await localGit.log({ from: 'refs/remotes/zycord-upstream/main', to: 'refs/remotes/zycord-upstream/main', maxCount: 1 });
      if (log.latest) {
        message = log.latest.message.split('\n')[0];
        author = log.latest.author_name;
      }
    } catch (err) {
      log(`Could not read remote commit via git fetch: ${err.message}`);
    }
  }

  if (!message) {
    try {
      const res = await fetchJson(`https://api.github.com/repos/${repoSlug}/commits/${remoteCommitFull}`);
      if (res.ok) {
        message = (res.data.commit?.message || '').split('\n')[0];
        author = res.data.commit?.author?.name || res.data.author?.login || null;
      }
    } catch (err) {
      log(`GitHub API fallback failed: ${err.message}`);
    }
  }

  return {
    remoteCommitFull,
    remoteCommit: remoteCommitFull.slice(0, 7),
    message,
    author
  };
}

async function checkRemoteUpdates() {
  const local = await getLocalVersionInfo();

  try {
    const remote = await fetchRemoteMainInfo(local.repoSlug, local.gitRoot);
    let upToDate = null;
    let hasUpdate = false;

    if (local.commitFull) {
      if (local.commitFull === remote.remoteCommitFull) {
        upToDate = true;
      } else if (local.gitRoot) {
        try {
          const git = simpleGit(local.gitRoot);
          const behindOut = await git.raw(['rev-list', '--count', `${local.commitFull}..${remote.remoteCommitFull}`]);
          const behind = parseInt(String(behindOut).trim(), 10) || 0;
          hasUpdate = behind > 0;
          upToDate = !hasUpdate;
        } catch (err) {
          log(`Could not compare commits: ${err.message}`);
          hasUpdate = false;
          upToDate = null;
        }
      }
    }

    return {
      version: local.version,
      commit: local.commit,
      commitFull: local.commitFull,
      repo: local.repo,
      repoSlug: local.repoSlug,
      upToDate,
      remoteCommit: remote.remoteCommit,
      remoteCommitFull: remote.remoteCommitFull,
      message: hasUpdate ? remote.message : null,
      author: hasUpdate ? remote.author : null
    };
  } catch (err) {
    return {
      version: local.version,
      commit: local.commit,
      commitFull: local.commitFull,
      repo: local.repo,
      repoSlug: local.repoSlug,
      upToDate: null,
      error: err.message
    };
  }
}

function runInstallerCommand(command) {
  return new Promise((resolve) => {
    const nodePath = patchInfo.nodePath || 'node';
    const indexPath = path.join(zycordRoot, 'index.js');
    let output = '';

    const child = spawn(nodePath, [indexPath, command, '--verbose'], {
      cwd: zycordRoot,
      windowsHide: true,
      env: { ...process.env, ZYCORD_ROOT: zycordRoot }
    });

    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('close', (code) => {
      resolve({ ok: code === 0, code, output: output.trim() });
    });
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function startCommandServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const route = (req.url || '/').replace(/^\//, '').split('?')[0];

    if (req.method === 'GET' && route === 'version') {
      try {
        sendJson(res, 200, { ok: true, ...(await getLocalVersionInfo()) });
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method === 'GET' && route === 'updates') {
      try {
        sendJson(res, 200, { ok: true, ...(await checkRemoteUpdates()) });
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method !== 'POST' || !ALLOWED_COMMANDS.has(route)) {
      sendJson(res, 404, { ok: false, error: `Unknown route: ${route}` });
      return;
    }

    log(`Running command: ${route}`);
    const result = await runInstallerCommand(route);
    log(`Command ${route} finished with code ${result.code}`);
    sendJson(res, result.ok ? 200 : 500, result);
  });

  server.listen(COMMAND_PORT, '127.0.0.1', () => {
    log(`Command server listening on http://127.0.0.1:${COMMAND_PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log(`Command server already running on port ${COMMAND_PORT}`);
      return;
    }
    console.error('[Zycord] Command server error:', err.message);
  });
}

async function findPluginScripts(pluginDir) {
  const candidates = ['index.js', 'plugin.js', 'main.js'];
  for (const file of candidates) {
    const scriptPath = path.join(pluginDir, file);
    if (await fsExtra.pathExists(scriptPath)) {
      return [scriptPath];
    }
  }

  const files = await fsExtra.readdir(pluginDir);
  return files
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(pluginDir, file));
}

async function loadPlugins(webContents) {
  if (!await fsExtra.pathExists(CONFIG_FILE)) {
    return;
  }

  const config = yaml.parse(await fsExtra.readFile(CONFIG_FILE, 'utf8'));
  const plugins = config.plugins || {};

  for (const [name, plugin] of Object.entries(plugins)) {
    if (!plugin.enabled) {
      continue;
    }

    const pluginPath = path.join(PLUGINS_DIR, name);
    if (!await fsExtra.pathExists(pluginPath)) {
      log(`Plugin not installed: ${name}`);
      continue;
    }

    const scripts = await findPluginScripts(pluginPath);
    for (const scriptPath of scripts) {
      const code = await fsExtra.readFile(scriptPath, 'utf8');
      try {
        await webContents.executeJavaScript(code);
        log(`Loaded plugin: ${name}`);
      } catch (err) {
        console.error(`[Zycord] Failed to load ${name}:`, err.message);
      }
    }
  }
}

function hookWindow(window) {
  window.webContents.on('did-finish-load', () => {
    const url = window.webContents.getURL();
    if (!url.includes('discord.com')) {
      return;
    }

    loadPlugins(window.webContents).catch((err) => {
      console.error('[Zycord] Plugin loading failed:', err);
    });
  });
}

startCommandServer();

app.on('browser-window-created', (_event, window) => {
  hookWindow(window);
});

app.whenReady().then(() => {
  for (const window of BrowserWindow.getAllWindows()) {
    hookWindow(window);
  }
});

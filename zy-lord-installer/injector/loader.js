// zycord-injector
const path = require('path');
const fs = require('fs');
const http = require('http');
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
const { app, BrowserWindow } = require('electron');

const CONFIG_CANDIDATES = ['zycord.yml', 'zy-lord.yml'];
const PLUGINS_DIR = path.join(zycordRoot, 'plugins');
const COMMAND_PORT = 47653;
const ALLOWED_COMMANDS = new Set(['up', 'down', 'pull', 'ps', 'start', 'build', 'logs']);

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

function startCommandServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const command = (req.url || '/').replace(/^\//, '').split('?')[0];

    if (req.method !== 'POST' || !ALLOWED_COMMANDS.has(command)) {
      res.writeHead(404);
      res.end(JSON.stringify({ ok: false, output: `Unknown command: ${command}` }));
      return;
    }

    log(`Running command: ${command}`);
    const result = await runInstallerCommand(command);
    log(`Command ${command} finished with code ${result.code}`);
    res.writeHead(result.ok ? 200 : 500);
    res.end(JSON.stringify(result));
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

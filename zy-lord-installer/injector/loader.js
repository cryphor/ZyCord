// zy-lord-injector
const path = require('path');
const fs = require('fs');

const patchInfoPath = path.join(__dirname, 'patch-info.json');
if (!fs.existsSync(patchInfoPath)) {
  return;
}

const { zylordRoot } = JSON.parse(fs.readFileSync(patchInfoPath, 'utf8'));
module.paths.unshift(path.join(zylordRoot, 'node_modules'));

const fsExtra = require('fs-extra');
const yaml = require('yaml');
const { app } = require('electron');

const CONFIG_FILE = path.join(zylordRoot, 'zy-lord.yml');
const PLUGINS_DIR = path.join(zylordRoot, 'plugins');

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
      continue;
    }

    const scripts = await findPluginScripts(pluginPath);
    for (const scriptPath of scripts) {
      const code = await fsExtra.readFile(scriptPath, 'utf8');
      try {
        await webContents.executeJavaScript(code);
      } catch (err) {
        console.error(`[ZyLord] Failed to load ${name}:`, err.message);
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
      console.error('[ZyLord] Plugin loading failed:', err);
    });
  });
}

app.on('browser-window-created', (_event, window) => {
  hookWindow(window);
});

for (const window of app.getAllWindows()) {
  hookWindow(window);
}

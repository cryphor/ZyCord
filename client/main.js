const path = require('path');

const INSTALLER_ROOT = process.env.ZYLORD_ROOT || path.join(__dirname, '..', 'zy-lord-installer');
module.paths.unshift(path.join(INSTALLER_ROOT, 'node_modules'));

const fs = require('fs-extra');
const yaml = require('yaml');
const { app, BrowserWindow } = require('electron');

const CONFIG_FILE = path.join(INSTALLER_ROOT, 'zy-lord.yml');
const PLUGINS_DIR = path.join(INSTALLER_ROOT, 'plugins');

let mainWindow;

async function loadConfig() {
  if (!await fs.pathExists(CONFIG_FILE)) {
    return { plugins: {}, settings: {} };
  }
  const fileContent = await fs.readFile(CONFIG_FILE, 'utf8');
  return yaml.parse(fileContent);
}

async function findPluginScripts(pluginDir) {
  const candidates = ['index.js', 'plugin.js', 'main.js'];
  for (const file of candidates) {
    const scriptPath = path.join(pluginDir, file);
    if (await fs.pathExists(scriptPath)) {
      return [scriptPath];
    }
  }

  const files = await fs.readdir(pluginDir);
  return files
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(pluginDir, file));
}

async function loadPlugins(webContents) {
  const config = await loadConfig();
  const plugins = config.plugins || {};

  for (const [name, plugin] of Object.entries(plugins)) {
    if (!plugin.enabled) {
      continue;
    }

    const pluginPath = path.join(PLUGINS_DIR, name);
    if (!await fs.pathExists(pluginPath)) {
      console.warn(`Plugin not installed: ${name}`);
      continue;
    }

    const scripts = await findPluginScripts(pluginPath);
    if (scripts.length === 0) {
      console.warn(`No scripts found for plugin: ${name}`);
      continue;
    }

    for (const scriptPath of scripts) {
      const code = await fs.readFile(scriptPath, 'utf8');
      try {
        await webContents.executeJavaScript(code);
        console.log(`Loaded plugin: ${name} (${path.basename(scriptPath)})`);
      } catch (err) {
        console.error(`Failed to load plugin ${name}:`, err.message);
      }
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 500,
    title: 'ZyLord',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL('https://discord.com/app');

  mainWindow.webContents.on('did-finish-load', () => {
    loadPlugins(mainWindow.webContents).catch((err) => {
      console.error('Plugin loading failed:', err);
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

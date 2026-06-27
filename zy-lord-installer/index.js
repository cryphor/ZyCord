const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const yaml = require('yaml');
const simpleGit = require('simple-git');
const { patchDiscord, unpatchDiscord, launchDiscord, getDiscordStatus } = require('./discord');
const { log, warn, error: logError, initLog, getLogPath } = require('./logger');

const CONFIG_FILE = 'zy-lord.yml';
const PLUGINS_DIR = 'plugins';

const COMMANDS = {
  up: { label: 'Install (up)', handler: handleUp },
  down: { label: 'Uninstall (down)', handler: handleDown },
  build: { label: 'Build (build)', handler: handleBuild },
  ps: { label: 'Show status (ps)', handler: handlePs },
  pull: { label: 'Update plugins (pull)', handler: handlePull },
  logs: { label: 'Show logs (logs)', handler: handleLogs },
  start: { label: 'Start Discord', handler: startDiscordClient }
};

async function main() {
  await initLog();

  const action = process.argv[2];
  const verbose = process.argv.includes('--verbose');
  const quiet = action === 'start' && !verbose;

  if (verbose) {
    log(`Running command: ${action || '(interactive)'}`);
    log(`Log file: ${getLogPath()}`);
  }

  if (!quiet) {
    log(chalk.magenta(`
  ███████╗██╗   ██╗██╗      ██████╗ ██████╗ ██████╗
  ╚══███╔╝╚██╗ ██╔╝██║     ██╔═══██╗██╔══██╗██╔══██╗
    ███╔╝  ╚████╔╝ ██║     ██║   ██║██████╔╝██║  ██║
   ███╔╝    ╚██╔╝  ██║     ██║   ██║██╔══██╗██║  ██║
  ███████╗   ██║   ███████╗╚██████╔╝██║  ██║██████╔╝
  ╚══════╝   ╚═╝   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝
  Discord Client Mod Installer - Docker Compose Style
  `));

    await checkForUpdates();
  }

  const commandName = action || await promptAction();
  const command = COMMANDS[commandName];

  if (!command) {
    logError(chalk.red(`Unknown command: ${commandName}`));
    log(`Available commands: ${Object.keys(COMMANDS).join(', ')}`);
    process.exit(1);
  }

  await command.handler();
}

async function promptAction() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What do you want to do?',
      choices: Object.entries(COMMANDS).map(([value, { label }]) => ({ name: label, value }))
    }
  ]);
  return action;
}

async function checkForUpdates() {
  log('Checking for updates...');

  if (!await fs.pathExists(CONFIG_FILE)) {
    return;
  }

  const config = await loadConfig();

  if (!await fs.pathExists(PLUGINS_DIR)) {
    return;
  }

  let updatesAvailable = false;

  for (const [name, plugin] of Object.entries(config.plugins || {})) {
    if (!plugin.enabled) {
      continue;
    }

    const pluginPath = path.join(PLUGINS_DIR, name);
    if (!await fs.pathExists(pluginPath)) {
      log(chalk.yellow(`${name} is not installed`));
      updatesAvailable = true;
      continue;
    }

    try {
      const git = simpleGit(pluginPath);
      await git.fetch();
      const status = await git.status();
      if (status.behind > 0) {
        log(chalk.yellow(`Update available for ${name} (${status.behind} commits behind)`));
        updatesAvailable = true;
      }
    } catch (err) {
      warn(chalk.yellow(`Could not check updates for ${name}: ${err.message}`));
    }
  }

  if (updatesAvailable) {
    log('\nRun "pull" to update plugins.');
  } else {
    log('\nAll plugins are up to date!');
  }
}

async function loadConfig() {
  if (!await fs.pathExists(CONFIG_FILE)) {
    log(chalk.red(`Could not find ${CONFIG_FILE}. Creating default configuration...`));
    const defaultConfig = {
      version: '1.0',
      plugins: {},
      settings: {
        discordPath: '',
        autoUpdate: true,
        theme: 'dark'
      }
    };
    await fs.writeFile(CONFIG_FILE, yaml.stringify(defaultConfig, { indent: 2 }));
    log(chalk.green(`Created ${CONFIG_FILE} with default configuration.`));
    return defaultConfig;
  }

  const fileContent = await fs.readFile(CONFIG_FILE, 'utf8');
  return yaml.parse(fileContent);
}

async function handleUp() {
  log('Starting ZyLord installer...');
  const config = await loadConfig();
  log(`Config loaded from ${CONFIG_FILE}`);

  await fs.ensureDir(PLUGINS_DIR);
  log(`Plugins directory: ${path.resolve(PLUGINS_DIR)}`);

  const enabledPlugins = Object.entries(config.plugins || {}).filter(([, p]) => p.enabled);
  if (enabledPlugins.length === 0) {
    log('No plugins configured — skipping plugin install.');
  }

  for (const [name, plugin] of Object.entries(config.plugins || {})) {
    if (!plugin.enabled) {
      continue;
    }

    log(chalk.cyan(`Installing plugin: ${name}`));
    const pluginPath = path.join(PLUGINS_DIR, name);

    try {
      if (await fs.pathExists(pluginPath)) {
        log(chalk.yellow(`Plugin ${name} already exists, updating...`));
        await simpleGit(pluginPath).pull();
      } else {
        await simpleGit().clone(plugin.source, pluginPath);
      }
      log(chalk.green(`  ${name} ready`));
    } catch (err) {
      logError(chalk.red(`  Failed to install ${name}: ${err.message}`));
    }
  }

  if (Object.keys(config.plugins || {}).some((name) => config.plugins[name].enabled)) {
    log(chalk.green('Plugins installed successfully!'));
  }

  try {
    await patchDiscord(__dirname, config.settings?.discordPath);
    log(chalk.green('ZyLord installed successfully! Open Discord as usual.'));
  } catch (err) {
    logError(chalk.red(`Failed to patch Discord: ${err.message}`));
    process.exit(1);
  }
}

async function handleDown() {
  log('Stopping and uninstalling ZyLord...');

  try {
    await unpatchDiscord(__dirname);
  } catch (err) {
    logError(chalk.red(`Failed to restore Discord: ${err.message}`));
  }

  if (await fs.pathExists(PLUGINS_DIR)) {
    await fs.remove(PLUGINS_DIR);
  }

  log(chalk.green('ZyLord uninstalled.'));
}

async function handleBuild() {
  log('Building ZyLord...');
  const config = await loadConfig();

  for (const [name, plugin] of Object.entries(config.plugins || {})) {
    if (!plugin.enabled) {
      continue;
    }

    const pluginPath = path.join(PLUGINS_DIR, name);
    const buildScript = path.join(pluginPath, 'build.js');

    if (await fs.pathExists(buildScript)) {
      log(chalk.cyan(`Building ${name}...`));
      try {
        const { execFile } = require('child_process');
        const { promisify } = require('util');
        await promisify(execFile)('node', [buildScript], { cwd: pluginPath });
        log(chalk.green(`  ${name} built`));
      } catch (err) {
        logError(chalk.red(`  Build failed for ${name}: ${err.message}`));
      }
    }
  }

  log(chalk.green('Build complete.'));
}

async function handlePs() {
  log('Showing status...');
  const config = await loadConfig();

  const discordStatus = await getDiscordStatus(__dirname, config.settings?.discordPath);
  log('\nDiscord:');
  if (!discordStatus.found) {
    log(chalk.red('  Not found'));
  } else {
    const patchStatus = discordStatus.patched ? chalk.green('patched') : chalk.yellow('not patched');
    log(`  ${discordStatus.path}`);
    log(`  Status: ${patchStatus}`);
    if (discordStatus.patchMismatch) {
      log(chalk.yellow('  Discord updated — run "up" to re-patch'));
    }
  }

  log('\nPlugins:');
  for (const [name, plugin] of Object.entries(config.plugins || {})) {
    const pluginPath = path.join(PLUGINS_DIR, name);
    const installed = await fs.pathExists(pluginPath);
    const status = plugin.enabled ? chalk.green('enabled') : chalk.red('disabled');
    const installStatus = installed ? chalk.green('installed') : chalk.yellow('not installed');
    log(`  ${name}: ${status}, ${installStatus} (${plugin.version})`);
  }
}

async function handlePull() {
  log('Updating plugins...');
  const config = await loadConfig();

  for (const [name, plugin] of Object.entries(config.plugins || {})) {
    if (!plugin.enabled) {
      continue;
    }

    const pluginPath = path.join(PLUGINS_DIR, name);
    if (!await fs.pathExists(pluginPath)) {
      log(chalk.yellow(`${name} is not installed — run "up" first`));
      continue;
    }

    log(chalk.cyan(`Updating ${name}...`));
    try {
      await simpleGit(pluginPath).pull();
      log(chalk.green(`  ${name} updated`));
    } catch (err) {
      logError(chalk.red(`  Failed to update ${name}: ${err.message}`));
    }
  }

  log(chalk.green('All plugins updated.'));
}

async function handleLogs() {
  const logFile = path.join(__dirname, 'zy-lord.log');
  if (!await fs.pathExists(logFile)) {
    log(chalk.yellow('No log file found yet.'));
    return;
  }

  const logs = await fs.readFile(logFile, 'utf8');
  log(logs || '(empty)');
}

async function startDiscordClient() {
  log('Starting Discord...');
  const config = await loadConfig();
  let discordStatus = await getDiscordStatus(__dirname, config.settings?.discordPath);

  if (!discordStatus.found) {
    logError(chalk.red('Discord not found. Install Discord or set settings.discordPath in zy-lord.yml'));
    process.exit(1);
  }

  log(`Discord found at ${discordStatus.path}`);
  log(`Patch status: ${discordStatus.patched ? 'patched' : 'not patched'}`);

  if (!discordStatus.patched) {
    log('Discord not patched — patching now...');
    try {
      await patchDiscord(__dirname, config.settings?.discordPath);
      discordStatus = await getDiscordStatus(__dirname, config.settings?.discordPath);
    } catch (err) {
      logError(chalk.red(`Failed to patch Discord: ${err.message}`));
      process.exit(1);
    }
  }

  if (!discordStatus.patched) {
    logError(chalk.red('Discord is not patched. Run install.bat first.'));
    process.exit(1);
  }

  const launchedFrom = await launchDiscord(config.settings?.discordPath);
  log(chalk.green(`Discord launched from ${launchedFrom}`));
}

main().catch((err) => {
  logError(chalk.red('An error occurred:'), err);
  process.exit(1);
});

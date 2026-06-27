const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const yaml = require('yaml');
const simpleGit = require('simple-git');
const { patchDiscord, unpatchDiscord, launchDiscord, getDiscordStatus } = require('./discord');

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
  console.log(chalk.magenta(`
  ███████╗██╗   ██╗██╗      ██████╗ ██████╗ ██████╗
  ╚══███╔╝╚██╗ ██╔╝██║     ██╔═══██╗██╔══██╗██╔══██╗
    ███╔╝  ╚████╔╝ ██║     ██║   ██║██████╔╝██║  ██║
   ███╔╝    ╚██╔╝  ██║     ██║   ██║██╔══██╗██║  ██║
  ███████╗   ██║   ███████╗╚██████╔╝██║  ██║██████╔╝
  ╚══════╝   ╚═╝   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝
  Discord Client Mod Installer - Docker Compose Style
  `));

  await checkForUpdates();

  const action = process.argv[2] || await promptAction();
  const command = COMMANDS[action];

  if (!command) {
    console.error(chalk.red(`Unknown command: ${action}`));
    console.log(`Available commands: ${Object.keys(COMMANDS).join(', ')}`);
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
  console.log('Checking for updates...');

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
      console.log(chalk.yellow(`${name} is not installed`));
      updatesAvailable = true;
      continue;
    }

    try {
      const git = simpleGit(pluginPath);
      await git.fetch();
      const status = await git.status();
      if (status.behind > 0) {
        console.log(chalk.yellow(`Update available for ${name} (${status.behind} commits behind)`));
        updatesAvailable = true;
      }
    } catch (err) {
      console.log(chalk.yellow(`Could not check updates for ${name}: ${err.message}`));
    }
  }

  if (updatesAvailable) {
    console.log('\nRun "pull" to update plugins.');
  } else {
    console.log('\nAll plugins are up to date!');
  }
}

async function loadConfig() {
  if (!await fs.pathExists(CONFIG_FILE)) {
    console.log(chalk.red(`Could not find ${CONFIG_FILE}. Creating default configuration...`));
    const defaultConfig = {
      version: '1.0',
      plugins: {
        'zy-lord-core': {
          source: 'https://github.com/zy-lord/core-plugin.git',
          version: 'latest',
          enabled: true
        }
      },
      settings: {
        discordPath: '',
        autoUpdate: true,
        theme: 'dark'
      }
    };
    await fs.writeFile(CONFIG_FILE, yaml.stringify(defaultConfig, { indent: 2 }));
    console.log(chalk.green(`Created ${CONFIG_FILE} with default configuration.`));
    return defaultConfig;
  }

  const fileContent = await fs.readFile(CONFIG_FILE, 'utf8');
  return yaml.parse(fileContent);
}

async function handleUp() {
  console.log('Starting ZyLord installer...');
  const config = await loadConfig();

  await fs.ensureDir(PLUGINS_DIR);

  for (const [name, plugin] of Object.entries(config.plugins || {})) {
    if (!plugin.enabled) {
      continue;
    }

    console.log(chalk.cyan(`Installing plugin: ${name}`));
    const pluginPath = path.join(PLUGINS_DIR, name);

    try {
      if (await fs.pathExists(pluginPath)) {
        console.log(chalk.yellow(`Plugin ${name} already exists, updating...`));
        await simpleGit(pluginPath).pull();
      } else {
        await simpleGit().clone(plugin.source, pluginPath);
      }
      console.log(chalk.green(`  ${name} ready`));
    } catch (err) {
      console.error(chalk.red(`  Failed to install ${name}: ${err.message}`));
    }
  }

  console.log(chalk.green('Plugins installed successfully!'));

  try {
    await patchDiscord(__dirname, config.settings?.discordPath);
    console.log(chalk.green('ZyLord installed successfully! Open Discord as usual.'));
  } catch (err) {
    console.error(chalk.red(`Failed to patch Discord: ${err.message}`));
    console.log(chalk.yellow('Plugins are installed but Discord was not patched.'));
  }
}

async function handleDown() {
  console.log('Stopping and uninstalling ZyLord...');

  try {
    await unpatchDiscord(__dirname);
  } catch (err) {
    console.error(chalk.red(`Failed to restore Discord: ${err.message}`));
  }

  if (await fs.pathExists(PLUGINS_DIR)) {
    await fs.remove(PLUGINS_DIR);
  }

  console.log(chalk.green('ZyLord uninstalled.'));
}

async function handleBuild() {
  console.log('Building ZyLord...');
  const config = await loadConfig();

  for (const [name, plugin] of Object.entries(config.plugins || {})) {
    if (!plugin.enabled) {
      continue;
    }

    const pluginPath = path.join(PLUGINS_DIR, name);
    const buildScript = path.join(pluginPath, 'build.js');

    if (await fs.pathExists(buildScript)) {
      console.log(chalk.cyan(`Building ${name}...`));
      try {
        const { execFile } = require('child_process');
        const { promisify } = require('util');
        await promisify(execFile)('node', [buildScript], { cwd: pluginPath });
        console.log(chalk.green(`  ${name} built`));
      } catch (err) {
        console.error(chalk.red(`  Build failed for ${name}: ${err.message}`));
      }
    }
  }

  console.log(chalk.green('Build complete.'));
}

async function handlePs() {
  console.log('Showing status...');
  const config = await loadConfig();

  const discordStatus = await getDiscordStatus(__dirname, config.settings?.discordPath);
  console.log('\nDiscord:');
  if (!discordStatus.found) {
    console.log(chalk.red('  Not found'));
  } else {
    const patchStatus = discordStatus.patched ? chalk.green('patched') : chalk.yellow('not patched');
    console.log(`  ${discordStatus.path}`);
    console.log(`  Status: ${patchStatus}`);
    if (discordStatus.patchMismatch) {
      console.log(chalk.yellow('  Discord updated — run "up" to re-patch'));
    }
  }

  console.log('\nPlugins:');
  for (const [name, plugin] of Object.entries(config.plugins || {})) {
    const pluginPath = path.join(PLUGINS_DIR, name);
    const installed = await fs.pathExists(pluginPath);
    const status = plugin.enabled ? chalk.green('enabled') : chalk.red('disabled');
    const installStatus = installed ? chalk.green('installed') : chalk.yellow('not installed');
    console.log(`  ${name}: ${status}, ${installStatus} (${plugin.version})`);
  }
}

async function handlePull() {
  console.log('Updating plugins...');
  const config = await loadConfig();

  for (const [name, plugin] of Object.entries(config.plugins || {})) {
    if (!plugin.enabled) {
      continue;
    }

    const pluginPath = path.join(PLUGINS_DIR, name);
    if (!await fs.pathExists(pluginPath)) {
      console.log(chalk.yellow(`${name} is not installed — run "up" first`));
      continue;
    }

    console.log(chalk.cyan(`Updating ${name}...`));
    try {
      await simpleGit(pluginPath).pull();
      console.log(chalk.green(`  ${name} updated`));
    } catch (err) {
      console.error(chalk.red(`  Failed to update ${name}: ${err.message}`));
    }
  }

  console.log(chalk.green('All plugins updated.'));
}

async function handleLogs() {
  const logFile = path.join(__dirname, 'zy-lord.log');
  if (!await fs.pathExists(logFile)) {
    console.log(chalk.yellow('No log file found yet.'));
    return;
  }

  const logs = await fs.readFile(logFile, 'utf8');
  console.log(logs || '(empty)');
}

async function startDiscordClient() {
  const config = await loadConfig();
  const discordStatus = await getDiscordStatus(__dirname, config.settings?.discordPath);

  if (!discordStatus.found) {
    console.error(chalk.red('Discord not found. Install Discord or set settings.discordPath in zy-lord.yml'));
    process.exit(1);
  }

  if (!discordStatus.patched) {
    console.log(chalk.yellow('Discord is not patched yet. Run "up" first to install ZyLord.'));
    process.exit(1);
  }

  console.log(chalk.cyan('Starting Discord...'));
  await launchDiscord(config.settings?.discordPath);
  console.log(chalk.green('Discord launched with ZyLord mods.'));
}

main().catch((err) => {
  console.error(chalk.red('An error occurred:'), err);
  process.exit(1);
});

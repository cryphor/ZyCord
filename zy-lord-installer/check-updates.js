#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const chalk = require('chalk');
const yaml = require('yaml');

const CONFIG_FILE = 'zy-lord.yml';
const PLUGINS_DIR = 'plugins';

async function checkForUpdates() {
  console.log(chalk.blue('Checking for updates...'));

  if (!await fs.pathExists(CONFIG_FILE)) {
    console.log(chalk.red('Configuration file not found. Run the installer first.'));
    return;
  }

  const fileContent = await fs.readFile(CONFIG_FILE, 'utf8');
  const config = yaml.parse(fileContent);

  if (!await fs.pathExists(PLUGINS_DIR)) {
    console.log(chalk.yellow('Plugins directory not found. Run "up" to install plugins.'));
    return;
  }

  let updatesAvailable = false;

  for (const [name, plugin] of Object.entries(config.plugins || {})) {
    if (!plugin.enabled) {
      continue;
    }

    const pluginPath = path.join(PLUGINS_DIR, name);
    if (!await fs.pathExists(pluginPath)) {
      console.log(chalk.red(`${name} is not installed`));
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
      } else {
        console.log(chalk.green(`${name} is up to date`));
      }
    } catch (err) {
      console.log(chalk.yellow(`Could not check ${name}: ${err.message}`));
    }
  }

  if (updatesAvailable) {
    console.log(chalk.cyan('\nRun "npm start" and select "Update plugins", or: node index.js pull'));
  } else {
    console.log(chalk.green('\nAll plugins are up to date!'));
  }
}

checkForUpdates().catch((err) => {
  console.error(chalk.red('Error checking for updates:'), err);
  process.exit(1);
});

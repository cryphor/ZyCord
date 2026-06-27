#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const yaml = require('yaml');

const CONFIG_FILE = 'zy-lord.yml';

async function main() {
  console.log(chalk.red(`
  ███████╗██╗   ██╗██╗      ██████╗ ██████╗ ██████╗ 
  ╚══███╔╝╚██╗ ██╔╝██║     ██╔═══██╗██╔══██╗██╔══██╗
    ███╔╝  ╚████╔╝ ██║     ██║   ██║██████╔╝██║  ██║
   ███╔╝    ╚██╔╝  ██║     ██║   ██║██╔══██╗██║  ██║
  ███████╗   ██║   ███████╗╚██████╔╝██║  ██║██████╔╝
  ╚══════╝   ╚═╝   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ 
  Discord Client Mod Installer - Docker Compose Style
  `));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Vad vill du göra?',
      choices: [
        { name: 'Installera (up)', value: 'up' },
        { name: 'Avinstallera (down)', value: 'down' },
        { name: 'Bygg om (build)', value: 'build' },
        { name: 'Visa status (ps)', value: 'ps' },
        { name: 'Uppdatera plugins (pull)', value: 'pull' },
        { name: 'Visa loggar (logs)', value: 'logs' }
      ]
    }
  ]);

  switch (action) {
    case 'up':
      await handleUp();
      break;
    case 'down':
      await handleDown();
      break;
    case 'build':
      await handleBuild();
      break;
    case 'ps':
      await handlePs();
      break;
    case 'pull':
      await handlePull();
      break;
    case 'logs':
      await handleLogs();
      break;
  }
}

async function loadConfig() {
  if (!await fs.pathExists(CONFIG_FILE)) {
    console.log(chalk.red(`Kunde inte hitta ${CONFIG_FILE}. Skapar standardkonfiguration...`));
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
    console.log(chalk.green(`Skapat ${CONFIG_FILE} med standardkonfiguration.`));
    return defaultConfig;
  }
  const fileContent = await fs.readFile(CONFIG_FILE, 'utf8');
  return yaml.parse(fileContent);
}

async function handleUp() {
  console.log(chalk.blue('Startar ZyLord installer...'));
  const config = await loadConfig();
  
  for (const [name, plugin] of Object.entries(config.plugins)) {
    if (plugin.enabled) {
      console.log(chalk.cyan(`Installerar plugin: ${name}`));
      // Här skulle plugin-installationslogik finnas
    }
  }
  
  console.log(chalk.green('ZyLord installerat framgångsrikt!'));
}

async function handleDown() {
  console.log(chalk.blue('Stoppar och avinstallerar ZyLord...'));
  // Avinstallationslogik här
  console.log(chalk.green('ZyLord avinstallerat.'));
}

async function handleBuild() {
  console.log(chalk.blue('Bygger om ZyLord...'));
  // Bygglogik här
  console.log(chalk.green('Ombygget klart.'));
}

async function handlePs() {
  console.log(chalk.blue('Visar status...'));
  // Statusvisningslogik här
}

async function handlePull() {
  console.log(chalk.blue('Uppdaterar plugins...'));
  // Uppdateringslogik här
  console.log(chalk.green('Alla plugins uppdaterade.'));
}

async function handleLogs() {
  console.log(chalk.blue('Visar loggar...'));
  // Loggvisningslogik här
}

main().catch(err => {
  console.error(chalk.red('Ett fel uppstod:'), err);
  process.exit(1);
});

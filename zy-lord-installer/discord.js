const fs = require('fs-extra');
const path = require('path');
const { spawn, execSync } = require('child_process');
const asar = require('asar');
const chalk = require('chalk');
const { log, warn, error } = require('./logger');

const PATCH_MARKER = 'zycord-injector';
const LEGACY_PATCH_MARKER = 'zy-lord-injector';
const PATCH_INFO_FILE = 'patch-info.json';
const BACKUP_NAME = 'app.asar.zylord-backup';

function getDiscordBaseDirs() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return [];
  }

  return [
    path.join(localAppData, 'Discord'),
    path.join(localAppData, 'DiscordPTB'),
    path.join(localAppData, 'DiscordCanary')
  ];
}

async function findDiscordInstall(customPath) {
  if (customPath && await fs.pathExists(customPath)) {
    return customPath;
  }

  for (const baseDir of getDiscordBaseDirs()) {
    if (!await fs.pathExists(baseDir)) {
      continue;
    }

    const entries = await fs.readdir(baseDir);
    const appDirs = [];

    for (const entry of entries) {
      if (!entry.startsWith('app-')) {
        continue;
      }

      const appPath = path.join(baseDir, entry);
      const discordExe = path.join(appPath, 'Discord.exe');
      if (await fs.pathExists(discordExe)) {
        const stat = await fs.stat(appPath);
        appDirs.push({ path: appPath, mtime: stat.mtimeMs });
      }
    }

    if (appDirs.length > 0) {
      appDirs.sort((a, b) => b.mtime - a.mtime);
      return appDirs[0].path;
    }
  }

  return null;
}

function getPatchInfoPath(installerRoot) {
  return path.join(installerRoot, 'injector', PATCH_INFO_FILE);
}

async function writePatchInfo(installerRoot, discordPath) {
  const info = {
    discordPath,
    zycordRoot: installerRoot,
    zylordRoot: installerRoot,
    patchedAt: new Date().toISOString()
  };
  await fs.ensureDir(path.join(installerRoot, 'injector'));
  await fs.writeJson(getPatchInfoPath(installerRoot), info, { spaces: 2 });
}

async function readPatchInfo(installerRoot) {
  const infoPath = getPatchInfoPath(installerRoot);
  if (!await fs.pathExists(infoPath)) {
    return null;
  }
  return fs.readJson(infoPath);
}

async function isDiscordPatched(discordPath) {
  const asarPath = path.join(discordPath, 'resources', 'app.asar');
  if (!await fs.pathExists(asarPath)) {
    return false;
  }

  try {
    const contents = await asar.extractFile(asarPath, 'package.json');
    const pkg = JSON.parse(contents.toString('utf8'));
    const mainFile = pkg.main || 'index.js';
    const mainContents = await asar.extractFile(asarPath, mainFile);
    return mainContents.toString('utf8').includes(PATCH_MARKER)
      || mainContents.toString('utf8').includes(LEGACY_PATCH_MARKER);
  } catch {
    return false;
  }
}

async function findMainFile(extractDir) {
  const pkgPath = path.join(extractDir, 'package.json');
  const pkg = await fs.readJson(pkgPath);
  const candidates = [pkg.main, 'index.js', 'app/index.js', 'app_bootstrap/index.js'].filter(Boolean);

  for (const candidate of candidates) {
    const fullPath = path.join(extractDir, candidate);
    if (await fs.pathExists(fullPath)) {
      return fullPath;
    }
  }

  throw new Error('Could not find Discord entry point in app.asar');
}

async function isDiscordRunning() {
  if (process.platform !== 'win32') {
    return false;
  }

  try {
    const output = execSync('tasklist /FI "IMAGENAME eq Discord.exe" /NH', { encoding: 'utf8' });
    return output.toLowerCase().includes('discord.exe');
  } catch {
    return false;
  }
}

async function patchDiscord(installerRoot, customDiscordPath) {
  const discordPath = await findDiscordInstall(customDiscordPath);
  if (!discordPath) {
    throw new Error('Discord installation not found. Set settings.discordPath in zy-lord.yml');
  }

  if (await isDiscordRunning()) {
    throw new Error('Close Discord completely before patching (check system tray too)');
  }

  const resourcesDir = path.join(discordPath, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, BACKUP_NAME);
  const loaderPath = path.join(installerRoot, 'injector', 'loader.js');

  if (!await fs.pathExists(asarPath)) {
    throw new Error(`Discord app.asar not found at ${asarPath}`);
  }

  if (!await fs.pathExists(loaderPath)) {
    throw new Error(`Zycord loader not found at ${loaderPath}`);
  }

  if (await isDiscordPatched(discordPath)) {
    log(chalk.yellow('Discord is already patched.'));
    await writePatchInfo(installerRoot, discordPath);
    return discordPath;
  }

  if (!await fs.pathExists(backupPath)) {
    log(chalk.cyan('Backing up original Discord app.asar...'));
    await fs.copy(asarPath, backupPath);
    log(`Backup saved to ${backupPath}`);
  }

  const extractDir = path.join(installerRoot, '.discord-extract');
  await fs.remove(extractDir);
  await fs.ensureDir(extractDir);

  log(chalk.cyan(`Extracting Discord app.asar from ${asarPath}...`));
  await asar.extractAll(asarPath, extractDir);

  const mainFile = await findMainFile(extractDir);
  log(`Injecting loader into ${path.basename(mainFile)}`);
  let mainContent = await fs.readFile(mainFile, 'utf8');

  if (!mainContent.includes(PATCH_MARKER) && !mainContent.includes(LEGACY_PATCH_MARKER)) {
    const injectLine = `require(${JSON.stringify(loaderPath)}); // ${PATCH_MARKER}\n`;
    mainContent = injectLine + mainContent;
    await fs.writeFile(mainFile, mainContent);
  }

  log(chalk.cyan('Repacking Discord app.asar...'));
  await asar.createPackage(extractDir, asarPath);
  await fs.remove(extractDir);
  await writePatchInfo(installerRoot, discordPath);

  log(chalk.green(`Discord patched at ${discordPath}`));
  return discordPath;
}

async function unpatchDiscord(installerRoot) {
  const patchInfo = await readPatchInfo(installerRoot);
  const discordPath = patchInfo?.discordPath || await findDiscordInstall();

  if (!discordPath) {
    warn(chalk.yellow('No Discord installation found to restore.'));
    return;
  }

  const resourcesDir = path.join(discordPath, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, BACKUP_NAME);

  if (!await fs.pathExists(backupPath)) {
    warn(chalk.yellow('No Discord backup found — nothing to restore.'));
    return;
  }

  log('Restoring original Discord app.asar...');
  await fs.copy(backupPath, asarPath);
  await fs.remove(backupPath);
  await fs.remove(getPatchInfoPath(installerRoot));

  log(chalk.green('Discord restored to original state.'));
}

function launchDiscord(customDiscordPath) {
  return findDiscordInstall(customDiscordPath).then((discordPath) => {
    if (!discordPath) {
      throw new Error('Discord installation not found.');
    }

    const discordExe = path.join(discordPath, 'Discord.exe');
    if (!fs.existsSync(discordExe)) {
      throw new Error(`Discord.exe not found at ${discordExe}`);
    }

    log(`Launching Discord: ${discordExe}`);
    const child = spawn(discordExe, [], {
      detached: true,
      stdio: 'ignore'
    });

    child.unref();
    return discordPath;
  });
}

async function getDiscordStatus(installerRoot, customDiscordPath) {
  const discordPath = await findDiscordInstall(customDiscordPath);
  if (!discordPath) {
    return { found: false, patched: false, path: null };
  }

  const patched = await isDiscordPatched(discordPath);
  const patchInfo = await readPatchInfo(installerRoot);
  const patchMismatch = patchInfo && patchInfo.discordPath !== discordPath;

  return {
    found: true,
    patched,
    path: discordPath,
    patchMismatch,
    patchInfo
  };
}

module.exports = {
  findDiscordInstall,
  patchDiscord,
  unpatchDiscord,
  launchDiscord,
  getDiscordStatus,
  isDiscordPatched
};

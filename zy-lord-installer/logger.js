const fs = require('fs-extra');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'zycord.log');

function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, '');
}

function formatLine(level, message) {
  return `[${new Date().toISOString()}] [${level}] ${stripAnsi(message)}`;
}

async function writeLog(level, message) {
  await fs.appendFile(LOG_FILE, `${formatLine(level, message)}\n`);
}

function log(message) {
  console.log(message);
  writeLog('INFO', message).catch(() => {});
}

function warn(message) {
  console.warn(message);
  writeLog('WARN', message).catch(() => {});
}

function error(message) {
  console.error(message);
  writeLog('ERROR', message).catch(() => {});
}

async function initLog() {
  await fs.ensureFile(LOG_FILE);
  await writeLog('INFO', '--- ZyCord session started ---');
}

function getLogPath() {
  return LOG_FILE;
}

module.exports = { log, warn, error, initLog, getLogPath, writeLog };

// utils/logger.js
const chalk = require('chalk');
const { TIMEZONE } = require('../config');

function getISTTimestamp() {
  const now = new Date();
  const options = {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  return new Intl.DateTimeFormat('en-IN', options).format(now);
}

const logger = {
  info: (msg, ...args) => {
    console.log(`${chalk.gray(`[${getISTTimestamp()}]`)} ${chalk.green('ℹ INFO')} ${chalk.white(msg)}`, ...args);
  },
  success: (msg, ...args) => {
    console.log(`${chalk.gray(`[${getISTTimestamp()}]`)} ${chalk.green('✔ SUCCESS')} ${chalk.white(msg)}`, ...args);
  },
  warn: (msg, ...args) => {
    console.warn(`${chalk.gray(`[${getISTTimestamp()}]`)} ${chalk.yellow('⚠ WARN')} ${chalk.white(msg)}`, ...args);
  },
  error: (msg, ...args) => {
    console.error(`${chalk.gray(`[${getISTTimestamp()}]`)} ${chalk.red('✖ ERROR')} ${chalk.white(msg)}`, ...args);
  },
  debug: (msg, ...args) => {
    if (process.env.DEBUG) {
      console.debug(`${chalk.gray(`[${getISTTimestamp()}]`)} ${chalk.cyan('🐛 DEBUG')} ${chalk.white(msg)}`, ...args);
    }
  },
  // Special method for command usage logging
  command: (interaction) => {
    const user = interaction.user;
    const guild = interaction.guild;
    const commandName = interaction.commandName;
    
    let logLine = `${chalk.blue('⚙ CMD')} ${chalk.yellow(commandName)} `;
    logLine += `${chalk.magenta(`${user.tag} (${user.id})`)}`;
    
    if (guild) {
      const guildName = guild.name;
      logLine += ` ${chalk.cyan(`in ${guildName} (${guild.id})`)}`;
    } else {
      logLine += ` ${chalk.gray('(DM)')}`;
    }
    
    console.log(`${chalk.gray(`[${getISTTimestamp()}]`)} ${logLine}`);
  },
  banner: (msg) => {
    console.log(chalk.cyan('┌──────────────────────────────────────────────┐'));
    console.log(chalk.cyan('│') + chalk.bold.yellow(msg.padEnd(44)) + chalk.cyan('  │'));
    console.log(chalk.cyan('└──────────────────────────────────────────────┘'));
  },
  commandDeployed: (name) => {
    console.log(`${chalk.gray(`[${getISTTimestamp()}]`)} ${chalk.green('✔')} ${chalk.blue('CMD')} ${chalk.white(name.padEnd(20))} ${chalk.green('deployed')}`);
  }
};

module.exports = { logger, getISTTimestamp };
// deployCommands.js
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { logger } = require('./utils/logger');
const chalk = require('chalk');

module.exports = async function deployCommands(client) {
  // Load command configuration
  let commandConfig = {};
  try {
    const configPath = path.join(__dirname, 'commandConfig.json');
    commandConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    logger.error('Failed to load commandConfig.json for deployment', error);
    commandConfig = {};
  }

  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  
  function loadCommands(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        loadCommands(fullPath);
      } else if (file.name.endsWith('.js')) {
        const command = require(fullPath);
        if ('data' in command) {
          commands.push(command.data.toJSON());
        }
      }
    }
  }
  loadCommands(commandsPath);
  
  const rest = new REST({ version: '10' }).setToken(client.token || process.env.TOKEN);
  
  try {
    logger.info(`Deploying ${commands.length} commands...`);
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    
    // Build deployment box with flags
    const boxWidth = 70;
    const top = `┌${'─'.repeat(boxWidth - 2)}┐`;
    const mid = `├${'─'.repeat(boxWidth - 2)}┤`;
    const bottom = `└${'─'.repeat(boxWidth - 2)}┘`;
    
    const pad = (text) => {
      const cleanText = text.length > boxWidth - 4 ? text.slice(0, boxWidth - 7) + '...' : text;
      const padding = boxWidth - 2 - cleanText.length;
      return `│ ${cleanText}${' '.repeat(padding)}                 │`;
    };

    console.log(chalk.cyan(top));
    console.log(chalk.cyan(pad('COMMANDS DEPLOYED SUCCESSFULLY')));
    console.log(chalk.cyan(mid));
    
    // Sort commands alphabetically
    const sortedCommands = data.sort((a, b) => a.name.localeCompare(b.name));
    
    sortedCommands.forEach(cmd => {
      const name = cmd.name.padEnd(22);
      const config = commandConfig[cmd.name] || { globalCommand: false, adminOnly: false };
      const globalFlag = config.globalCommand ? '✅' : '❌';
      const adminFlag = config.adminOnly ? '✅' : '❌';
      const line = `${chalk.green('✔')} ${chalk.white(name)}             G:${globalFlag}  A:${adminFlag}`;
      console.log(chalk.cyan(pad(line)));
    });
    
    console.log(chalk.cyan(bottom));
    logger.success(`Deployed ${data.length} global commands`);
    return data;
  } catch (error) {
    logger.error('Failed to deploy commands:', error);
    throw error;
  }
};
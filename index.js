// index.js
require('dotenv').config();
const { startBot } = require('./bot/bot');
const { startServer } = require('./server');
const { logger } = require('./utils/logger');

async function main() {
  logger.info('Starting Discord bot...');
  const client = await startBot();

  logger.info('Bot logged in. Starting web panel...');
  await startServer(client);

  logger.success(`System ready. Web panel on http://localhost:${process.env.HTTP_PORT || 3001}`);
}

main().catch(err => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
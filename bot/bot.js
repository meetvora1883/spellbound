// bot/bot.js
const { Client, GatewayIntentBits, Collection, Events, MessageFlags, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { DateTime } = require('luxon');
const db = require('../database');
const { logger } = require('../utils/logger');
const deployCommands = require('../deployCommands');
const DMManager = require('../systems/dm/dmManager');
const SelfRoleManager = require('../systems/selfrole/selfroleManager');
const DMDeletionSystem = require('../systems/dm/dmDeletion');
const GreetingsManager = require('../systems/greetings/greetingsManager');
const InviteTracker = require('../systems/invite/inviteTracker');
const { formatMight } = require('../utils/dateUtils');
const emojis = require('../constants/emojis');
const QuestionManager = require('../systems/question/questionManager');
const MusicManager = require('../systems/music/musicManager');

// ==================== INITIALISE PIN MESSAGE SYSTEM ====================
const PinMessageManager = require('../systems/pinmsg');
const { uploadBackup } = require('../systems/backup');





cron.schedule('0 3 * * *', () => {
  logger.info('Starting daily database backup...');
  uploadBackup(client);            // ← pass the client
}, { timezone: 'UTC' });





async function startBot() {
  // ==================== CONFIGURATION ====================
  let commandConfig = {};
  try {
    const configPath = path.join(__dirname, '../commandConfig.json');
    commandConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    logger.success('Command configuration loaded');
  } catch (error) {
    logger.error('Failed to load commandConfig.json', error);
    process.exit(1);
  }

  // ==================== CLIENT SETUP ====================
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ]
  });

  client.commands = new Collection();
  client.ownerId = process.env.OWNER_ID;
client.music = new MusicManager(client);
  // ==================== INITIALISE DM DELETION ====================
  const dmDeletion = new DMDeletionSystem(client);
  client.dmDeletion = dmDeletion;

  // ==================== INITIALISE INVITE TRACKER ====================
  client.inviteTracker = new InviteTracker(client);


  // ==================== INITIALISE PIN MESSAGE SYSTEM ====================

client.pinMsg = new PinMessageManager(client);
client.pinMsg.init();





  // ==================== COMMAND LOADER ====================
  function loadCommands(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        loadCommands(fullPath);
      } else if (file.name.endsWith('.js')) {
        const command = require(fullPath);
        if ('data' in command && 'execute' in command) {
          const cmdName = command.data.name;
          command.globalCommand = commandConfig[cmdName]?.globalCommand ?? false;
          command.adminOnly = commandConfig[cmdName]?.adminOnly ?? false;
          client.commands.set(cmdName, command);
          logger.debug(`Loaded command: ${cmdName} (global: ${command.globalCommand}, admin: ${command.adminOnly})`);
        } else {
          logger.warn(`Command ${fullPath} missing "data" or "execute"`);
        }
      }
    }
  }
  loadCommands(path.join(__dirname, '../commands'));

  // ==================== AUTO‑DEPLOY ====================
  if (process.env.AUTO_DEPLOY === 'true') {
    await deployCommands(client)
      .then(() => logger.success('Commands deployed globally'))
      .catch(err => logger.error('Deploy failed:', err));
  }

  // ==================== EVENT: CLIENT READY ====================
  client.once(Events.ClientReady, async (c) => {
    logger.banner(' WARBOARD BOT IS ONLINE ');
    logger.success(`Logged in as ${c.user.tag}`);

    await dmDeletion.initialize();
    await client.inviteTracker.initialize();

    // Sync guilds
    client.guilds.cache.forEach(guild => {
      const stored = db.getGuild(guild.id);
      const oldName = stored?.guild_name;
      db.createGuild(guild.id, guild.name);
      db.updateGuildName(guild.id, guild.name);
      if (oldName && oldName !== guild.name) {
        logger.info(`Guild renamed: ${oldName} → ${guild.name} (${guild.id})`);
      } else {
        logger.info(`Synced guild: ${guild.name} (${guild.id})`);
      }
    });

    // Check for removed guilds
    const dbGuilds = db.getAllGuilds();
    dbGuilds.forEach(dbGuild => {
      if (!client.guilds.cache.has(dbGuild.guild_id)) {
        logger.warn(`Bot removed from guild: ${dbGuild.guild_name || dbGuild.guild_id} (${dbGuild.guild_id})`);
      }
    });

    logger.success(`Ready in ${client.guilds.cache.size} guilds`);
      client.music.initialize();

client.on('raw', (data) => {
  if (client.music && client.music.manager) {
    client.music.manager.updateVoiceState(data);
  }
});
    // ========== SCHEDULED MIGHT REPORTS ==========
    cron.schedule('30 18 13,27 * *', async () => {
      logger.info('Running scheduled might reports for all guilds (00:00 IST)');
      const guilds = db.getAllGuilds();
      for (const g of guilds) {
        const guildId = g.guild_id;
        const channelId = db.getMightReportChannel(guildId);
        if (!channelId) continue;

        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(channelId);
        if (!channel) continue;

        const differences = db.getMightDifferences(guildId);
        if (differences.length === 0) continue;

        let report = `${emojis.BAR_CHART} Might Change Report\n\n`;
        for (const d of differences) {
          const prev = formatMight(d.previous_might);
          const curr = formatMight(d.current_might);
          const change = (d.change > 0 ? '+' : '') + formatMight(d.change);
          const userDisplay = d.user_id ? `<@${d.user_id}>` : d.username;
          report += `**${userDisplay}**\n`;
          report += `Previous: ${prev} | Current: ${curr} | Change: ${change}\n\n`;
        }

        const chunks = [];
        let current = '';
        const lines = report.split('\n');
        for (const line of lines) {
          if (current.length + line.length + 1 > 1900) {
            chunks.push(current);
            current = line + '\n';
          } else {
            current += line + '\n';
          }
        }
        if (current) chunks.push(current);

        for (const chunk of chunks) {
          await channel.send(chunk).catch(err => logger.error(`Failed to send might report in ${guildId}: ${err}`));
        }

        for (const d of differences) {
          db.recordMightSnapshot(guildId, d.user_id, d.username, d.current_might);
        }

        db.resetMightBaseline(guildId);
        logger.info(`Auto might report sent for guild ${guildId} (00:00 IST)`);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // ========== BACKGROUND TASK FOR SCHEDULED QUESTIONS (WITH LOGGING) ==========
    setInterval(async () => {
      try {
        const due = db.getDueScheduledQuestions();
        if (due.length > 0) {
          logger.info(`[Scheduler] Found ${due.length} due scheduled questions`);
        }
        for (const question of due) {
          logger.debug(`[Scheduler] Processing question ID ${question.id}, channel_id=${question.channel_id}, status=${question.status}, scheduled_at=${question.scheduled_at}`);
          try {
            const guild = await client.guilds.fetch(question.guild_id);
            const channel = await guild.channels.fetch(question.channel_id);

            if (!channel) {
              logger.error(`❌ Channel ${question.channel_id} not found – skipping question ${question.id}`);
              continue;
            }
            if (![ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread].includes(channel.type)) {
              logger.error(`❌ Channel ${question.channel_id} is not a text channel – skipping question ${question.id}`);
              continue;
            }

            const options = db.getQuestionOptions(question.id);
            await QuestionManager.sendQuestion(channel, { ...question, status: 'scheduled' }, options, true);
            db.setQuestionStatus(question.id, 'sent');
            logger.info(`✅ Scheduled question ${question.id} sent to #${channel.name}`);
          } catch (err) {
            logger.error(`❌ Failed to send scheduled question ${question.id}:`, err);
          }
        }
      } catch (err) {
        logger.error('❌ Error in scheduled question checker:', err);
      }
    }, 60 * 1000);
  });

  // ==================== EVENT: GUILD CREATE ====================
  client.on(Events.GuildCreate, guild => {
    db.createGuild(guild.id, guild.name);
    db.updateGuildName(guild.id, guild.name);
    logger.info(`Joined new guild: ${guild.name} (${guild.id}) - disabled by default`);
  });

  // ==================== EVENT: GUILD DELETE ====================
  client.on(Events.GuildDelete, guild => {
    logger.warn(`Left guild: ${guild.name} (${guild.id})`);
  });

  // ==================== EVENT: GUILD UPDATE ====================
  client.on(Events.GuildUpdate, (oldGuild, newGuild) => {
    if (oldGuild.name !== newGuild.name) {
      db.updateGuildName(newGuild.id, newGuild.name);
      logger.info(`Guild renamed: ${oldGuild.name} → ${newGuild.name} (${newGuild.id})`);
    }
  });

  // ==================== PERMISSION MIDDLEWARE ====================
  async function checkPermissions(interaction) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return false;

    if (command.globalCommand) return true;
    if (interaction.user.id === client.ownerId) return true;

    if (!db.isGuildEnabled(interaction.guildId)) {
      const guild = interaction.guild;
      const guildName = guild ? guild.name : 'Unknown Guild';
      logger.warn(`Guild not enabled: User ${interaction.user.tag} (${interaction.user.id}) tried /${interaction.commandName} in guild ${guildName} (${interaction.guildId})`);
      await interaction.reply({
        content: `${emojis.RED_CROSS} This guild is **not enabled**. Only the bot owner can enable it.`,
        flags: MessageFlags.Ephemeral
      });
      return false;
    }

    if (command.adminOnly) {
      if (!db.isAdmin(interaction.guildId, interaction.user.id)) {
        const guild = interaction.guild;
        const guildName = guild ? guild.name : 'Unknown Guild';
        logger.warn(`Missing admin: User ${interaction.user.tag} (${interaction.user.id}) tried /${interaction.commandName} in guild ${guildName} (${interaction.guildId})`);
        await interaction.reply({
          content: `${emojis.RED_CROSS} You do not have **Admin** permissions in this guild.`,
          flags: MessageFlags.Ephemeral
        });
        return false;
      }
    }

    return true;
  }

  // ==================== INTERACTION HANDLER ====================
  client.on(Events.InteractionCreate, async (interaction) => {
    // ----- BUTTONS -----
    if (interaction.isButton()) {
      // Self‑role
      if (interaction.customId.startsWith('selfrole_')) {
        await SelfRoleManager.handleButton(interaction, client);
        return;
      }

      // Ticket
      if (interaction.customId.startsWith('ticket_open_')) {
        const panelName = interaction.customId.replace('ticket_open_', '');
        const panel = db.getTicketPanel(interaction.guildId, panelName);
        if (!panel) return interaction.reply({ content: `${emojis.ERROR} Panel not found.`, ephemeral: true });

        const modal = new ModalBuilder()
          .setCustomId(`ticket_reason_${panelName}`)
          .setTitle('Open Ticket');
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId.startsWith('ticket_close_')) {
        const TicketManager = require('../systems/ticket/ticketManager');
        const ticketManager = new TicketManager(client);
        await ticketManager.closeTicket(interaction, interaction.channel, interaction.user);
        return;
      }

      if (interaction.customId.startsWith('ticket_claim_')) {
        const TicketManager = require('../systems/ticket/ticketManager');
        const ticketManager = new TicketManager(client);
        await ticketManager.claimTicket(interaction);
        return;
      }

      // Might submission approve/reject
      if (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('reject_')) {
        const [action, submissionId] = interaction.customId.split('_');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const submission = db.getSubmissionById(submissionId);
        if (!submission) {
          return interaction.editReply(`${emojis.ERROR} Submission not found.`);
        }
        if (!db.isAdmin(submission.guild_id, interaction.user.id) && interaction.user.id !== client.ownerId) {
          return interaction.editReply(`${emojis.ERROR} You are not an admin for this guild.`);
        }

        try {
          let finalMessage = '';
          let embedColor;
          let statusText;
          let reason = null;

          if (action === 'approve') {
            db.approveSubmission(submissionId, interaction.user.id, 'Approved via DM');
            finalMessage = `${emojis.SUCCESS} Submission approved.`;
            embedColor = 0x00FF00;
            statusText = 'approved';
          } else {
            await interaction.editReply('Please enter a reason for rejection (within 60 seconds):');
            const filter = m => m.author.id === interaction.user.id;
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000 }).catch(() => null);
            if (!collected || !collected.first()) {
              return interaction.editReply(`${emojis.ERROR} No reason provided, rejection cancelled.`);
            }
            reason = collected.first().content;
            db.rejectSubmission(submissionId, interaction.user.id, reason);
            finalMessage = `${emojis.SUCCESS} Submission rejected.\n**Reason:** ${reason}`;
            embedColor = 0xFF0000;
            statusText = 'rejected';
          }

          const originalEmbed = interaction.message.embeds[0];
          const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(embedColor)
            .setFooter({ text: `Status: ${statusText} by ${interaction.user.tag}` })
            .setTimestamp();

          await interaction.message.edit({
            embeds: [updatedEmbed],
            components: []
          });

          await interaction.editReply(finalMessage);

          try {
            const user = await client.users.fetch(submission.user_id);
            const userEmbed = new EmbedBuilder()
              .setColor(embedColor)
              .setTitle(`Might Submission ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`)
              .setDescription(`Your submission of **${submission.submitted_might}** might has been ${statusText} by an admin.`)
              .setTimestamp();
            if (reason) userEmbed.addFields({ name: 'Reason', value: reason });
            await user.send({ embeds: [userEmbed] });
            logger.success(`${statusText} DM sent to ${user.tag}`);
          } catch (err) {
            logger.warn(`Could not DM user about ${statusText}: ${err.message}`);
          }

          if (client.io) {
            client.io.emit('submissionUpdated', {
              submissionId: submission.id,
              guildId: submission.guild_id,
              status: statusText
            });
          }
        } catch (error) {
          logger.error(`Error handling ${action} button:`, error);
          await interaction.editReply(`${emojis.ERROR} An error occurred.`);
        }
        return;
      }


      if (interaction.customId.startsWith('unban_')) {
  return require('../systems/banNotifier').handleBanButton(interaction);
}



      // ========== QUESTION BUTTONS (with vote changing) ==========
      if (interaction.customId.startsWith('question_')) {
        const parts = interaction.customId.split('_');
        const questionId = parseInt(parts[1]);
        const optionId = parseInt(parts[2]);
        const userId = interaction.user.id;

        const question = db.getQuestion(questionId);
        if (!question || question.guild_id !== interaction.guildId) {
          return interaction.reply({ content: `${emojis.ERROR} This question no longer exists.`, flags: MessageFlags.Ephemeral });
        }
        if (question.status !== 'active') {
          return interaction.reply({ content: `${emojis.ERROR} This question is not active.`, flags: MessageFlags.Ephemeral });
        }

        // Get user's existing responses
        const existingResponses = db.getUserResponsesForQuestion(questionId, userId);

        // If this is a new voter, enforce max_interactions
        if (existingResponses.length === 0) {
          if (question.max_interactions > 0 && existingResponses.length >= question.max_interactions) {
            return interaction.reply({
              content: `${emojis.ERROR} You have already voted the maximum of ${question.max_interactions} time${question.max_interactions === 1 ? '' : 's'}.`,
              flags: MessageFlags.Ephemeral
            });
          }
        }
        // If they already have a vote, they are allowed to change it (no limit check needed)

        // Replace all previous votes with the new selection
        const deleteStmt = db.db.prepare('DELETE FROM question_responses WHERE question_id = ? AND user_id = ?');
        const insertStmt = db.db.prepare('INSERT INTO question_responses (question_id, user_id, option_id) VALUES (?, ?, ?)');
        const transaction = db.db.transaction(() => {
          deleteStmt.run(questionId, userId);
          insertStmt.run(questionId, userId, optionId);
        });

        try {
          transaction();
        } catch (err) {
          logger.error(`Error updating response for question ${questionId}, user ${userId}:`, err);
          return interaction.reply({ content: `${emojis.ERROR} Failed to record your response.`, flags: MessageFlags.Ephemeral });
        }

        // Update the message
        const options = db.getQuestionOptions(questionId);
        const embed = QuestionManager.buildEmbed(question, options);
        const rows = QuestionManager.buildActionRows(questionId, options, false);
        try {
          await interaction.update({ embeds: [embed], components: rows });
        } catch (err) {
          // If update fails (message too old, etc.), just acknowledge
          await interaction.reply({ content: `${emojis.SUCCESS} Your response has been recorded.`, flags: MessageFlags.Ephemeral });
        }
        return;
      }
    }

    // ----- SELECT MENUS -----
    if (interaction.isStringSelectMenu() &&
        (interaction.customId.startsWith('greeting_type_') ||
         interaction.customId.startsWith('dm_greeting_type_'))) {
      try {
        const { selectMenuHandler } = require('../commands/greetings');
        await selectMenuHandler(interaction);
      } catch (error) {
        logger.error('Error handling greetings select menu:', error);
        await interaction.reply({
          content: `${emojis.RED_CROSS} Error processing your selection.`,
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    // ----- MODAL SUBMISSIONS -----
    if (interaction.isModalSubmit()) {
      const modalId = interaction.customId;

      // Greetings modals
      if (modalId.startsWith('greeting_modal_') || modalId.startsWith('dm_greeting_modal_')) {
        try {
          const { modalHandler } = require('../commands/greetings');
          await modalHandler(interaction);
        } catch (error) {
          logger.error('Error handling greetings modal:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: `${emojis.RED_CROSS} Error saving your message.`,
              flags: MessageFlags.Ephemeral
            });
          } else {
            await interaction.editReply({
              content: `${emojis.RED_CROSS} Error saving your message.`
            });
          }
        }
        return;
      }

      // DM sending modals
      if (modalId.startsWith('dm_modal_') || modalId.startsWith('bulk_dm_modal_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const operationId = modalId.replace(/^(dm_modal_|bulk_dm_modal_)/, '');
        const opData = DMManager.retrieveOperation(operationId);

        if (!opData) {
          return interaction.editReply({ content: `${emojis.RED_CROSS} Operation expired. Please try again.` });
        }

        const message = interaction.fields.getTextInputValue('message');
        const thumbnail = interaction.fields.getTextInputValue('thumbnail') || null;
        const color = interaction.fields.getTextInputValue('color');

        const guild = interaction.guild;
        if (!guild) {
          return interaction.editReply({ content: `${emojis.RED_CROSS} Guild not found.` });
        }

        let targetMembers = [];
        let targetName = '';

        if (opData.commandName === 'send_individual') {
          const targetUser = await client.users.fetch(opData.targetUserId);
          const member = await guild.members.fetch(targetUser.id).catch(() => null);
          if (member) {
            targetMembers = [member];
            targetName = targetUser.tag;
          }
        } else {
          const role = await guild.roles.fetch(opData.roleId).catch(() => null);
          if (!role) {
            return interaction.editReply({
              content: `${emojis.RED_CROSS} Role with ID \`${opData.roleId}\` not found. Please reconfigure with /dm_set_roles.`
            });
          }
          targetMembers = [...role.members.values()].filter(m => !m.user.bot);
          targetName = role.name;
        }

        if (targetMembers.length === 0) {
          return interaction.editReply({ content: `${emojis.RED_CROSS} No users found to send DMs to.` });
        }

        await interaction.editReply({ content: `📤 Sending DMs to ${targetMembers.length} user(s)...` });

        const results = await DMManager.sendDMsInBatches(
          targetMembers,
          message,
          opData.attachment,
          guild,
          thumbnail,
          color
        );

        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;

        const boxedLog = DMManager.generateBoxedLog(guild.name, targetName, results);
        console.log('\n' + boxedLog + '\n');

        const summaryEmbed = new EmbedBuilder()
          .setColor(successful > 0 ? 0x00FF00 : 0xFF0000)
          .setTitle(`${emojis.BAR_CHART} DM Sending Complete`)
          .addFields(
            { name: 'Target', value: targetName, inline: true },
            { name: 'Total', value: results.length.toString(), inline: true },
            { name: `${emojis.GREEN_TICK} Success`, value: successful.toString(), inline: true },
            { name: `${emojis.RED_CROSS} Failed`, value: failed.toString(), inline: true }
          )
          .setTimestamp();

        await interaction.channel.send({
          content: `\`\`\`${boxedLog}\`\`\``,
          embeds: [summaryEmbed]
        });

        await interaction.editReply({
          content: `${emojis.GREEN_TICK} DM sending complete! ${successful} sent, ${failed} failed.`
        });
        return;
      }

      // Role change confirmation modal
      if (modalId.startsWith('confirm_role_change_')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const parts = modalId.split('_');
        const roleType = parts[3];
        const newRoleId = parts[4];
        const confirmation = interaction.fields.getTextInputValue('confirmation');

        if (confirmation.toUpperCase() !== 'YES') {
          return interaction.editReply({ content: `${emojis.RED_CROSS} Role change cancelled.` });
        }

        db.setDMRole(interaction.guildId, roleType, newRoleId, interaction.user.id);
        const guildName = interaction.guild?.name || 'Unknown Guild';
        logger.info(`DM role ${roleType} changed to ${newRoleId} in guild ${guildName} (${interaction.guildId}) by ${interaction.user.tag}`);
        await interaction.editReply({ content: `${emojis.GREEN_TICK} **${roleType}** role ID has been updated to \`${newRoleId}\`.` });
        return;
      }

      // Ticket reason modal
      if (modalId.startsWith('ticket_reason_')) {
        const panelName = modalId.replace('ticket_reason_', '');
        const panel = db.getTicketPanel(interaction.guildId, panelName);
        if (!panel) return interaction.reply({ content: `${emojis.ERROR} Panel not found.`, ephemeral: true });

        const reason = interaction.fields.getTextInputValue('reason');
        const TicketManager = require('../systems/ticket/ticketManager');
        const ticketManager = new TicketManager(client);
        await interaction.deferReply({ ephemeral: true });
        const channel = await ticketManager.createTicket(interaction, panel.id, reason);
        await interaction.editReply({ content: `${emojis.SUCCESS} Ticket created: ${channel}` });
        return;
      }

      // Question create modal
      if (modalId === 'question_create') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description') || null;
        const footer = interaction.fields.getTextInputValue('footer') || null;
        const suffix = interaction.fields.getTextInputValue('suffix') || '';
        const maxInteractions = parseInt(interaction.fields.getTextInputValue('max_interactions')) || 1;

        const result = db.createQuestion(interaction.guildId, title, description, footer, suffix, maxInteractions, interaction.user.id);
        const questionId = result.lastInsertRowid;

        await interaction.editReply({
          content: `${emojis.SUCCESS} Question created with ID **${questionId}**. Now add options using \`/question option question_id:${questionId}\`.`
        });
        return;
      }

      // ========== QUESTION SCHEDULE MODAL (WITH LOGGING) ==========
      if (modalId.startsWith('question_schedule_')) {
        const parts = modalId.split('_');
        const questionId = parseInt(parts[2]);
        const timezone = parts.slice(3, parts.length - 1).join('_');
        const channelId = parts[parts.length - 1];

        logger.debug(`[Schedule Modal] Received: questionId=${questionId}, timezone=${timezone}, channelId=${channelId}`);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const dateStr = interaction.fields.getTextInputValue('date');
        const timeStr = interaction.fields.getTextInputValue('time');
        const dateTimeStr = `${dateStr}T${timeStr}`;

        const dt = DateTime.fromISO(dateTimeStr, { zone: timezone });
        if (!dt.isValid) {
          return interaction.editReply({ content: `${emojis.ERROR} Invalid date/time or timezone.` });
        }
        const scheduledAt = dt.toMillis();

        const question = db.getQuestion(questionId);
        if (!question || question.guild_id !== interaction.guildId) {
          return interaction.editReply({ content: `${emojis.ERROR} Question not found.` });
        }

        logger.debug(`[Schedule Modal] Saving: scheduledAt=${scheduledAt}, channelId=${channelId}`);
        db.setQuestionScheduled(questionId, scheduledAt);
        db.setQuestionChannel(questionId, channelId);

        // Verify the update
        const updated = db.getQuestion(questionId);
        logger.debug(`[Schedule Modal] After update: channel_id=${updated.channel_id}, status=${updated.status}`);

        await interaction.editReply({ content: `${emojis.SUCCESS} Question scheduled for <t:${Math.floor(scheduledAt/1000)}:F> (your local time).` });
        return;
      }
    }

    // ----- CHAT INPUT COMMANDS -----
    if (interaction.isChatInputCommand()) {
      logger.command(interaction);
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      const hasPermission = await checkPermissions(interaction);
      if (!hasPermission) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        logger.error(`Error executing ${interaction.commandName}:`, error);
        const reply = {
          content: `${emojis.RED_CROSS} There was an error executing this command.`,
          flags: MessageFlags.Ephemeral
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    }

    // ----- AUTOCOMPLETE -----
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.error(`Autocomplete error for ${interaction.commandName}:`, error);
      }
    }
  });

  // ==================== GUILD MEMBER EVENTS ====================
  client.on(Events.GuildMemberAdd, async (member) => {
    logger.info(`[GuildMemberAdd] ${member.user.tag} (${member.user.id}) joined guild ${member.guild.name} (${member.guild.id})`);
    try {
      await GreetingsManager.handleMemberJoin(member, client);
      await client.inviteTracker?.handleGuildMemberAdd(member);
    } catch (error) {
      logger.error('Error in GuildMemberAdd:', error);
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    logger.info(`[GuildMemberRemove] ${member.user?.tag || member.id} left guild ${member.guild?.name || member.guild?.id}`);
    try {
      await GreetingsManager.handleMemberLeave(member, client);
      await client.inviteTracker?.handleGuildMemberRemove(member);
    } catch (error) {
      logger.error('Error in GuildMemberRemove:', error);
    }
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    logger.info(`[GuildBanAdd] ${ban.user.tag} (${ban.user.id}) banned from guild ${ban.guild.name} (${ban.guild.id})`);
    try {
      await GreetingsManager.handleBan(ban.guild, ban.user, client);
    } catch (error) {
      logger.error('Error in GuildBanAdd:', error);
    }
  });

  client.on(Events.InviteCreate, async (invite) => {
    await client.inviteTracker?.handleInviteCreate(invite);
  });

  client.on(Events.InviteDelete, async (invite) => {
    await client.inviteTracker?.handleInviteDelete(invite);
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (channel.type === ChannelType.GuildText) {
      const ticket = db.getTicketByChannel(channel.id);
      if (ticket) {
        db.prepare('DELETE FROM tickets WHERE channel_id = ?').run(channel.id);
        logger.info(`Ticket channel ${channel.name} deleted, removed from DB.`);
      }
    }
  });

  // ==================== GRACEFUL SHUTDOWN ====================
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    if (dmDeletion) dmDeletion.shutdown();
    client.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...');
    if (dmDeletion) dmDeletion.shutdown();
    client.destroy();
    process.exit(0);
  });

  // ==================== LOGIN ====================
  await client.login(process.env.TOKEN);
  return client;
}

module.exports = { startBot };
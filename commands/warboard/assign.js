const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { BASE_CHOICES, BASES } = require('../../config');
const db = require('../../database');
const { logger } = require('../../utils/logger');
const { parseDate, formatDateDisplay } = require('../../utils/dateUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warboard_assign')
    .setDescription('Assign a player to a base for a specific war date')
    .addStringOption(opt =>
      opt.setName('date')
        .setDescription('Date: DD MMM YYYY (e.g., 12 Feb 2026) or YYYY-MM-DD')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt =>
      opt.setName('base')
        .setDescription('Select a base')
        .setRequired(true)
        .addChoices(...BASE_CHOICES)
    )
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user (if they are in the server)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('In‑game name (if user not in Discord)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(opt =>
      opt.setName('might')
        .setDescription('Might value (e.g., 1200 or 2500.5)')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('mention')
        .setDescription('Mention the player when posting the warboard? (default true, only applies if user is provided)')
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const guildId = interaction.guildId;

    if (focusedOption.name === 'date') {
      const dates = db.getWarboardDates(guildId);
      const choices = dates.map(stored => ({
        name: formatDateDisplay(stored),
        value: stored
      }));
      const filtered = choices.filter(choice =>
        choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
      ).slice(0, 25);
      await interaction.respond(filtered);
    } else if (focusedOption.name === 'name') {
      // Only show unlinked names (user_id IS NULL)
      const usernames = db.getUnlinkedUsernames(guildId, focusedOption.value);
      const choices = usernames.map(name => ({ name, value: name }));
      await interaction.respond(choices.slice(0, 25));
    }
  },

  async execute(interaction) {
    const dateInput = interaction.options.getString('date');
    const base = interaction.options.getString('base');
    const userOption = interaction.options.getUser('user');
    const nameOption = interaction.options.getString('name');
    const mightStr = interaction.options.getString('might') || '0';
    const mention = interaction.options.getBoolean('mention') ?? true;
    const guildId = interaction.guildId;

    if (!userOption && !nameOption) {
      return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> You must provide either a Discord user or an in‑game name.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parsedDate = parseDate(dateInput);
    if (!parsedDate) {
      return interaction.editReply('<a:Red_cross_mark:1479397724603416606> Invalid date format. Use `DD MMM YYYY` (e.g., 12 Feb 2026) or `YYYY-MM-DD` (e.g., 2026-02-12).');
    }

    const baseConfig = BASES.find(b => b.name === base);
    if (!baseConfig) {
      return interaction.editReply('<a:Red_cross_mark:1479397724603416606> Invalid base selected.');
    }

    const assignments = db.getAssignments(guildId, parsedDate);
    const countInBase = assignments.filter(a => a.base === base).length;
    if (countInBase >= baseConfig.capacity) {
      return interaction.editReply(`<a:Red_cross_mark:1479397724603416606> **${base}** is already full (${baseConfig.capacity}/${baseConfig.capacity}). Cannot assign more.`);
    }

    let userId = null;
    let username = '';
    let effectiveMention = mention ? 1 : 0;

    if (userOption) {
      userId = userOption.id;
      username = userOption.tag;
      effectiveMention = mention ? 1 : 0;
    } else {
      username = nameOption.trim();
      effectiveMention = 0; // no mention for non‑Discord players
    }

    // Check if the user already has an assignment on this date
    let existing = null;
    if (userId) {
      existing = db.getAssignmentByUser(guildId, parsedDate, userId);
    } else {
      existing = db.getAssignmentByName(guildId, parsedDate, username);
    }

    let warning = '';
    if (existing) {
      warning = `<a:Red_info:1479392711055245405> **${username}** already assigned to **${existing.base}** (Might: ${existing.might || '0'}) on this date. It will be overwritten.\n\n`;
    }

    // Might validation: cannot decrease
    const mightValue = parseFloat(mightStr) || 0;
    if (userId) {
      const lastMight = db.getLatestMight(guildId, userId);
      if (lastMight !== null && mightValue < lastMight) {
        return interaction.editReply(`<a:Red_cross_mark:1479397724603416606> Might cannot decrease. Last recorded might for **${username}** was **${lastMight}**.`);
      }
    }

    db.createWarboard(guildId, parsedDate);
    db.saveAssignment(guildId, parsedDate, userId, username, base, mightStr, effectiveMention);

    if (userId) {
      db.updatePlayerMight(guildId, userId, username, mightValue);
    }

    logger.info(`Assigned ${username} (${userId || 'no Discord'}) | Date: ${parsedDate} | Base: ${base} | Might: ${mightStr} | Mention: ${effectiveMention} | Guild: ${guildId}`);

    const displayDate = formatDateDisplay(parsedDate);
    const response = warning + (userId
      ? `<a:Green_tick_mark:1479393702031134730> Assigned **${username}** to **${base}** for **${displayDate}**.`
      : `<a:Green_tick_mark:1479393702031134730> Assigned in‑game name **${username}** to **${base}** for **${displayDate}**. Use \`/warboard_link\` when they join the server.`);

    await interaction.editReply({ content: response });
  }
};
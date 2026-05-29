const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');
const { parseDate, formatDateDisplay } = require('../../utils/dateUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warboard_copy')
    .setDescription('Copy assignments from a source date to a target date')
    .addStringOption(opt =>
      opt.setName('source')
        .setDescription('Source date (e.g., 12 Feb 2026)')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(opt =>
      opt.setName('target')
        .setDescription('Target date (e.g., 15 Feb 2026)')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('max_per_base')
        .setDescription('Maximum players per base to copy (optional)')
        .setRequired(false)
        .setMinValue(1)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    const dates = db.getWarboardDates(guildId);
    const choices = dates.map(stored => ({
      name: formatDateDisplay(stored),
      value: stored
    }));
    const filtered = choices.filter(choice =>
      choice.name.toLowerCase().includes(focusedValue.toLowerCase())
    ).slice(0, 25);
    await interaction.respond(filtered);
  },

  async execute(interaction) {
    const sourceInput = interaction.options.getString('source');
    const targetInput = interaction.options.getString('target');
    const maxPerBase = interaction.options.getInteger('max_per_base');
    const guildId = interaction.guildId;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sourceDate = parseDate(sourceInput);
    const targetDate = parseDate(targetInput);
    if (!sourceDate || !targetDate) {
      return interaction.editReply('<a:Red_cross_mark:1479397724603416606> Invalid date format. Use `DD MMM YYYY` or `YYYY-MM-DD`.');
    }

    if (sourceDate === targetDate) {
      return interaction.editReply('<a:Red_cross_mark:1479397724603416606> Source and target dates must be different.');
    }

    const sourceAssignments = db.getAssignments(guildId, sourceDate);
    if (sourceAssignments.length === 0) {
      return interaction.editReply('<a:Red_cross_mark:1479397724603416606> No assignments found for the source date.');
    }

    // Check target date already has assignments? Warn but proceed?
    const targetAssignments = db.getAssignments(guildId, targetDate);
    if (targetAssignments.length > 0) {
      // Optionally ask for confirmation, but we'll just warn.
      await interaction.editReply('<a:Red_info:1479392711055245405> Target date already has assignments. They will not be overwritten (copy will add duplicates).');
    }

    db.createWarboard(guildId, targetDate); // ensure target warboard exists

    const copiedCount = db.copyAssignments(guildId, sourceDate, targetDate, maxPerBase);

    logger.info(`Copied ${copiedCount} assignments from ${sourceDate} to ${targetDate} in guild ${guildId} by ${interaction.user.tag}`);

    await interaction.editReply(`<a:Green_tick_mark:1479393702031134730> Copied **${copiedCount}** assignments from **${formatDateDisplay(sourceDate)}** to **${formatDateDisplay(targetDate)}**.`);
  }
};
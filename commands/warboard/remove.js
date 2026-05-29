const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');
const { parseDate, formatDateDisplay } = require('../../utils/dateUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warboard_remove')
    .setDescription('Remove a player assignment')
    .addStringOption(opt => 
      opt.setName('date')
        .setDescription('War date')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addUserOption(opt => 
      opt.setName('user')
        .setDescription('Discord user to remove')
        .setRequired(false)
    )
    .addStringOption(opt => 
      opt.setName('name')
        .setDescription('In‑game name to remove (unlinked players only)')
        .setRequired(false)
        .setAutocomplete(true)
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
    const user = interaction.options.getUser('user');
    const name = interaction.options.getString('name');
    const guildId = interaction.guildId;

    if (!user && !name) {
      return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> You must provide either a Discord user or an in‑game name.', flags: MessageFlags.Ephemeral });
    }
    if (user && name) {
      return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Provide only one: either a user or a name, not both.', flags: MessageFlags.Ephemeral });
    }

    const parsedDate = parseDate(dateInput);
    if (!parsedDate) {
      return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Invalid date format.', flags: MessageFlags.Ephemeral });
    }
    
    let assignment = null;
    let identifier = '';
    if (user) {
      assignment = db.getAssignmentByUser(guildId, parsedDate, user.id);
      identifier = user.tag;
    } else {
      assignment = db.getAssignmentByName(guildId, parsedDate, name);
      identifier = name;
    }

    if (!assignment) {
      return interaction.reply({ content: `<a:Red_cross_mark:1479397724603416606> No assignment found for **${identifier}** on **${formatDateDisplay(parsedDate)}**.`, flags: MessageFlags.Ephemeral });
    }
    
    // Show what will be removed
    await interaction.reply({
      content: `<a:Waste_basket:1479401658914963537> Removing assignment for **${identifier}** on **${formatDateDisplay(parsedDate)}**:
• Base: **${assignment.base}**
• Might: **${assignment.might || '0'}**`,
      flags: MessageFlags.Ephemeral
    });
    
    // Perform removal
    if (user) {
      db.removeAssignment(guildId, parsedDate, user.id);
    } else {
      // Ensure we only remove if user_id IS NULL (extra safety)
      if (assignment.user_id !== null) {
        return interaction.followUp({ content: '<a:Red_cross_mark:1479397724603416606> This name is linked to a Discord user – remove using the user option.', flags: MessageFlags.Ephemeral });
      }
      db.removeAssignmentByName(guildId, parsedDate, name);
    }
    logger.info(`Removed ${identifier} from ${parsedDate} in guild ${guildId} by ${interaction.user.tag}`);
  }
};
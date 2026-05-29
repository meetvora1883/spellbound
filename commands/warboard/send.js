const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const db = require('../../database');
const WarboardManager = require('../../systems/warboard/warboardManager');
const { logger } = require('../../utils/logger');
const { parseDate, formatDateDisplay } = require('../../utils/dateUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warboard_send')
    .setDescription('Post the warboard to a channel and optionally DM all players')
    .addStringOption(opt => 
      opt.setName('date')
        .setDescription('War date')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addChannelOption(opt => 
      opt.setName('channel')
        .setDescription('Channel to post')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addBooleanOption(opt => 
      opt.setName('dm_all')
        .setDescription('Send DM to all assigned players?')
        .setRequired(false)
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
  
  async execute(interaction, client) {
    const dateInput = interaction.options.getString('date');
    const channel = interaction.options.getChannel('channel');
    const dmAll = interaction.options.getBoolean('dm_all') || false;
    const guildId = interaction.guildId;
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const parsedDate = parseDate(dateInput);
    if (!parsedDate) {
      return interaction.editReply('<a:Red_cross_mark:1479397724603416606> Invalid date format.');
    }
    
    const assignments = db.getAssignments(guildId, parsedDate);
    if (assignments.length === 0) {
      return interaction.editReply('<a:Red_cross_mark:1479397724603416606> No assignments found for this date.');
    }
    
    const messageChunks = WarboardManager.buildWarboardMessageChunks(guildId, parsedDate, assignments);
    for (const chunk of messageChunks) {
      await channel.send(chunk);
    }
    
    db.saveWarboardMessage(guildId, parsedDate, channel.id, 'multiple');
    
    let dmResult = '';
    if (dmAll) {
      await interaction.editReply('<a:mail:1479425776502702261> Sending DMs in batches of 5...');
      const results = await WarboardManager.dmAllAssigned(client, guildId, parsedDate);
      const success = results.filter(r => r.success).length;
      const failed = results.length - success;
      dmResult = `\<a:mail:1479425776502702261> DMs: ${success} sent, ${failed} failed.`;
    }
    
    const displayDate = formatDateDisplay(parsedDate);
    logger.info(`Warboard for ${displayDate} posted in #${channel.name} (${guildId}) - ${messageChunks.length} messages`);
    await interaction.editReply(`<a:Green_tick_mark:1479393702031134730> Warboard posted in ${channel} (${messageChunks.length} messages)${dmResult}`);
  }
};
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('access_denyguild')
    .setDescription('Disable a guild (owner only)')
    .addStringOption(opt => 
      opt.setName('guild_id')
        .setDescription('Select a guild to disable')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  
  async autocomplete(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.respond([]);
    }
    
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const guilds = interaction.client.guilds.cache;
    
    const choices = guilds
      .filter(guild => db.isGuildEnabled(guild.id))
      .map(guild => ({
        name: `${guild.name} (${guild.id}) – <a:Green_tick_mark:1479393702031134730> Enabled`,
        value: guild.id
      }));
    
    const filtered = choices.filter(choice =>
      choice.name.toLowerCase().includes(focusedValue)
    ).slice(0, 25);
    
    await interaction.respond(filtered);
  },
  
    async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Only the bot owner can disable guilds.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.options.getString('guild_id');
    const guild = interaction.client.guilds.cache.get(guildId);

    if (!guild) {
      return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Bot is not in that guild.', flags: MessageFlags.Ephemeral });
    }

    if (!db.isGuildEnabled(guildId)) {
      return interaction.reply({
        content: `<a:Info_text:1479392709188915313> Guild **${guild.name}** (${guildId}) is already **disabled**.`,
        flags: MessageFlags.Ephemeral
      });
    }

    db.disableGuild(guildId);
    
    // 🔹 IMPROVED: Log with guild name
    logger.success(`Guild disabled: ${guild.name} (${guildId}) by owner ${interaction.user.tag}`);
    
    await interaction.reply({
      content: `<a:Green_tick_mark:1479393702031134730> Guild **${guild.name}** (${guildId}) is now **disabled**.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
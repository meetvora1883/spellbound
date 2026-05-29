const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('access_allowguild')
    .setDescription('Enable a guild (owner only)')
    .addStringOption(opt => 
      opt.setName('guild_id')
        .setDescription('Select a guild to enable')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  
  async autocomplete(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.respond([]);
    }
    
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const guilds = interaction.client.guilds.cache;
    
    const choices = guilds.map(guild => {
      const isEnabled = db.isGuildEnabled(guild.id);
      const status = isEnabled ? '<a:Green_tick_mark:1479393702031134730> Enabled' : '<a:Red_cross_mark:1479397724603416606> Disabled';
      return {
        name: `${guild.name} (${guild.id}) – ${status}`,
        value: guild.id
      };
    });
    
    const filtered = choices.filter(choice =>
      choice.name.toLowerCase().includes(focusedValue)
    ).slice(0, 25);
    
    await interaction.respond(filtered);
  },
  
    async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Only the bot owner can enable guilds.', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.options.getString('guild_id');
    const guild = interaction.client.guilds.cache.get(guildId);

    if (!guild) {
      return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Bot is not in that guild.', flags: MessageFlags.Ephemeral });
    }

    if (db.isGuildEnabled(guildId)) {
      return interaction.reply({
        content: `<a:Info_text:1479392709188915313> Guild **${guild.name}** (${guildId}) is already **enabled**.`,
        flags: MessageFlags.Ephemeral
      });
    }

    db.enableGuild(guildId);
    db.updateGuildName(guildId, guild.name);
    
    // 🔹 IMPROVED: Log with guild name
    logger.success(`Guild enabled: ${guild.name} (${guildId}) by owner ${interaction.user.tag}`);
    
    await interaction.reply({
      content: `<a:Green_tick_mark:1479393702031134730> Guild **${guild.name}** (${guildId}) is now **enabled**.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('access_grant')
    .setDescription('Grant admin privileges to a user (owner only)')
    .addUserOption(opt => 
      opt.setName('user')
        .setDescription('User to grant')
        .setRequired(true)
    ),
  
    async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({ 
        content: '<a:Red_cross_mark:1479397724603416606> Only the bot owner can grant admin.', 
        flags: MessageFlags.Ephemeral 
      });
    }

    const user = interaction.options.getUser('user');
    const guildId = interaction.guildId;
    const guild = interaction.guild;
    const guildName = guild ? guild.name : 'Unknown Guild';

    if (db.isAdmin(guildId, user.id)) {
      return interaction.reply({
        content: `<a:Info_text:1479392709188915313> **${user.tag}** is already an admin in this guild.`,
        flags: MessageFlags.Ephemeral
      });
    }

    db.addAdmin(guildId, user.id);
    
    // 🔹 IMPROVED: Log with guild name
    logger.success(`Admin granted: ${user.tag} in guild ${guildName} (${guildId}) by owner ${interaction.user.tag}`);
    
    await interaction.reply({
      content: `<a:Green_tick_mark:1479393702031134730> Granted **admin** to ${user.tag} in this guild.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
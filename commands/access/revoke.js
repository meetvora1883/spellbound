const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('access_revoke')
    .setDescription('Revoke admin privileges from a user (owner only)')
    .addStringOption(opt => 
      opt.setName('user')
        .setDescription('Select an admin to revoke (username or ID)')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  
  async autocomplete(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.respond([]);
    }

    const focusedValue = interaction.options.getFocused().toLowerCase();
    const guildId = interaction.guildId;
    if (!guildId) return interaction.respond([]);

    const adminIds = db.getGuildAdmins(guildId);
    const guild = interaction.guild;
    const adminChoices = [];

    for (const id of adminIds) {
      try {
        const member = await guild.members.fetch(id).catch(() => null);
        if (member) {
          adminChoices.push({
            name: `${member.user.username} (${member.user.id})`,
            value: member.user.id
          });
        } else {
          adminChoices.push({
            name: `Unknown User (${id})`,
            value: id
          });
        }
      } catch {
        adminChoices.push({
          name: `Unknown User (${id})`,
          value: id
        });
      }
    }

    const filtered = adminChoices.filter(choice =>
      choice.name.toLowerCase().includes(focusedValue) ||
      choice.value.includes(focusedValue)
    ).slice(0, 25);

    await interaction.respond(filtered);
  },
  
    async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({ 
        content: '<a:Red_cross_mark:1479397724603416606> Only the bot owner can revoke admin.', 
        flags: MessageFlags.Ephemeral 
      });
    }

    const userIdInput = interaction.options.getString('user');
    const guildId = interaction.guildId;
    const guild = interaction.guild;
    const guildName = guild ? guild.name : 'Unknown Guild';

    let targetUserId = userIdInput;
    const mentionMatch = userIdInput.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
      targetUserId = mentionMatch[1];
    }

    if (!db.isAdmin(guildId, targetUserId)) {
      return interaction.reply({
        content: `<a:Info_text:1479392709188915313> <@${targetUserId}> is not an admin in this guild.`,
        flags: MessageFlags.Ephemeral
      });
    }

    let userTag = targetUserId;
    try {
      const user = await interaction.client.users.fetch(targetUserId);
      userTag = user.tag;
    } catch {
      userTag = targetUserId;
    }

    db.removeAdmin(guildId, targetUserId);
    
    // 🔹 IMPROVED: Log with guild name
    logger.success(`Admin revoked: ${userTag} from guild ${guildName} (${guildId}) by owner ${interaction.user.tag}`);

    await interaction.reply({
      content: `<a:Green_tick_mark:1479393702031134730> Revoked **admin** from <@${targetUserId}> in this guild.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
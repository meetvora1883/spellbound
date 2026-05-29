// commands/dm/revoke.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm_revoke')
    .setDescription('Revoke DM permission from a user (Owner only)')
    .addStringOption(opt =>
      opt.setName('user')
        .setDescription('Select a user and permission to revoke')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.respond([]);
    }

    const focusedValue = interaction.options.getFocused().toLowerCase();
    const users = db.getAllDMPermissions(); // array of { userId, permissions, grantedAt }

    const choices = [];
    for (const u of users) {
      // Fetch username from Discord API (cache)
      let username = u.userId;
      try {
        const user = await interaction.client.users.fetch(u.userId);
        username = user.tag;
      } catch {}

      // For each permission the user has, create a separate choice
      u.permissions.forEach(perm => {
        const displayName = `${username} - ${perm} (${u.userId})`;
        const value = `${u.userId}|${perm}`; // encode both user ID and permission
        if (displayName.toLowerCase().includes(focusedValue) || u.userId.includes(focusedValue)) {
          choices.push({ name: displayName, value });
        }
      });
    }

    // Limit to 25 choices
    await interaction.respond(choices.slice(0, 25));
  },

    async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({ 
        content: '<a:Red_cross_mark:1479397724603416606> Only the bot owner can revoke DM permissions.',
        flags: MessageFlags.Ephemeral 
      });
    }

    const rawValue = interaction.options.getString('user');
    const [userId, permission] = rawValue.split('|');

    if (!db.hasDMPermission(userId, permission)) {
      return interaction.reply({
        content: `<a:Info_text:1479392709188915313> User does not have "${permission}" permission.`,
        flags: MessageFlags.Ephemeral
      });
    }

    db.revokeDMPermission(userId, permission);

    let userTag = userId;
    try {
      const user = await interaction.client.users.fetch(userId);
      userTag = user.tag;
    } catch {}

    let context = '';
    if (interaction.guild) {
      context = ` in guild ${interaction.guild.name} (${interaction.guildId})`;
    }

    logger.success(`DM permission "${permission}" revoked from ${userTag}${context} by owner ${interaction.user.tag}`);

    await interaction.reply({
      content: `<a:Green_tick:1479397724603416606> Revoked **${permission}** DM permission from **${userTag}**.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
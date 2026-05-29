// commands/dm/list.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { formatDateDisplay } = require('../../utils/dateUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm_list')
    .setDescription('List all users with DM permissions (Owner only)'),

  async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({
        content: '<a:Red_cross_mark:1479397724603416606> Only the bot owner can view DM permissions.',
        flags: MessageFlags.Ephemeral
      });
    }

    const users = db.getAllDMPermissions();
    if (users.length === 0) {
      return interaction.reply({ content: '📭 No users have DM permissions.', flags: MessageFlags.Ephemeral });
    }

    // Fetch usernames for all users concurrently
    const userPromises = users.map(async (u) => {
      try {
        const user = await interaction.client.users.fetch(u.userId);
        return { ...u, username: user.tag };
      } catch {
        return { ...u, username: u.userId };
      }
    });
    const usersWithNames = await Promise.all(userPromises);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('<a:Loading_book:1479392698501959752> DM Permission List')
      .setDescription(`Total **${users.length}** user(s) with DM access.`)
      .setTimestamp();

    usersWithNames.forEach(u => {
      const grantedDate = new Date(u.grantedAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      embed.addFields({
        name: `<a:Memebrs:1479421309372072038> ${u.username}`,
        value: `**ID:** ${u.userId}\n**Permissions:** ${u.permissions.join(', ')}\n**Granted:** ${grantedDate}`,
        inline: false
      });
    });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
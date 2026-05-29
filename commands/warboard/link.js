const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warboard_link')
    .setDescription('Link an in‑game name to a Discord user, updating all past assignments')
    .addStringOption(opt =>
      opt.setName('ign')
        .setDescription('The in‑game name previously used in assignments')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The Discord user to link to')
        .setRequired(true)
    ),

  async execute(interaction) {
    const ign = interaction.options.getString('ign');
    const user = interaction.options.getUser('user');
    const guildId = interaction.guildId;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Check if the user is in the guild
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.editReply('<a:Red_cross_mark:1479397724603416606> That user is not in this server.');
    }

    // Update assignments
    db.linkNameToUser(guildId, ign, user.id, user.tag);

    logger.info(`Linked in‑game name "${ign}" to ${user.tag} in guild ${guildId} by ${interaction.user.tag}`);

    await interaction.editReply(`<a:Green_tick_mark:1479393702031134730> All past assignments with the name **${ign}** have been updated to mention **${user.tag}**.`);
  }
};
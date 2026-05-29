// commands/backup.js
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { uploadBackup } = require('../systems/backup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Manage backups')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('test')
      .setDescription('Run a manual backup now')
    ),

  async execute(interaction, client) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({
        content: 'Only the bot owner can use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply('🔄 Running backup...');

    try {
      await uploadBackup(client);
      await interaction.editReply('✅ Backup completed! Check the console for details.');
    } catch (err) {
      await interaction.editReply(`❌ Backup failed: ${err.message}`);
    }
  }
};
// systems/selfrole/selfroleManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

class SelfRoleManager {
  /**
   * Build the embed and buttons for a panel.
   */
  static buildPanel(guild, panel, buttons) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(panel.title)
      .setDescription(panel.description || null)
      .setFooter({ text: panel.footer || 'Self‑Role System' })
      .setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    for (const btn of buttons) {
      const role = guild.roles.cache.get(btn.role_id);
      const label = role ? role.name : 'Unknown Role';
      
      let emoji = null;
      if (btn.emoji) {
        if (btn.emoji.match(/^[0-9]+$/)) {
          emoji = guild.emojis.cache.get(btn.emoji) || btn.emoji;
        } else {
          emoji = btn.emoji;
        }
      }

      const button = new ButtonBuilder()
        .setCustomId(`selfrole_${guild.id}_${panel.panel_name}_${btn.role_id}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary);

      if (emoji) {
        if (typeof emoji === 'string') button.setEmoji(emoji);
        else button.setEmoji(emoji.id);
      }

      currentRow.addComponents(button);
      buttonCount++;

      if (buttonCount === 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
        buttonCount = 0;
      }
    }

    if (buttonCount > 0) rows.push(currentRow);
    return { embeds: [embed], components: rows };
  }

  /**
   * Handle a button interaction for self‑roles.
   */
  static async handleButton(interaction, client) {
    const { customId, guild, member } = interaction;
    if (!guild || !member) return;

    const parts = customId.split('_');
    if (parts.length < 4) return;
    const panelName = parts[2];
    const roleId = parts[3];

    const panel = db.getSelfRolePanel(guild.id, panelName);
    if (!panel) {
      return interaction.reply({
        content: '❌ This self‑role panel no longer exists.',
        ephemeral: true
      });
    }

    const buttons = db.getSelfRoleButtons(guild.id, panelName);
    const roleIdsInPanel = buttons.map(b => b.role_id);
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      return interaction.reply({
        content: '❌ The role for this button no longer exists.',
        ephemeral: true
      });
    }

    if (!guild.members.me.permissions.has('ManageRoles')) {
      return interaction.reply({
        content: '❌ I do not have permission to manage roles.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      let action = '';
      let removedRoles = [];

      if (panel.mode === 'single') {
        for (const rid of roleIdsInPanel) {
          if (rid !== roleId && member.roles.cache.has(rid)) {
            await member.roles.remove(rid);
            removedRoles.push(rid);
          }
        }
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId);
          action = 'added';
        } else {
          action = 'already_had';
        }
      } else {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
          action = 'removed';
        } else {
          await member.roles.add(roleId);
          action = 'added';
        }
      }

      // Send DM with auto‑delete
      await SelfRoleManager.sendRoleDM(
        client,
        member.user,
        role,
        action,
        interaction.guild.name
      );

      let replyContent = '';
      if (action === 'added') {
        replyContent = `✅ You have been given the **${role.name}** role.`;
      } else if (action === 'removed') {
        replyContent = `❌ The **${role.name}** role has been removed from you.`;
      } else if (action === 'already_had') {
        replyContent = `ℹ️ You already have the **${role.name}** role.`;
      }

      if (removedRoles.length > 0) {
        const removedNames = removedRoles.map(r => `<@&${r}>`).join(', ');
        replyContent += `\n⚠️ Removed conflicting role(s): ${removedNames}`;
      }

      await interaction.editReply({ content: replyContent });
      logger.info(`SelfRole: ${member.user.tag} ${action} role ${role.name} in guild ${guild.name} (${guild.id})`);

    } catch (error) {
      logger.error(`SelfRole button error: ${error.message}`);
      await interaction.editReply({ content: '❌ Failed to update roles. Please try again.' });
    }
  }

  /**
   * Send DM with role change notification – auto‑deletes after 24h.
   */
  static async sendRoleDM(client, user, role, action, guildName) {
    try {
      const embed = new EmbedBuilder()
        .setColor(action === 'added' ? 0x00FF00 : 0xFF0000)
        .setTitle(`Self‑Role ${action === 'added' ? 'Added' : 'Removed'}`)
        .setDescription(`**Role:** ${role.name}\n**Action:** ${action === 'added' ? 'Added to' : 'Removed from'} your account`)
        .addFields(
          { name: 'Server', value: guildName, inline: true },
          { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: 'Note', value: 'This message will auto‑delete in 24 hours', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Self‑Role System' });

      const dmMessage = await user.send({ embeds: [embed] });
      
      // Schedule deletion after 24h using the DM deletion system
      if (client.dmDeletion) {
        client.dmDeletion.scheduleDeletion(user.id, dmMessage.id, Date.now());
      }

      logger.success(`SelfRole DM sent to ${user.tag} for role ${role.name}`);
      return true;
    } catch (error) {
      if (error.code === 50007) {
        logger.warn(`Cannot send DM to ${user.tag}: DMs disabled`);
      } else {
        logger.error(`Error sending SelfRole DM to ${user.tag}: ${error.message}`);
      }
      return false;
    }
  }
}

module.exports = SelfRoleManager;
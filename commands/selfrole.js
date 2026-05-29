// commands/selfrole.js
const { SlashCommandBuilder, MessageFlags, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../database');
const SelfRoleManager = require('../systems/selfrole/selfroleManager');
const { logger } = require('../utils/logger');

const MODE_CHOICES = [
  { name: 'Single (only one role allowed)', value: 'single' },
  { name: 'Multi (any number of roles)', value: 'multi' }
];

const BUTTON_STYLES = [
  { name: 'Primary (blue)', value: 'primary' },
  { name: 'Secondary (grey)', value: 'secondary' },
  { name: 'Success (green)', value: 'success' },
  { name: 'Danger (red)', value: 'danger' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('selfrole')
    .setDescription('Self‑role panel management')

    // ----- create -----
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new self‑role panel')
        .addStringOption(opt => opt.setName('panel').setDescription('Unique panel name (letters, numbers, hyphens only – no spaces/underscores)').setRequired(true))
        .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(true))
        .addStringOption(opt => opt.setName('mode').setDescription('Role selection mode').setRequired(true).addChoices(...MODE_CHOICES))
        .addStringOption(opt => opt.setName('footer').setDescription('Embed footer').setRequired(false))
        .addIntegerOption(opt => opt.setName('max_roles').setDescription('Maximum roles in multi mode (0 = unlimited)').setRequired(false).setMinValue(0).setMaxValue(25))
    )

    // ----- addrole -----
    .addSubcommand(sub =>
      sub.setName('addrole')
        .setDescription('Add a role button to a panel')
        .addStringOption(opt => opt.setName('panel').setDescription('Panel name').setRequired(true).setAutocomplete(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('Emoji (unicode or custom emoji mention, e.g. <:name:123>)').setRequired(true))
        .addStringOption(opt => opt.setName('style').setDescription('Button colour').setRequired(false).addChoices(...BUTTON_STYLES))
        .addIntegerOption(opt => opt.setName('position').setDescription('Button position (1‑25). Default: end').setRequired(false).setMinValue(1).setMaxValue(25))
    )

    // ----- send -----
    .addSubcommand(sub =>
      sub.setName('send')
        .setDescription('Send the panel to a channel')
        .addStringOption(opt => opt.setName('panel').setDescription('Panel name').setRequired(true).setAutocomplete(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )

    // ----- remove -----
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove the panel message (keep configuration)')
        .addStringOption(opt => opt.setName('panel').setDescription('Panel name').setRequired(true).setAutocomplete(true))
    )

    // ----- delete -----
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete the panel and all its roles')
        .addStringOption(opt => opt.setName('panel').setDescription('Panel name').setRequired(true).setAutocomplete(true))
    )

    // ----- list -----
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all self‑role panels in this server')
    )

    // ----- access group -----
    .addSubcommandGroup(group =>
      group.setName('access')
        .setDescription('Manage self‑role administrators')
        .addSubcommand(sub =>
          sub.setName('grant')
            .setDescription('Grant self‑role admin permissions (Owner only)')
            .addUserOption(opt => opt.setName('user').setDescription('User to grant').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('revoke')
            .setDescription('Revoke self‑role admin permissions (Owner only)')
            .addUserOption(opt => opt.setName('user').setDescription('User to revoke').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('list')
            .setDescription('List all self‑role admins in this server')
        )
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'panel') {
      const guildId = interaction.guildId;
      const panels = db.getSelfRolePanels(guildId);
      const choices = panels.map(p => ({ name: p.panel_name, value: p.panel_name }));
      const filtered = choices.filter(c => c.name.toLowerCase().includes(focusedOption.value.toLowerCase())).slice(0, 25);
      await interaction.respond(filtered);
    }
  },

  async execute(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const guild = interaction.guild;
    const userId = interaction.user.id;

    // ----- PERMISSIONS -----
    const isOwner = userId === process.env.OWNER_ID;

    if (subcommandGroup === 'access') {
      if (!isOwner) {
        return interaction.reply({
          content: '<a:Red_cross_mark:1479397724603416606> Only the bot owner can manage self‑role administrators.',
          flags: MessageFlags.Ephemeral
        });
      }
    } else {
      const isServerAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const isSelfRoleAdmin = db.isSelfRoleAdmin(guildId, userId);
      if (!isOwner && !isServerAdmin && !isSelfRoleAdmin) {
        return interaction.reply({
          content: '<a:Red_cross_mark:1479397724603416606> You need **Administrator**, **Self‑Role Admin**, or be the bot owner to manage self‑roles.',
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // ----- CREATE -----
    if (subcommand === 'create') {
      const panelName = interaction.options.getString('panel');
      const title = interaction.options.getString('title');
      const mode = interaction.options.getString('mode');
      const footer = interaction.options.getString('footer');
      const maxRoles = interaction.options.getInteger('max_roles') || 0;

      if (panelName.includes(' ') || panelName.includes('_')) {
        return interaction.reply({
          content: '<a:Red_cross_mark:1479397724603416606> Panel name cannot contain spaces or underscores. Use letters, numbers, and hyphens.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (db.selfRolePanelExists(guildId, panelName)) {
        return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> A panel with that name already exists.', flags: MessageFlags.Ephemeral });
      }

      db.createSelfRolePanel(guildId, panelName, title, null, footer, mode, maxRoles, userId);
      logger.info(`SelfRole panel "${panelName}" created in guild ${guild.name} (${guildId}) by ${interaction.user.tag}`);
      await interaction.reply({ content: `<a:Green_tick_mark:1479393702031134730> Self‑role panel **${panelName}** created.`, flags: MessageFlags.Ephemeral });
    }

    // ----- ADDROLE -----
    else if (subcommand === 'addrole') {
      const panelName = interaction.options.getString('panel');
      const role = interaction.options.getRole('role');
      const emoji = interaction.options.getString('emoji');
      const style = interaction.options.getString('style') || 'secondary';
      let position = interaction.options.getInteger('position');

      if (!db.selfRolePanelExists(guildId, panelName)) {
        return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Panel not found.', flags: MessageFlags.Ephemeral });
      }

      const buttons = db.getSelfRoleButtons(guildId, panelName);
      if (buttons.length >= 25) {
        return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> A panel cannot have more than 25 buttons.', flags: MessageFlags.Ephemeral });
      }

      if (position === null) {
        position = buttons.length + 1;
      }

      // Store emoji exactly as provided:
      // - If it's a custom emoji mention, keep the full string (e.g. <:name:123>)
      // - If it's unicode, keep the character
      // No parsing needed – setEmoji and embed will use it directly.
      const emojiValue = emoji;

      db.addSelfRoleButton(guildId, panelName, role.id, emojiValue, style, position);
      logger.info(`SelfRole button added to panel "${panelName}" in guild ${guild.name} (${guildId}): role ${role.name}, style ${style}, pos ${position}`);
      await interaction.reply({ content: `<a:Green_tick_mark:1479393702031134730> Added **${role.name}** to panel **${panelName}** (${style}) at position ${position}.`, flags: MessageFlags.Ephemeral });
    }

    // ----- SEND -----
    else if (subcommand === 'send') {
      const panelName = interaction.options.getString('panel');
      const channel = interaction.options.getChannel('channel');

      const panel = db.getSelfRolePanel(guildId, panelName);
      if (!panel) {
        return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Panel not found.', flags: MessageFlags.Ephemeral });
      }

      const buttons = db.getSelfRoleButtons(guildId, panelName);
      if (buttons.length === 0) {
        return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> This panel has no role buttons. Use `/selfrole addrole` first.', flags: MessageFlags.Ephemeral });
      }

      const panelData = await SelfRoleManager.buildPanel(guild, panel, buttons);
      const sentMessage = await channel.send(panelData);
      db.setSelfRoleMessage(guildId, panelName, channel.id, sentMessage.id);

      logger.info(`SelfRole panel "${panelName}" sent to #${channel.name} in guild ${guild.name} (${guildId})`);
      await interaction.reply({ content: `<a:Green_tick_mark:1479393702031134730> Self‑role panel **${panelName}** sent to ${channel}.`, flags: MessageFlags.Ephemeral });
    }

    // ----- REMOVE -----
    else if (subcommand === 'remove') {
      const panelName = interaction.options.getString('panel');
      const panel = db.getSelfRolePanel(guildId, panelName);
      if (!panel) {
        return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Panel not found.', flags: MessageFlags.Ephemeral });
      }

      if (panel.last_sent_channel_id && panel.last_sent_message_id) {
        try {
          const channel = await guild.channels.fetch(panel.last_sent_channel_id);
          if (channel) {
            const message = await channel.messages.fetch(panel.last_sent_message_id);
            await message.delete();
            logger.info(`SelfRole panel message for "${panelName}" deleted in guild ${guild.name} (${guildId})`);
          }
        } catch (error) {}
      }

      db.setSelfRoleMessage(guildId, panelName, null, null);
      await interaction.reply({ content: `<a:Green_tick_mark:1479393702031134730> Self‑role panel message for **${panelName}** removed.`, flags: MessageFlags.Ephemeral });
    }

    // ----- DELETE -----
    else if (subcommand === 'delete') {
      const panelName = interaction.options.getString('panel');
      if (!db.selfRolePanelExists(guildId, panelName)) {
        return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Panel not found.', flags: MessageFlags.Ephemeral });
      }

      const panel = db.getSelfRolePanel(guildId, panelName);
      if (panel.last_sent_channel_id && panel.last_sent_message_id) {
        try {
          const channel = await guild.channels.fetch(panel.last_sent_channel_id);
          if (channel) {
            const message = await channel.messages.fetch(panel.last_sent_message_id);
            await message.delete();
          }
        } catch (error) {}
      }

      db.deleteSelfRolePanel(guildId, panelName);
      logger.info(`SelfRole panel "${panelName}" deleted in guild ${guild.name} (${guildId}) by ${interaction.user.tag}`);
      await interaction.reply({ content: `<a:Green_tick_mark:1479393702031134730> Self‑role panel **${panelName}** deleted.`, flags: MessageFlags.Ephemeral });
    }

    // ----- LIST -----
    else if (subcommand === 'list') {
      const panels = db.getSelfRolePanels(guildId);
      if (panels.length === 0) {
        return interaction.reply({ content: '<a:mail_box:1479425779530989670> No self‑role panels in this server.', flags: MessageFlags.Ephemeral });
      }

      const list = panels.map(p => {
        const buttonCount = db.getSelfRoleButtons(guildId, p.panel_name).length;
        const maxRoles = p.max_roles ? ` (max ${p.max_roles})` : '';
        return `**${p.panel_name}** (${p.mode}${maxRoles}) — ${buttonCount} buttons`;
      }).join('\n');

      await interaction.reply({ content: `<a:Folder:1479426127037468702> **Self‑Role Panels**\n${list}`, flags: MessageFlags.Ephemeral });
    }

    // ----- ACCESS -----
    else if (subcommandGroup === 'access') {
      if (subcommand === 'grant') {
        const targetUser = interaction.options.getUser('user');
        db.addSelfRoleAdmin(guildId, targetUser.id, userId);
        logger.success(`SelfRole admin granted to ${targetUser.tag} in guild ${guild.name} (${guildId}) by ${interaction.user.tag}`);
        await interaction.reply({ content: `<a:Green_tick_mark:1479393702031134730> Granted **Self‑Role Admin** to ${targetUser.tag}.`, flags: MessageFlags.Ephemeral });
      }
      else if (subcommand === 'revoke') {
        const targetUser = interaction.options.getUser('user');
        if (!db.isSelfRoleAdmin(guildId, targetUser.id)) {
          return interaction.reply({ content: `<a:Info_text:1479392709188915313> ${targetUser.tag} is not a Self‑Role Admin.`, flags: MessageFlags.Ephemeral });
        }
        db.removeSelfRoleAdmin(guildId, targetUser.id);
        logger.success(`SelfRole admin revoked from ${targetUser.tag} in guild ${guild.name} (${guildId}) by ${interaction.user.tag}`);
        await interaction.reply({ content: `<a:Green_tick_mark:1479393702031134730> Revoked **Self‑Role Admin** from ${targetUser.tag}.`, flags: MessageFlags.Ephemeral });
      }
      else if (subcommand === 'list') {
        const adminIds = db.getSelfRoleAdmins(guildId);
        if (adminIds.length === 0) {
          return interaction.reply({ content: '<a:mail_box:1479425779530989670> No Self‑Role Admins in this server.', flags: MessageFlags.Ephemeral });
        }
        const adminMentions = adminIds.map(id => `<@${id}>`).join('\n');
        await interaction.reply({ content: `**Self‑Role Admins**\n${adminMentions}`, flags: MessageFlags.Ephemeral });
      }
    }
  }
};
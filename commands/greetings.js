// commands/greetings.js
const { 
  SlashCommandBuilder, 
  ChannelType, 
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../database');
const GreetingsManager = require('../systems/greetings/greetingsManager');
const { logger } = require('../utils/logger');

// Temporary cache for select menu messages to delete after modal submit
const messageCache = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greetings')
    .setDescription('Advanced greeting system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    
    // ===== NEW SETUP =====
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Quick setup: set channel and configure message in one go')
      .addStringOption(opt => opt
        .setName('type')
        .setDescription('Type of greeting')
        .setRequired(true)
        .addChoices(
          { name: 'Welcome', value: 'welcome' },
          { name: 'Farewell', value: 'farewell' },
          { name: 'Ban', value: 'ban' },
          { name: 'Kick', value: 'kick' }
        ))
      .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('Channel to send messages to')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)))
    
    // ===== CHANNEL GROUP =====
    .addSubcommandGroup(group => group
      .setName('channel')
      .setDescription('Configure greeting channels')
      .addSubcommand(sub => sub
        .setName('set')
        .setDescription('Set a channel for greetings')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Type of greeting')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome', value: 'welcome' },
            { name: 'Farewell', value: 'farewell' }
          ))
        .addChannelOption(opt => opt
          .setName('channel')
          .setDescription('The channel to send messages to')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(sub => sub
        .setName('remove')
        .setDescription('Remove a greeting channel')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Type of greeting')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome', value: 'welcome' },
            { name: 'Farewell', value: 'farewell' }
          ))))
    
    // ===== TOGGLE GROUP =====
    .addSubcommandGroup(group => group
      .setName('toggle')
      .setDescription('Enable or disable greeting types')
      .addSubcommand(sub => sub
        .setName('channel')
        .setDescription('Toggle channel greetings')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Type of greeting')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome', value: 'welcome' },
            { name: 'Farewell', value: 'farewell' },
            { name: 'Ban', value: 'ban' },
            { name: 'Kick', value: 'kick' }
          ))
        .addBooleanOption(opt => opt
          .setName('enabled')
          .setDescription('Enable or disable')
          .setRequired(true)))
      .addSubcommand(sub => sub
        .setName('dm')
        .setDescription('Toggle DM greetings')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Type of DM greeting')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome DM', value: 'welcome_dm' },
            { name: 'Farewell DM', value: 'farewell_dm' }
          ))
        .addBooleanOption(opt => opt
          .setName('enabled')
          .setDescription('Enable or disable')
          .setRequired(true))))
    
    // ===== SET MESSAGE GROUP =====
    .addSubcommandGroup(group => group
      .setName('set')
      .setDescription('Configure greeting messages')
      .addSubcommand(sub => sub
        .setName('channel')
        .setDescription('Set a channel greeting message')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Type of greeting')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome', value: 'welcome' },
            { name: 'Farewell', value: 'farewell' },
            { name: 'Ban', value: 'ban' },
            { name: 'Kick', value: 'kick' }
          )))
      .addSubcommand(sub => sub
        .setName('dm')
        .setDescription('Set a DM greeting message')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Type of DM greeting')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome DM', value: 'welcome_dm' },
            { name: 'Farewell DM', value: 'farewell_dm' }
          ))))
    
    // ===== VIEW GROUP =====
    .addSubcommandGroup(group => group
      .setName('view')
      .setDescription('View current greeting message configuration')
      .addSubcommand(sub => sub
        .setName('channel')
        .setDescription('View a channel greeting message')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Type of greeting')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome', value: 'welcome' },
            { name: 'Farewell', value: 'farewell' },
            { name: 'Ban', value: 'ban' },
            { name: 'Kick', value: 'kick' }
          )))
      .addSubcommand(sub => sub
        .setName('dm')
        .setDescription('View a DM greeting message')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Type of DM greeting')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome DM', value: 'welcome_dm' },
            { name: 'Farewell DM', value: 'farewell_dm' }
          ))))
    
    // ===== TEST GROUP =====
    .addSubcommandGroup(group => group
      .setName('test')
      .setDescription('Test your greeting messages')
      .addSubcommand(sub => sub
        .setName('channel')
        .setDescription('Test a channel greeting')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Type of greeting')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome', value: 'welcome' },
            { name: 'Farewell', value: 'farewell' },
            { name: 'Ban', value: 'ban' },
            { name: 'Kick', value: 'kick' }
          ))
        .addChannelOption(opt => opt
          .setName('channel')
          .setDescription('Channel to send test message to (optional)')
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(sub => sub
        .setName('dm')
        .setDescription('Test a DM greeting')
        .addStringOption(opt => opt
          .setName('type')
          .setDescription('Type of DM greeting')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome DM', value: 'welcome' },
            { name: 'Farewell DM', value: 'farewell' }
          ))))
    
    // ===== OTHER =====
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('View current greeting settings'))
    .addSubcommand(sub => sub
      .setName('variables')
      .setDescription('Show all available variables with descriptions'))
    .addSubcommand(sub => sub
      .setName('invitetracking')
      .setDescription('Enable or disable invite tracking')
      .addBooleanOption(opt => opt
        .setName('enabled')
        .setDescription('Enable invite tracking?')
        .setRequired(true))),

  async execute(interaction, client) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommandGroup === 'channel') {
      if (subcommand === 'set') await this.handleChannelSet(interaction);
      else if (subcommand === 'remove') await this.handleChannelRemove(interaction);
    }
    else if (subcommandGroup === 'toggle') {
      if (subcommand === 'channel') await this.handleToggleChannel(interaction);
      else if (subcommand === 'dm') await this.handleToggleDM(interaction);
    }
    else if (subcommandGroup === 'set') {
      if (subcommand === 'channel') await this.handleSetChannelMessage(interaction);
      else if (subcommand === 'dm') await this.handleSetDMMessage(interaction);
    }
    else if (subcommandGroup === 'view') {
      if (subcommand === 'channel') await this.handleViewChannel(interaction);
      else if (subcommand === 'dm') await this.handleViewDM(interaction);
    }
    else if (subcommandGroup === 'test') {
      if (subcommand === 'channel') await this.handleTestChannel(interaction, client);
      else if (subcommand === 'dm') await this.handleTestDM(interaction, client);
    }
    else {
      switch (subcommand) {
        case 'setup': await this.handleSetup(interaction, client); break;
        case 'status': await this.handleStatus(interaction); break;
        case 'variables': await this.handleVariables(interaction); break;
        case 'invitetracking': await this.handleInviteTracking(interaction, client); break;
      }
    }
  },

  // ===== CHANNEL HANDLERS =====
  async handleChannelSet(interaction) {
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');
    
    db.setGreetingsChannel(interaction.guildId, type, channel.id, interaction.user.id);
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('<a:Green_tick_mark:1479393702031134730> Channel Set')
      .setDescription(`**${type.charAt(0).toUpperCase() + type.slice(1)}** messages will be sent to ${channel}`)
      .setFooter({ text: `Set by ${interaction.user.tag}` })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  },

  async handleChannelRemove(interaction) {
    const type = interaction.options.getString('type');
    
    db.setGreetingsChannel(interaction.guildId, type, null, interaction.user.id);
    
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('🗑️ Channel Removed')
      .setDescription(`**${type.charAt(0).toUpperCase() + type.slice(1)}** channel has been removed.`)
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  },

  // ===== TOGGLE HANDLERS =====
  async handleToggleChannel(interaction) {
    const type = interaction.options.getString('type');
    const enabled = interaction.options.getBoolean('enabled');
    
    db.enableGreeting(interaction.guildId, type, enabled, interaction.user.id);
    
    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x00FF00 : 0xFF0000)
      .setTitle(enabled ? '<a:Green_tick_mark:1479393702031134730> Enabled' : '<a:Red_cross_mark:1479397724603416606> Disabled')
      .setDescription(`**${type.charAt(0).toUpperCase() + type.slice(1)}** channel messages are now **${enabled ? 'enabled' : 'disabled'}**`)
      .setFooter({ text: `Set by ${interaction.user.tag}` })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  },

  async handleToggleDM(interaction) {
    const type = interaction.options.getString('type');
    const enabled = interaction.options.getBoolean('enabled');
    
    db.setDMGreetingEnabled(interaction.guildId, type, enabled, interaction.user.id);
    
    const displayType = type === 'welcome_dm' ? 'Welcome DM' : 'Farewell DM';
    
    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x00FF00 : 0xFF0000)
      .setTitle(enabled ? '<a:Green_tick_mark:1479393702031134730> DM Enabled' : '<a:Red_cross_mark:1479397724603416606> DM Disabled')
      .setDescription(`**${displayType}** messages are now **${enabled ? 'enabled' : 'disabled'}**`)
      .setFooter({ text: `Set by ${interaction.user.tag}` })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  },

  // ===== SET MESSAGE HANDLERS =====
  async handleSetChannelMessage(interaction) {
    const type = interaction.options.getString('type');
    
    const existing = db.getGreetingMessageWithFormat(interaction.guildId, type);
    
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`greeting_type_${type}`)
          .setPlaceholder('Select message format')
          .addOptions([
            { label: 'Text Only', value: 'text', description: 'Simple text message', emoji: '📝' },
            { label: 'Embed Only', value: 'embed', description: 'Rich embed message', emoji: '🎨' },
            { label: 'Text + Embed', value: 'both', description: 'Both text and embed', emoji: '📋' }
          ])
      );
    
    const content = existing 
      ? `Editing existing **${type}** message. Choose format (current: ${existing.use_embed ? (existing.content ? 'text+embed' : 'embed') : 'text'})` 
      : `Choose the format for your **${type}** channel message:`;
    
    await interaction.reply({
      content,
      components: [row],
      flags: MessageFlags.Ephemeral
    });
  },

  async handleSetDMMessage(interaction) {
    const type = interaction.options.getString('type');
    const messageType = type;
    
    const existing = db.getDMGreetingMessageWithFormat(interaction.guildId, messageType);
    
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`dm_greeting_type_${messageType}`)
          .setPlaceholder('Select message format')
          .addOptions([
            { label: 'Text Only', value: 'text', description: 'Simple text message', emoji: '📝' },
            { label: 'Embed Only', value: 'embed', description: 'Rich embed message', emoji: '🎨' },
            { label: 'Text + Embed', value: 'both', description: 'Both text and embed', emoji: '📋' }
          ])
      );
    
    const displayType = messageType === 'welcome_dm' ? 'Welcome DM' : 'Farewell DM';
    const content = existing 
      ? `Editing existing **${displayType}** message. Choose format (current: ${existing.use_embed ? (existing.content ? 'text+embed' : 'embed') : 'text'})` 
      : `Choose the format for your **${displayType}** message:`;
    
    await interaction.reply({
      content,
      components: [row],
      flags: MessageFlags.Ephemeral
    });
  },

  // ===== VIEW HANDLERS =====
  async handleViewChannel(interaction) {
    const type = interaction.options.getString('type');
    const messageData = db.getGreetingMessageWithFormat(interaction.guildId, type);
    
    if (!messageData) {
      return interaction.reply({ 
        content: `<a:Red_cross_mark:1479397724603416606> No **${type}** message configured. Use \`/greetings set channel ${type}\` to create one.`,
        flags: MessageFlags.Ephemeral 
      });
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📄 ${type.charAt(0).toUpperCase() + type.slice(1)} Message Configuration`)
      .addFields(
        { name: 'Format', value: messageData.use_embed ? (messageData.content ? 'Text + Embed' : 'Embed Only') : 'Text Only', inline: true },
        { name: 'Last Updated', value: messageData.updated_at ? `<t:${Math.floor(new Date(messageData.updated_at).getTime() / 1000)}:R>` : 'Unknown', inline: true }
      )
      .setTimestamp();
    
    if (messageData.content) embed.addFields({ name: '📝 Content', value: messageData.content.length > 1000 ? messageData.content.substring(0, 1000) + '...' : messageData.content, inline: false });
    if (messageData.embed_title) embed.addFields({ name: '🎨 Embed Title', value: messageData.embed_title, inline: false });
    if (messageData.embed_description) embed.addFields({ name: '📄 Embed Description', value: messageData.embed_description.length > 1000 ? messageData.embed_description.substring(0, 1000) + '...' : messageData.embed_description, inline: false });
    if (messageData.embed_color) embed.addFields({ name: '🎨 Embed Color', value: messageData.embed_color, inline: true });
    if (messageData.embed_footer) embed.addFields({ name: '🔻 Embed Footer', value: messageData.embed_footer, inline: true });
    if (messageData.embed_thumbnail) embed.addFields({ name: '🖼️ Thumbnail URL', value: messageData.embed_thumbnail, inline: false });
    if (messageData.embed_image) embed.addFields({ name: '📷 Image URL', value: messageData.embed_image, inline: false });
    if (messageData.embed_author) embed.addFields({ name: '✍️ Author', value: messageData.embed_author, inline: true });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  async handleViewDM(interaction) {
    const type = interaction.options.getString('type');
    const messageData = db.getDMGreetingMessageWithFormat(interaction.guildId, type);
    
    if (!messageData) {
      return interaction.reply({ 
        content: `<a:Red_cross_mark:1479397724603416606> No **${type === 'welcome_dm' ? 'Welcome DM' : 'Farewell DM'}** message configured. Use \`/greetings set dm ${type}\` to create one.`,
        flags: MessageFlags.Ephemeral 
      });
    }
    
    const displayType = type === 'welcome_dm' ? 'Welcome DM' : 'Farewell DM';
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📄 ${displayType} Message Configuration`)
      .addFields(
        { name: 'Format', value: messageData.use_embed ? (messageData.content ? 'Text + Embed' : 'Embed Only') : 'Text Only', inline: true },
        { name: 'Last Updated', value: messageData.updated_at ? `<t:${Math.floor(new Date(messageData.updated_at).getTime() / 1000)}:R>` : 'Unknown', inline: true }
      )
      .setTimestamp();
    
    if (messageData.content) embed.addFields({ name: '📝 Content', value: messageData.content.length > 1000 ? messageData.content.substring(0, 1000) + '...' : messageData.content, inline: false });
    if (messageData.embed_title) embed.addFields({ name: '🎨 Embed Title', value: messageData.embed_title, inline: false });
    if (messageData.embed_description) embed.addFields({ name: '📄 Embed Description', value: messageData.embed_description.length > 1000 ? messageData.embed_description.substring(0, 1000) + '...' : messageData.embed_description, inline: false });
    if (messageData.embed_color) embed.addFields({ name: '🎨 Embed Color', value: messageData.embed_color, inline: true });
    if (messageData.embed_footer) embed.addFields({ name: '🔻 Embed Footer', value: messageData.embed_footer, inline: true });
    if (messageData.embed_thumbnail) embed.addFields({ name: '🖼️ Thumbnail URL', value: messageData.embed_thumbnail, inline: false });
    if (messageData.embed_image) embed.addFields({ name: '📷 Image URL', value: messageData.embed_image, inline: false });
    if (messageData.embed_author) embed.addFields({ name: '✍️ Author', value: messageData.embed_author, inline: true });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  // ===== TEST HANDLERS =====
  async handleTestChannel(interaction, client) {
    const type = interaction.options.getString('type');
    const specifiedChannel = interaction.options.getChannel('channel');
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    let targetChannel = specifiedChannel;
    
    if (!targetChannel) {
      const settings = db.getGreetingsSettings(interaction.guildId);
      let channelId;
      
      if (type === 'welcome') {
        channelId = settings.welcome_channel_id;
      } else if (type === 'farewell') {
        channelId = settings.farewell_channel_id || settings.welcome_channel_id;
      } else {
        channelId = settings.welcome_channel_id;
      }
      
      if (!channelId) {
        return interaction.editReply({ 
          content: `<a:Red_cross_mark:1479397724603416606> No channel configured for ${type} messages. Please specify a channel or set one with \`/greetings channel set\`.` 
        });
      }
      
      targetChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!targetChannel) {
        return interaction.editReply({ 
          content: `<a:Red_cross_mark:1479397724603416606> Configured channel not found. Please set a new channel with \`/greetings channel set\`.` 
        });
      }
    }
    
    const result = await GreetingsManager.testGreeting({
      interaction,
      type,
      targetChannel,
      isDM: false
    }, client);
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('<a:Green_tick_mark:1479393702031134730> Test Successful')
        .setDescription(result.message)
        .addFields(
          { name: 'Location', value: result.location, inline: true },
          { name: 'Type', value: type, inline: true }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ content: result.message });
    }
  },

  async handleTestDM(interaction, client) {
    const type = interaction.options.getString('type');
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const result = await GreetingsManager.testGreeting({
      interaction,
      type,
      isDM: true
    }, client);
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('<a:Green_tick_mark:1479393702031134730> DM Test Successful')
        .setDescription(result.message)
        .addFields(
          { name: 'Location', value: result.location, inline: true },
          { name: 'Type', value: type === 'welcome' ? 'Welcome DM' : 'Farewell DM', inline: true }
        )
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ content: result.message });
    }
  },

  // ===== SETUP HANDLER =====
  async handleSetup(interaction, client) {
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');
    
    if (type === 'welcome' || type === 'farewell') {
      db.setGreetingsChannel(interaction.guildId, type, channel.id, interaction.user.id);
    } else {
      db.setGreetingsChannel(interaction.guildId, 'welcome', channel.id, interaction.user.id);
    }
    
    db.enableGreeting(interaction.guildId, type, true, interaction.user.id);
    
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`greeting_type_${type}`)
          .setPlaceholder('Select message format')
          .addOptions([
            { label: 'Text Only', value: 'text', description: 'Simple text message', emoji: '📝' },
            { label: 'Embed Only', value: 'embed', description: 'Rich embed message', emoji: '🎨' },
            { label: 'Text + Embed', value: 'both', description: 'Both text and embed', emoji: '📋' }
          ])
      );
    
    await interaction.reply({
      content: `<a:Green_tick_mark:1479393702031134730> Channel set to ${channel} and **${type}** enabled. Now choose the format for your message:`,
      components: [row],
      ephemeral: true
    });
  },


// ===== STATUS HANDLER (PAGINATED) =====
async handleStatus(interaction) {
  const settings = db.getGreetingsSettings(interaction.guildId);
  
  // Helper functions
  const getFormat = (msg) => {
    if (!msg) return 'Not configured';
    if (msg.use_embed) return msg.content ? 'Text+Embed' : 'Embed Only';
    return 'Text Only';
  };
  const getPreview = (msg, field) => {
    if (!msg || !msg[field]) return 'None';
    let text = msg[field];
    if (text.length > 50) text = text.substring(0, 47) + '...';
    return text;
  };
  
  // Fetch all message data
  const welcomeMsg = db.getGreetingMessageWithFormat(interaction.guildId, 'welcome');
  const farewellMsg = db.getGreetingMessageWithFormat(interaction.guildId, 'farewell');
  const banMsg = db.getGreetingMessageWithFormat(interaction.guildId, 'ban');
  const kickMsg = db.getGreetingMessageWithFormat(interaction.guildId, 'kick');
  const welcomeDMMsg = db.getDMGreetingMessageWithFormat(interaction.guildId, 'welcome_dm');
  const farewellDMMsg = db.getDMGreetingMessageWithFormat(interaction.guildId, 'farewell_dm');
  
  // DM enabled status
  const welcomeDMEnabled = db.isDMGreetingEnabled(interaction.guildId, 'welcome_dm');
  const farewellDMEnabled = db.isDMGreetingEnabled(interaction.guildId, 'farewell_dm');
  
  // Define pages
  const pages = [
    {
      title: '📋 Greetings Status (Page 1/3) – Channels',
      fields: [
        { name: '<a:speaker:1479427644973121546> Welcome Channel', value: settings.welcome_channel_id ? `<#${settings.welcome_channel_id}>` : 'Not set', inline: true },
        { name: '<a:byy:1479428090903134288> Farewell Channel', value: settings.farewell_channel_id ? `<#${settings.farewell_channel_id}>` : 'Not set (uses welcome)', inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '<a:Green_tick_mark:1479393702031134730> Welcome', value: settings.welcome_enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: '<a:Green_tick_mark:1479393702031134730> Farewell', value: settings.farewell_enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: '<a:Green_tick_mark:1479393702031134730> Ban', value: settings.ban_enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: '<a:Green_tick_mark:1479393702031134730> Kick', value: settings.kick_enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: '<a:mail:1479425776502702261> Welcome DM', value: welcomeDMEnabled ? 'Enabled' : 'Disabled', inline: true },
        { name: '<a:mail:1479425776502702261> Farewell DM', value: farewellDMEnabled ? 'Enabled' : 'Disabled', inline: true },
        { name: '<a:Bar_chart:1479397726679470111> Invite Tracking', value: db.isInviteTrackingEnabled(interaction.guildId) ? 'Enabled' : 'Disabled', inline: true },
      ]
    },
    {
      title: '📋 Greetings Status (Page 2/3) – Channel Messages',
      fields: [
        { name: '━━━━━━━━━━', value: '**Welcome Message**', inline: false },
        { name: 'Format', value: getFormat(welcomeMsg), inline: true },
        { name: 'Content', value: getPreview(welcomeMsg, 'content'), inline: true },
        { name: 'Title', value: getPreview(welcomeMsg, 'embed_title'), inline: true },
        { name: '━━━━━━━━━━', value: '**Farewell Message**', inline: false },
        { name: 'Format', value: getFormat(farewellMsg), inline: true },
        { name: 'Content', value: getPreview(farewellMsg, 'content'), inline: true },
        { name: 'Title', value: getPreview(farewellMsg, 'embed_title'), inline: true },
        { name: '━━━━━━━━━━', value: '**Ban Message**', inline: false },
        { name: 'Format', value: getFormat(banMsg), inline: true },
        { name: 'Content', value: getPreview(banMsg, 'content'), inline: true },
        { name: 'Title', value: getPreview(banMsg, 'embed_title'), inline: true },
        { name: '━━━━━━━━━━', value: '**Kick Message**', inline: false },
        { name: 'Format', value: getFormat(kickMsg), inline: true },
        { name: 'Content', value: getPreview(kickMsg, 'content'), inline: true },
        { name: 'Title', value: getPreview(kickMsg, 'embed_title'), inline: true },
      ]
    },
    {
      title: '<a:Folder:1479426127037468702> Greetings Status (Page 3/3) – DM Messages',
      fields: [
        { name: '━━━━━━━━━━', value: '**Welcome DM**', inline: false },
        { name: 'Format', value: getFormat(welcomeDMMsg), inline: true },
        { name: 'Content', value: getPreview(welcomeDMMsg, 'content'), inline: true },
        { name: 'Title', value: getPreview(welcomeDMMsg, 'embed_title'), inline: true },
        { name: '━━━━━━━━━━', value: '**Farewell DM**', inline: false },
        { name: 'Format', value: getFormat(farewellDMMsg), inline: true },
        { name: 'Content', value: getPreview(farewellDMMsg, 'content'), inline: true },
        { name: 'Title', value: getPreview(farewellDMMsg, 'embed_title'), inline: true },
      ]
    }
  ];

  let currentPage = 0;

  const generateEmbed = (pageIndex) => {
    const page = pages[pageIndex];
    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(page.title)
      .addFields(...page.fields)
      .setFooter({ text: `Use buttons to navigate • /greetings view for full content` })
      .setTimestamp();
  };

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('status_prev')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId('status_next')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === pages.length - 1)
    );

  const reply = await interaction.reply({
    embeds: [generateEmbed(currentPage)],
    components: [row],
    fetchReply: true,
    flags: MessageFlags.Ephemeral
  });

  const collector = reply.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 60000
  });

  collector.on('collect', async i => {
    if (i.customId === 'status_prev') currentPage--;
    else if (i.customId === 'status_next') currentPage++;

    await i.update({
      embeds: [generateEmbed(currentPage)],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('status_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId('status_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === pages.length - 1)
        )
      ]
    });
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
},

  // ===== VARIABLES HANDLER =====
  async handleVariables(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('<a:Folder:1479426127037468702> Greeting Message Variables')
      .setDescription('Use these variables in your greeting messages. They will be automatically replaced when the message is sent.')
      .addFields(
        { 
          name: '<a:Memebrs:1479421309372072038> User Variables', 
          value: '```\n{mention} - Mentions the user (@username)\n{user} - User\'s username\n{user(id)} - User\'s Discord ID\n{user(proper)} - User\'s tag (Username#1234)\n{user(avatar)} - User\'s avatar URL\n{user(created)} - When user created their account\n{user(joined)} - When user joined the server\n```', 
          inline: false 
        },
        { 
          name: '<a:house:1479427224451940412> Server Variables', 
          value: '```\n{server} - Server name\n{server(id)} - Server ID\n{server(members)} - Total member count\n{ord:{server(members)}} - Member count with ordinal (1st, 2nd, 3rd)\n{time} - Current time\n{date} - Current date\n{event} - Event type (welcome/farewell/ban/kick)\n```', 
          inline: false 
        },
        { 
          name: '<a:Bar_chart:1479397726679470111> Invite Tracking Variables', 
          value: '```\n{inviter} - Username of who invited the user\n{inviter(mention)} - Mention of who invited the user\n{invites} - Total invites by the inviter\n{invites(regular)} - Regular invites (still in server)\n{invites(leave)} - Invites who left\n{invites(fake)} - Fake invites (bots)\n```', 
          inline: false 
        },
        { 
          name: '<a:dice:1479426949574033428> Advanced Variables', 
          value: '```\n{random:option1~option2~option3} - Randomly selects one option\n{math:2+2} - Performs mathematical calculations\n```\n**Examples:**\n`Welcome {mention}! You are member #{ord:{server(members)}}`\n`{random:Hey~Hello~Greetings} {user}, enjoy your stay!`\n`You were invited by {inviter(mention)} who has {invites} invites!`', 
          inline: false 
        }
      )
      .setFooter({ text: 'Variables are case-sensitive • Enable invite tracking with /greetings invitetracking' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },

  // ===== INVITE TRACKING HANDLER =====
  async handleInviteTracking(interaction, client) {
    const enabled = interaction.options.getBoolean('enabled');
    db.setInviteTrackingEnabled(interaction.guildId, enabled);
    
    if (enabled && client.inviteTracker) {
      await client.inviteTracker.cacheGuildInvites(interaction.guild);
    }
    
    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x00FF00 : 0xFF0000)
      .setTitle(enabled ? '<a:Green_tick_mark:1479393702031134730> Invite Tracking Enabled' : '<a:Red_cross_mark:1479397724603416606> Invite Tracking Disabled')
      .setDescription(`Invite tracking is now **${enabled ? 'enabled' : 'disabled'}**.`)
      .addFields(
        { name: '📊 What this does', value: enabled 
          ? 'The bot will now track who invited whom and provide invite variables for your messages.' 
          : 'Invite variables will not work and will show as "Unknown".', 
          inline: false }
      )
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};

// ===== MODAL HANDLER WITH CACHE CLEANUP =====
module.exports.modalHandler = async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  
  const modalId = interaction.customId;
  
  const cached = messageCache.get(modalId);
  if (cached) {
    try {
      const channel = await interaction.client.channels.fetch(cached.channelId);
      const msg = await channel.messages.fetch(cached.messageId);
      await msg.delete();
      messageCache.delete(modalId);
    } catch (e) {
      // Ignore if message already deleted
    }
  }
  
  if (modalId.startsWith('greeting_modal_')) {
    await handleGreetingModal(interaction, false);
  } else if (modalId.startsWith('dm_greeting_modal_')) {
    await handleGreetingModal(interaction, true);
  }
};

async function handleGreetingModal(interaction, isDM) {
  const modalId = interaction.customId;
  const parts = modalId.split('_');
  
  let type, format;
  if (isDM) {
    const baseType = parts[3];
    const dmSuffix = parts[4];
    type = `${baseType}_${dmSuffix}`;
    format = parts[5];
  } else {
    type = parts[2];
    format = parts[3];
  }
  
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  const messageData = {
    use_embed: format !== 'text' ? 1 : 0
  };
  
  if (format === 'text' || format === 'both') {
    try {
      messageData.content = interaction.fields.getTextInputValue('content') || null;
    } catch (e) {
      messageData.content = null;
    }
  }
  
  if (format === 'embed' || format === 'both') {
    try { messageData.embed_title = interaction.fields.getTextInputValue('embed_title') || null; } catch (e) {}
    try { messageData.embed_description = interaction.fields.getTextInputValue('embed_description') || null; } catch (e) {}
    try { messageData.embed_color = interaction.fields.getTextInputValue('embed_color') || null; } catch (e) {}
    try { messageData.embed_footer = interaction.fields.getTextInputValue('embed_footer') || null; } catch (e) {}
    try { messageData.embed_thumbnail = interaction.fields.getTextInputValue('embed_thumbnail') || null; } catch (e) {}
    try { messageData.embed_image = interaction.fields.getTextInputValue('embed_image') || null; } catch (e) {}
    try { messageData.embed_author = interaction.fields.getTextInputValue('embed_author') || null; } catch (e) {}
  }
  
  if (isDM) {
    db.saveDMGreetingMessage(interaction.guildId, type, messageData, interaction.user.id);
  } else {
    db.saveGreetingMessage(interaction.guildId, type, messageData, interaction.user.id);
  }
  
  const displayType = type.replace('_dm', '').charAt(0).toUpperCase() + type.replace('_dm', '').slice(1) + (isDM ? ' DM' : '');
  
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('<a:Green_tick_mark:1479393702031134730> Message Saved')
    .setDescription(`**${displayType}** message has been configured successfully!`)
    .addFields(
      { name: 'Format', value: format === 'both' ? 'Text + Embed' : format, inline: true }
    )
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

// ===== SELECT MENU HANDLER WITH CACHE =====
module.exports.selectMenuHandler = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  
  const customId = interaction.customId;
  
  if (customId.startsWith('greeting_type_')) {
    await handleGreetingSelect(interaction, false);
  } else if (customId.startsWith('dm_greeting_type_')) {
    await handleGreetingSelect(interaction, true);
  }
};

async function handleGreetingSelect(interaction, isDM) {
  const customId = interaction.customId;
  const type = customId.replace(isDM ? 'dm_greeting_type_' : 'greeting_type_', '');
  const format = interaction.values[0];
  
  let existing = null;
  if (isDM) {
    existing = db.getDMGreetingMessageWithFormat(interaction.guildId, type);
  } else {
    existing = db.getGreetingMessageWithFormat(interaction.guildId, type);
  }
  
  const modal = new ModalBuilder()
    .setCustomId(`${isDM ? 'dm_greeting_modal_' : 'greeting_modal_'}${type}_${format}`)
    .setTitle(`Configure ${type.replace('_dm', '')} ${isDM ? 'DM' : ''} Message`);
  
  const components = [];
  
  if (format === 'text' || format === 'both') {
    components.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('content')
          .setLabel('Message Content')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Welcome {mention} to {server}!')
          .setRequired(true)
          .setMaxLength(2000)
          .setValue(existing?.content || '')
      )
    );
  }
  
  if (format === 'embed' || format === 'both') {
    components.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('embed_title')
          .setLabel('Embed Title')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Welcome to {server}!')
          .setRequired(false)
          .setMaxLength(256)
          .setValue(existing?.embed_title || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('embed_description')
          .setLabel('Embed Description')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('We hope you enjoy your stay!')
          .setRequired(false)
          .setMaxLength(4000)
          .setValue(existing?.embed_description || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('embed_color')
          .setLabel('Embed Color (Hex)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('#00FF00')
          .setRequired(false)
          .setMaxLength(7)
          .setValue(existing?.embed_color || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('embed_footer')
          .setLabel('Embed Footer')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Member #{server(members)}')
          .setRequired(false)
          .setMaxLength(2048)
          .setValue(existing?.embed_footer || '')
      )
    );
    
    if (components.length < 5) {
      components.push(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_thumbnail')
            .setLabel('Thumbnail URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://example.com/thumb.png')
            .setRequired(false)
            .setValue(existing?.embed_thumbnail || '')
        )
      );
    }
    if (components.length < 5) {
      components.push(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_image')
            .setLabel('Image URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://example.com/banner.png')
            .setRequired(false)
            .setValue(existing?.embed_image || '')
        )
      );
    }
    if (components.length < 5) {
      components.push(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_author')
            .setLabel('Author Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('{user(proper)} joined')
            .setRequired(false)
            .setMaxLength(256)
            .setValue(existing?.embed_author || '')
        )
      );
    }
  }
  
  modal.addComponents(...components.slice(0, 5));
  
  messageCache.set(modal.data.custom_id, {
    channelId: interaction.channelId,
    messageId: interaction.message.id
  });
  
  await interaction.showModal(modal);
}
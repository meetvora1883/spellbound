// systems/greetings/greetingsManager.js
const { EmbedBuilder } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');

class GreetingsManager {
  
  /**
   * Parse variables in message content (async version)
   */
  static async parseVariables(text, member, guild, eventType, client) {
    if (!text) return text;
    
    const user = member.user;
    const memberCount = guild.memberCount;
    
    const ordinal = (n) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    text = text.replace(/{ord:\{server\(members\)\}}/g, ordinal(memberCount));
    
    text = text.replace(/{math:\s*([^}]+)\s*}/g, (match, expression) => {
      try {
        const result = Function('"use strict"; return (' + expression + ')')();
        return result;
      } catch (e) {
        return '[Math Error]';
      }
    });
    
    text = text.replace(/{random:\s*([^}]+)\s*}/g, (match, options) => {
      let items;
      if (options.includes('~')) {
        items = options.split('~').map(s => s.trim());
      } else {
        items = options.split(',').map(s => s.trim());
      }
      return items[Math.floor(Math.random() * items.length)];
    });
    
    const replacements = {
      '{mention}': `<@${user.id}>`,
      '{user}': user.username,
      '{user(id)}': user.id,
      '{user(proper)}': user.tag,
      '{server}': guild.name,
      '{server(members)}': memberCount.toString(),
      '{server(id)}': guild.id,
      '{user(avatar)}': user.displayAvatarURL({ dynamic: true }),
      '{user(created)}': `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
      '{user(joined)}': member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown',
      '{event}': eventType,
      '{time}': `<t:${Math.floor(Date.now() / 1000)}:F>`,
      '{date}': new Date().toLocaleDateString()
    };
    
    if (db.isInviteTrackingEnabled(guild.id)) {
      const inviterId = db.getInviter(guild.id, user.id);
      if (inviterId) {
        const inviter = await guild.members.fetch(inviterId).catch(() => null);
        const counts = db.getInviteCounts(guild.id, inviterId);
        
        replacements['{inviter}'] = inviter ? inviter.user.username : 'Unknown';
        replacements['{inviter(mention)}'] = inviter ? `<@${inviterId}>` : 'Unknown';
        replacements['{invites}'] = counts.total_invites.toString();
        replacements['{invites(regular)}'] = counts.regular_invites.toString();
        replacements['{invites(leave)}'] = counts.left_invites.toString();
        replacements['{invites(fake)}'] = counts.fake_invites.toString();
      } else {
        replacements['{inviter}'] = 'Unknown';
        replacements['{inviter(mention)}'] = 'Unknown';
        replacements['{invites}'] = '0';
        replacements['{invites(regular)}'] = '0';
        replacements['{invites(leave)}'] = '0';
        replacements['{invites(fake)}'] = '0';
      }
    }
    
    for (const [key, value] of Object.entries(replacements)) {
      text = text.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }
    
    return text;
  }

  /**
   * Create embed from message data
   */
  static async createEmbed(messageData, member, guild, eventType, client) {
    if (!messageData || !messageData.use_embed) return null;
    
    const embed = new EmbedBuilder();
    
    if (messageData.embed_color) {
      embed.setColor(messageData.embed_color);
    } else {
      embed.setColor(eventType === 'welcome' ? 0x00FF00 : 
                    eventType === 'farewell' ? 0xFFA500 : 
                    eventType === 'ban' ? 0xFF0000 : 
                    eventType.includes('dm') ? 0x5865F2 : 0x0000FF);
    }
    
    if (messageData.embed_title) {
      embed.setTitle(await this.parseVariables(messageData.embed_title, member, guild, eventType, client));
    }
    
    if (messageData.embed_description) {
      embed.setDescription(await this.parseVariables(messageData.embed_description, member, guild, eventType, client));
    }
    
    if (messageData.embed_footer) {
      embed.setFooter({ 
        text: await this.parseVariables(messageData.embed_footer, member, guild, eventType, client),
        iconURL: messageData.embed_footer_icon || null
      });
    }
    
    if (messageData.embed_thumbnail) {
      embed.setThumbnail(await this.parseVariables(messageData.embed_thumbnail, member, guild, eventType, client));
    }
    
    if (messageData.embed_image) {
      embed.setImage(await this.parseVariables(messageData.embed_image, member, guild, eventType, client));
    }
    
    if (messageData.embed_author) {
      embed.setAuthor({ 
        name: await this.parseVariables(messageData.embed_author, member, guild, eventType, client),
        iconURL: messageData.embed_author_icon ? 
          await this.parseVariables(messageData.embed_author_icon, member, guild, eventType, client) : null
      });
    }
    
    embed.setTimestamp();
    
    return embed;
  }

  /**
   * Send channel greeting message
   */
  static async sendGreeting(member, eventType, client) {
    logger.debug(`[sendGreeting] Called for ${member.user?.tag} in guild ${member.guild?.id} event ${eventType}`);
    
    if (!member || !member.guild) {
      logger.warn(`[sendGreeting] No member or guild`);
      return;
    }
    
    const guild = member.guild;
    const settings = db.getGreetingsSettings(guild.id);
    logger.debug(`[sendGreeting] Guild settings: welcome_enabled=${settings.welcome_enabled}, farewell_enabled=${settings.farewell_enabled}, welcome_channel=${settings.welcome_channel_id}, farewell_channel=${settings.farewell_channel_id}`);
    
    if (!settings[`${eventType}_enabled`]) {
      logger.debug(`[sendGreeting] ${eventType} not enabled for guild ${guild.id}`);
      return;
    }
    
    let channelId;
    if (eventType === 'welcome') {
      channelId = settings.welcome_channel_id;
    } else if (eventType === 'farewell') {
      channelId = settings.farewell_channel_id || settings.welcome_channel_id;
    } else {
      channelId = settings.welcome_channel_id;
    }
    
    logger.debug(`[sendGreeting] Channel ID: ${channelId}`);
    if (!channelId) {
      logger.debug(`[sendGreeting] No channel configured for ${eventType}`);
      return;
    }
    
    const channel = await guild.channels.fetch(channelId).catch(err => {
      logger.error(`[sendGreeting] Failed to fetch channel ${channelId}: ${err.message}`);
      return null;
    });
    if (!channel) {
      logger.debug(`[sendGreeting] Channel ${channelId} not found`);
      return;
    }
    
    const messageData = db.getGreetingMessage(guild.id, eventType);
    logger.debug(`[sendGreeting] Message data: ${messageData ? 'found' : 'not found'}`);
    if (!messageData) {
      logger.debug(`[sendGreeting] No message data for ${eventType}`);
      return;
    }
    
    try {
      let content = messageData.content ? 
        await this.parseVariables(messageData.content, member, guild, eventType, client) : null;
      
      const embed = await this.createEmbed(messageData, member, guild, eventType, client);
      
      if (messageData.embed_image && !messageData.use_embed) {
        const imageEmbed = new EmbedBuilder()
          .setImage(await this.parseVariables(messageData.embed_image, member, guild, eventType, client))
          .setColor(0x2F3136);
        await channel.send({ embeds: [imageEmbed] });
        logger.debug(`[sendGreeting] Sent image embed`);
      }
      
      await channel.send({
        content: content,
        embeds: embed ? [embed] : []
      });
      logger.info(`[sendGreeting] Sent ${eventType} message to channel ${channel.id} for ${member.user.tag}`);
      
      db.addGreetingStat(guild.id, eventType, member.id, member.user.tag);
      
    } catch (error) {
      logger.error(`[sendGreeting] Error sending ${eventType} message:`, error);
    }
  }

  /**
   * Send DM greeting message
   */
  static async sendDMGreeting(member, messageType, client) {
    logger.debug(`[sendDMGreeting] Called for ${member.user?.tag} in guild ${member.guild?.id} type ${messageType}`);
    
    if (!member || !member.guild || member.user.bot) return;
    
    const guild = member.guild;
    
    if (!db.isDMGreetingEnabled(guild.id, messageType)) {
      logger.debug(`[sendDMGreeting] ${messageType} not enabled for guild ${guild.id}`);
      return;
    }
    
    const messageData = db.getDMGreetingMessage(guild.id, messageType);
    logger.debug(`[sendDMGreeting] Message data: ${messageData ? 'found' : 'not found'}`);
    if (!messageData) return;
    
    try {
      let content = messageData.content ? 
        await this.parseVariables(messageData.content, member, guild, messageType, client) : null;
      
      const embed = await this.createEmbed(messageData, member, guild, messageType, client);
      
      await member.send({
        content: content,
        embeds: embed ? [embed] : []
      });
      
      logger.info(`[sendDMGreeting] Sent ${messageType} DM to ${member.user.tag} (${member.id})`);
      
    } catch (error) {
      logger.debug(`[sendDMGreeting] Could not send DM to ${member.user.tag}: ${error.message}`);
    }
  }

  /**
   * Handle member join (both channel and DM)
   */
  static async handleMemberJoin(member, client) {
    logger.info(`[handleMemberJoin] ${member.user.tag} (${member.id}) joined ${member.guild.name} (${member.guild.id})`);
    await this.sendGreeting(member, 'welcome', client);
    await this.sendDMGreeting(member, 'welcome_dm', client);
  }

  /**
   * Handle member leave
   */
  static async handleMemberLeave(member, client) {
    logger.info(`[handleMemberLeave] ${member.user?.tag || member.id} left ${member.guild?.name || member.guild?.id}`);
    await this.sendGreeting(member, 'farewell', client);
    await this.sendDMGreeting(member, 'farewell_dm', client);
  }

  /**
   * Handle member ban
   */
  static async handleBan(guild, user, client) {
    logger.info(`[handleBan] ${user.tag} (${user.id}) banned from ${guild.name} (${guild.id})`);
    try {
      const member = { 
        user, 
        guild,
        joinedTimestamp: null,
        displayName: user.username
      };
      await this.sendGreeting(member, 'ban', client);
    } catch (error) {
      logger.error('Error handling ban greeting:', error);
    }
  }

  /**
   * Handle member kick
   */
  static async handleKick(guild, user, client) {
    logger.info(`[handleKick] ${user.tag} (${user.id}) kicked from ${guild.name} (${guild.id})`);
    try {
      const member = { 
        user, 
        guild,
        joinedTimestamp: null,
        displayName: user.username
      };
      await this.sendGreeting(member, 'kick', client);
    } catch (error) {
      logger.error('Error handling kick greeting:', error);
    }
  }

  /**
   * Test greeting (sends to specified channel or DM)
   */
  static async testGreeting(options, client) {
  const { interaction, type, targetChannel, isDM = false } = options;
  const member = interaction.member;
  const guild = interaction.guild;
  
  const testMember = {
    user: member.user,
    guild: guild,
    joinedTimestamp: member.joinedTimestamp || Date.now() - 86400000,
    displayName: member.displayName
  };
  
  let result = { success: false, message: '', location: '' };
  
  if (isDM) {
    const messageType = type === 'welcome' ? 'welcome_dm' : 'farewell_dm';
    const messageData = db.getDMGreetingMessage(guild.id, messageType);
    
    if (!messageData) {
      result.message = `❌ No DM ${type} message configured. Use \`/greetings set dm ${type}\` first.`;
      return result;
    }
    
    try {
      let content = messageData.content ? 
        await this.parseVariables(messageData.content, testMember, guild, messageType, client) : null;
      const embed = await this.createEmbed(messageData, testMember, guild, messageType, client);
      
      await member.send({
        content: content,
        embeds: embed ? [embed] : []
      });
      
      result.success = true;
      result.message = `✅ Test DM **${type}** message sent to your DMs!`;
      result.location = 'DM';
    } catch (error) {
      result.message = `❌ Could not send DM. You may have DMs disabled.`;
    }
  } else {
    // Determine channel if not provided
    let channel = targetChannel;
    if (!channel) {
      const settings = db.getGreetingsSettings(guild.id);
      let channelId;
      
      if (type === 'welcome') {
        channelId = settings.welcome_channel_id;
      } else if (type === 'farewell') {
        channelId = settings.farewell_channel_id || settings.welcome_channel_id;
      } else if (type === 'ban') {
        channelId = settings.ban_channel_id || settings.welcome_channel_id;
      } else if (type === 'kick') {
        channelId = settings.kick_channel_id || settings.welcome_channel_id;
      } else {
        channelId = settings.welcome_channel_id;
      }
      
      if (!channelId) {
        result.message = `❌ No channel configured for ${type} messages. Please set a channel first.`;
        return result;
      }
      
      channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        result.message = `❌ Configured channel not found. Please set a new channel.`;
        return result;
      }
    }
    
    const messageData = db.getGreetingMessage(guild.id, type);
    
    if (!messageData) {
      result.message = `❌ No ${type} message configured. Use \`/greetings set channel ${type}\` first.`;
      return result;
    }
    
    try {
      let content = messageData.content ? 
        await this.parseVariables(messageData.content, testMember, guild, type, client) : null;
      const embed = await this.createEmbed(messageData, testMember, guild, type, client);
      
      await channel.send({
        content: content,
        embeds: embed ? [embed] : []
      });
      
      result.success = true;
      result.message = `✅ Test **${type}** message sent to ${channel}!`;
      result.location = channel.toString();
    } catch (error) {
      logger.error('Test greeting error:', error);
      result.message = `❌ Failed to send message: ${error.message}`;
    }
  }
  
  return result;
  }
}

module.exports = GreetingsManager;
// systems/pinmsg.js (modified constructor and handleMessage)
const { EmbedBuilder } = require('discord.js');
const { logger } = require('../utils/logger');

class PinMessageManager {
  constructor(client) {
    this.client = client;
  }

  init() {
    this.client.on('messageCreate', this.handleMessage.bind(this));
    logger.info('[PinMsg] Advanced system active');
  }

  async handleMessage(message) {
    if (message.author.bot || !message.guild) return;

    const channelId = message.channel.id;
    const db = require('../database');

    const pinChannel = db.getPinChannel(channelId);
    if (!pinChannel) return;

    try {
      // 1. Delete previous bot message (if any)
      if (pinChannel.last_message_id) {
        const oldMsg = await message.channel.messages.fetch(pinChannel.last_message_id).catch(() => null);
        if (oldMsg) await oldMsg.delete();
      }

      // 2. Build message payload
      let content = null;
      let embed = null;

      if (pinChannel.use_embed) {
        // Build embed from stored fields
        embed = new EmbedBuilder()
          .setColor(pinChannel.embed_color || '#5865F2');

        if (pinChannel.embed_title) embed.setTitle(pinChannel.embed_title);
        if (pinChannel.embed_title_url) embed.setURL(pinChannel.embed_title_url);
        if (pinChannel.embed_description) embed.setDescription(pinChannel.embed_description);
        if (pinChannel.embed_footer) {
          embed.setFooter({ text: pinChannel.embed_footer, iconURL: pinChannel.embed_footer_icon || null });
        }
        if (pinChannel.embed_thumbnail) embed.setThumbnail(pinChannel.embed_thumbnail);
        if (pinChannel.embed_image) embed.setImage(pinChannel.embed_image);
        if (pinChannel.embed_author) {
          embed.setAuthor({ name: pinChannel.embed_author, iconURL: pinChannel.embed_author_icon || null, url: pinChannel.embed_author_url || null });
        }
        if (pinChannel.embed_timestamp) embed.setTimestamp(new Date(pinChannel.embed_timestamp));
        if (pinChannel.embed_fields) {
          try {
            const fields = JSON.parse(pinChannel.embed_fields);
            fields.forEach(f => embed.addFields({
              name: f.name || '\u200b',
              value: f.value || '\u200b',
              inline: !!f.inline
            }));
          } catch (e) { }
        }

        // Check if the embed is essentially empty (Discord forbids empty embeds)
        const hasEmbedContent =
          embed.data.title ||
          embed.data.description ||
          (embed.data.fields && embed.data.fields.length > 0) ||
          embed.data.image ||
          embed.data.thumbnail ||
          (embed.data.author && embed.data.author.name) ||
          (embed.data.footer && embed.data.footer.text);

        if (!hasEmbedContent) {
          embed = null; // Don't send a broken embed
        }

        // If there's also text content, include it
        if (pinChannel.content && pinChannel.content.length > 0) {
          content = pinChannel.content;
        }
      } else if (pinChannel.content && pinChannel.content.length > 0) {
        // Custom text only
        content = pinChannel.content;
      } else {
        // Echo user message
        if (message.content && message.content.length > 0) {
          content = message.content;
        }
      }

      // 3. Send the message (only if there is something to send)
      let newMsg = null;
      if (content || embed) {
        newMsg = await message.channel.send({
          content: content || undefined,
          embeds: embed ? [embed] : undefined
        });
      }

      // 4. Update last message ID
      db.updatePinLastMessage(channelId, newMsg ? newMsg.id : null);

    } catch (err) {
      logger.error(`[PinMsg] Error in #${message.channel.name}: ${err.message}`);
    }
  }
}

module.exports = PinMessageManager;
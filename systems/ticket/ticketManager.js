// systems/ticket/ticketManager.js
const { ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database');
const { logger } = require('../../utils/logger');
const emojis = require('../../constants/emojis');
const transcriptGenerator = require('./ticketTranscript');

class TicketManager {
    constructor(client) {
        this.client = client;
    }

    /**
     * Get the next ticket number for a panel
     */
    static async getNextTicketNumber(panelId) {
        const stmt = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE panel_id = ?');
        const row = stmt.get(panelId);
        return (row.count || 0) + 1;
    }

    /**
     * Create a ticket channel
     */
    async createTicket(interaction, panelId, reason = null) {
        const panel = db.prepare('SELECT * FROM ticket_panels WHERE id = ?').get(panelId);
        if (!panel) {
            await interaction.reply({ content: `${emojis.ERROR} Panel not found.`, ephemeral: true });
            return;
        }

        const guild = interaction.guild;
        const user = interaction.user;
        const ticketNumber = await TicketManager.getNextTicketNumber(panel.id);
        const channelName = panel.ticket_name_format.replace('{number}', ticketNumber).replace('{user}', user.username);

        // Check if user already has an open ticket for this panel (optional)
        const existing = db.prepare('SELECT channel_id FROM tickets WHERE guild_id = ? AND panel_id = ? AND owner_id = ? AND status = "open"').get(guild.id, panel.id, user.id);
        if (existing) {
            const channel = guild.channels.cache.get(existing.channel_id);
            if (channel) {
                return interaction.reply({ content: `${emojis.WARN} You already have an open ticket: ${channel}`, ephemeral: true });
            } else {
                // Clean up orphaned record
                db.prepare('DELETE FROM tickets WHERE channel_id = ?').run(existing.channel_id);
            }
        }

        // Create the channel
        const category = panel.category_id ? guild.channels.cache.get(panel.category_id) : null;
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                    ],
                },
                {
                    id: panel.support_role_id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                    ],
                },
                // Add bot's own permissions
                {
                    id: this.client.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ReadMessageHistory],
                }
            ],
            reason: `Ticket opened by ${user.tag}`,
        });

        // Insert into database
        const insertTicket = db.prepare(`
            INSERT INTO tickets (guild_id, panel_id, ticket_number, channel_id, owner_id, status)
            VALUES (?, ?, ?, ?, ?, 'open')
        `);
        const ticketResult = insertTicket.run(guild.id, panel.id, ticketNumber, channel.id, user.id);
        const ticketId = ticketResult.lastInsertRowid;

        // Send welcome message
        await this.sendWelcomeMessage(channel, user, panel, reason, ticketNumber);

        // Log to database (first message)
        db.prepare(`
            INSERT INTO ticket_messages (ticket_id, author_id, author_tag, content)
            VALUES (?, ?, ?, ?)
        `).run(ticketId, this.client.user.id, this.client.user.tag, `Ticket opened by ${user.tag}${reason ? `\nReason: ${reason}` : ''}`);

        // DM the user
        if (db.prepare('SELECT dm_on_open FROM ticket_settings WHERE guild_id = ?').get(guild.id)?.dm_on_open !== 0) {
            this.sendDM(user, 'open', { guild, ticketNumber, channel, reason }).catch(e => logger.debug(`DM failed for ${user.tag}: ${e.message}`));
        }

        logger.info(`${emojis.TICKET} Ticket #${ticketNumber} created for ${user.tag} in ${guild.name}`);
        return channel;
    }

    /**
     * Send the initial welcome message in the ticket channel
     */
    async sendWelcomeMessage(channel, user, panel, reason, ticketNumber) {
        const embed = new EmbedBuilder()
            .setColor(panel.embed_color || 0x5865F2)
            .setTitle(`Ticket #${ticketNumber}`)
            .setDescription(panel.welcome_message || `Welcome <@${user.id}>!\nSupport will be with you shortly.`)
            .addFields(
                { name: 'Opened by', value: user.tag, inline: true },
                { name: 'Reason', value: reason || 'Not provided', inline: true }
            )
            .setTimestamp();

        const closeButton = new ButtonBuilder()
            .setCustomId(`ticket_close_${ticketNumber}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');

        const claimButton = new ButtonBuilder()
            .setCustomId(`ticket_claim_${ticketNumber}`)
            .setLabel('Claim')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🙋');

        const row = new ActionRowBuilder().addComponents(closeButton, claimButton);

        await channel.send({ content: `${emojis.TICKET} Ticket created by ${user}`, embeds: [embed], components: [row] });
    }

    /**
     * Close a ticket
     */
    async closeTicket(interaction, ticketChannel, closer) {
        const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(ticketChannel.id);
        if (!ticket) {
            return interaction.reply({ content: `${emojis.ERROR} This channel is not a ticket.`, ephemeral: true });
        }
        if (ticket.status !== 'open') {
            return interaction.reply({ content: `${emojis.ERROR} This ticket is already closed.`, ephemeral: true });
        }

        // Update database
        db.prepare(`
            UPDATE tickets SET status = 'closed', closed_at = datetime('now', 'localtime'), closed_by = ?
            WHERE channel_id = ?
        `).run(closer.id, ticketChannel.id);

        // Remove user's view permission (optional, or just archive)
        await ticketChannel.permissionOverwrites.edit(ticket.owner_id, { ViewChannel: false });

        // Send closing message
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription(`${emojis.LOCK} Ticket closed by ${closer.tag}`)
            .setTimestamp();
        await ticketChannel.send({ embeds: [embed] });

        // Optionally delete the channel after a delay (e.g., 5 seconds) or keep as closed
        setTimeout(() => ticketChannel.delete().catch(e => logger.debug(`Could not delete closed ticket: ${e.message}`)), 5000);

        // Generate transcript
        const transcriptChannelId = db.prepare('SELECT transcript_channel_id FROM ticket_settings WHERE guild_id = ?').get(ticket.guild_id)?.transcript_channel_id;
        if (transcriptChannelId) {
            const transcriptChannel = interaction.guild.channels.cache.get(transcriptChannelId);
            if (transcriptChannel) {
                const messages = await this.fetchMessages(ticketChannel);
                const html = await transcriptGenerator.generateHTML(ticket, messages, interaction.guild);
                await transcriptChannel.send({ files: [{ attachment: Buffer.from(html), name: `ticket-${ticket.ticket_number}.html` }] });
            }
        }

        // DM user
        if (db.prepare('SELECT dm_on_close FROM ticket_settings WHERE guild_id = ?').get(ticket.guild_id)?.dm_on_close !== 0) {
            const owner = await this.client.users.fetch(ticket.owner_id);
            this.sendDM(owner, 'close', { guild: interaction.guild, ticketNumber: ticket.ticket_number, closer }).catch(e => logger.debug(`DM failed: ${e.message}`));
        }

        logger.info(`${emojis.LOCK} Ticket #${ticket.ticket_number} closed by ${closer.tag}`);
    }

    /**
     * Add a user to a ticket
     */
    async addUserToTicket(interaction, targetUser) {
        const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: `${emojis.ERROR} This is not a ticket channel.`, ephemeral: true });

        await interaction.channel.permissionOverwrites.edit(targetUser.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });
        await interaction.reply({ content: `${emojis.SUCCESS} Added ${targetUser} to the ticket.` });

        db.prepare(`
            INSERT INTO ticket_messages (ticket_id, author_id, author_tag, content)
            VALUES (?, ?, ?, ?)
        `).run(ticket.id, interaction.user.id, interaction.user.tag, `Added ${targetUser.tag} to ticket`);
    }

    /**
     * Remove a user from a ticket
     */
    async removeUserFromTicket(interaction, targetUser) {
        const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: `${emojis.ERROR} This is not a ticket channel.`, ephemeral: true });
        if (targetUser.id === ticket.owner_id) {
            return interaction.reply({ content: `${emojis.ERROR} Cannot remove the ticket owner.`, ephemeral: true });
        }

        await interaction.channel.permissionOverwrites.delete(targetUser.id);
        await interaction.reply({ content: `${emojis.SUCCESS} Removed ${targetUser} from the ticket.` });

        db.prepare(`
            INSERT INTO ticket_messages (ticket_id, author_id, author_tag, content)
            VALUES (?, ?, ?, ?)
        `).run(ticket.id, interaction.user.id, interaction.user.tag, `Removed ${targetUser.tag} from ticket`);
    }

    /**
     * Claim a ticket
     */
    async claimTicket(interaction) {
        const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: `${emojis.ERROR} This is not a ticket channel.`, ephemeral: true });
        if (ticket.status !== 'open') return interaction.reply({ content: `${emojis.ERROR} Ticket is not open.`, ephemeral: true });

        const existingClaim = db.prepare('SELECT * FROM ticket_claims WHERE ticket_id = ?').get(ticket.id);
        if (existingClaim) {
            const claimer = await this.client.users.fetch(existingClaim.claimed_by).catch(() => null);
            return interaction.reply({ content: `${emojis.WARN} This ticket is already claimed by ${claimer ? claimer.tag : 'someone'}.`, ephemeral: true });
        }

        db.prepare('INSERT INTO ticket_claims (ticket_id, claimed_by) VALUES (?, ?)').run(ticket.id, interaction.user.id);
        await interaction.reply({ content: `${emojis.SUCCESS} Ticket claimed by ${interaction.user}.` });

        if (db.prepare('SELECT dm_on_claim FROM ticket_settings WHERE guild_id = ?').get(ticket.guild_id)?.dm_on_claim !== 0) {
            const owner = await this.client.users.fetch(ticket.owner_id);
            this.sendDM(owner, 'claim', { guild: interaction.guild, ticketNumber: ticket.ticket_number, claimer: interaction.user }).catch(e => logger.debug(`DM failed: ${e.message}`));
        }

        db.prepare(`
            INSERT INTO ticket_messages (ticket_id, author_id, author_tag, content)
            VALUES (?, ?, ?, ?)
        `).run(ticket.id, interaction.user.id, interaction.user.tag, `Claimed ticket`);
    }

    /**
     * Send a DM to a user about ticket events
     */
    async sendDM(user, type, data) {
        const embed = new EmbedBuilder()
            .setColor(type === 'open' ? 0x00FF00 : type === 'close' ? 0xFF0000 : 0x5865F2)
            .setTitle(`Ticket ${type.charAt(0).toUpperCase() + type.slice(1)}`)
            .setDescription(`Your ticket in **${data.guild.name}** has been ${type}ed.`)
            .addFields({ name: 'Ticket Number', value: `#${data.ticketNumber}`, inline: true })
            .setTimestamp();

        if (type === 'open' && data.reason) {
            embed.addFields({ name: 'Reason', value: data.reason, inline: false });
        }
        if (type === 'close' && data.closer) {
            embed.addFields({ name: 'Closed by', value: data.closer.tag, inline: true });
        }
        if (type === 'claim' && data.claimer) {
            embed.addFields({ name: 'Claimed by', value: data.claimer.tag, inline: true });
        }

        await user.send({ embeds: [embed] });
    }

    /**
     * Fetch all messages from a ticket channel (for transcript)
     */
    async fetchMessages(channel) {
        const messages = [];
        let lastId = null;
        while (true) {
            const options = { limit: 100 };
            if (lastId) options.before = lastId;
            const batch = await channel.messages.fetch(options);
            if (batch.size === 0) break;
            messages.push(...batch.values());
            lastId = batch.last().id;
        }
        return messages.reverse(); // oldest first
    }
}

module.exports = TicketManager;
const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, 
  PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database');
const { logger } = require('../utils/logger');
const emojis = require('../constants/emojis');
const TicketManager = require('../systems/ticket/ticketManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Ticket system commands')
        // Panel management (admin only)
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Create or manage ticket panels')
                .addStringOption(opt => opt.setName('name').setDescription('Panel name').setRequired(true))
                .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send panel').setRequired(true))
                .addChannelOption(opt => opt.setName('category').setDescription('Category for tickets').addChannelTypes(ChannelType.GuildCategory))
                .addRoleOption(opt => opt.setName('support_role').setDescription('Support role'))
                .addStringOption(opt => opt.setName('button_label').setDescription('Button label').setMaxLength(80))
                .addStringOption(opt => opt.setName('button_emoji').setDescription('Emoji for button'))
                .addStringOption(opt => opt.setName('button_style').setDescription('Button style').addChoices(
                    { name: 'Primary', value: 'primary' },
                    { name: 'Secondary', value: 'secondary' },
                    { name: 'Success', value: 'success' },
                    { name: 'Danger', value: 'danger' }
                ))
                .addStringOption(opt => opt.setName('welcome_message').setDescription('Welcome message in ticket'))
                .addStringOption(opt => opt.setName('embed_color').setDescription('Embed color (hex)'))
        )
        .addSubcommand(sub =>
            sub.setName('config')
                .setDescription('Configure ticket settings')
                .addChannelOption(opt => opt.setName('transcript_channel').setDescription('Channel for transcripts'))
                .addBooleanOption(opt => opt.setName('dm_on_open').setDescription('Send DM when ticket opened'))
                .addBooleanOption(opt => opt.setName('dm_on_close').setDescription('Send DM when ticket closed'))
        )
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Close the current ticket')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete the current ticket')
        )
        .addSubcommand(sub =>
            sub.setName('rename')
                .setDescription('Rename the current ticket')
                .addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a user to the ticket')
                .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a user from the ticket')
                .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('claim')
                .setDescription('Claim the current ticket')
        )
        .addSubcommand(sub =>
            sub.setName('unclaim')
                .setDescription('Unclaim the current ticket')
        )
        .addSubcommand(sub =>
            sub.setName('transcript')
                .setDescription('Generate a transcript of this ticket')
        ),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const ticketManager = new TicketManager(client);
        const guild = interaction.guild;

        // Permission checks – most subcommands require admin or specific roles
        // We'll implement checks per subcommand

        if (sub === 'panel') {
            if (!db.isAdmin(guild.id, interaction.user.id) && !db.isSelfRoleAdmin(guild.id, interaction.user.id)) {
                return interaction.reply({ content: `${emojis.ERROR} You need admin permissions to manage panels.`, ephemeral: true });
            }
            const name = interaction.options.getString('name');
            const channel = interaction.options.getChannel('channel');
            const category = interaction.options.getChannel('category');
            const supportRole = interaction.options.getRole('support_role');
            const buttonLabel = interaction.options.getString('button_label') || 'Open Ticket';
            const buttonEmoji = interaction.options.getString('button_emoji');
            const buttonStyle = interaction.options.getString('button_style') || 'primary';
            const welcomeMessage = interaction.options.getString('welcome_message') || 'Thank you for opening a ticket. Support will be with you shortly.';
            const embedColor = interaction.options.getString('embed_color') || '#5865F2';

            db.createTicketPanel(guild.id, name, channel.id, category?.id, supportRole?.id, 'ticket-{number}', welcomeMessage, embedColor, buttonLabel, buttonEmoji, buttonStyle, interaction.user.id);

            // Send the panel message
            const button = new ButtonBuilder()
                .setCustomId(`ticket_open_${name}`)
                .setLabel(buttonLabel)
                .setStyle(buttonStyle.toUpperCase())
                .setEmoji(buttonEmoji || null);
            const row = new ActionRowBuilder().addComponents(button);
            const panelMsg = await channel.send({ content: `**${name}**\nClick the button to open a ticket.`, components: [row] });
            db.setTicketPanelMessage(guild.id, name, panelMsg.id);

            await interaction.reply({ content: `${emojis.SUCCESS} Panel created in ${channel}.`, ephemeral: true });
        }
        else if (sub === 'config') {
            if (!db.isAdmin(guild.id, interaction.user.id)) {
                return interaction.reply({ content: `${emojis.ERROR} Admin required.`, ephemeral: true });
            }
            const transcriptChannel = interaction.options.getChannel('transcript_channel');
            const dmOnOpen = interaction.options.getBoolean('dm_on_open');
            const dmOnClose = interaction.options.getBoolean('dm_on_close');

            if (transcriptChannel) db.setTicketSetting(guild.id, 'transcript_channel_id', transcriptChannel.id);
            if (dmOnOpen !== null) db.setTicketSetting(guild.id, 'dm_on_open', dmOnOpen ? 1 : 0);
            if (dmOnClose !== null) db.setTicketSetting(guild.id, 'dm_on_close', dmOnClose ? 1 : 0);

            await interaction.reply({ content: `${emojis.SUCCESS} Settings updated.`, ephemeral: true });
        }
        else if (sub === 'close') {
            if (!interaction.channel) return interaction.reply({ content: `${emojis.ERROR} This command must be used in a ticket channel.`, ephemeral: true });
            const ticket = db.getTicketByChannel(interaction.channel.id);
            if (!ticket) return interaction.reply({ content: `${emojis.ERROR} Not a ticket channel.`, ephemeral: true });
            await ticketManager.closeTicket(interaction, interaction.channel, interaction.user);
        }
        else if (sub === 'delete') {
            if (!interaction.channel) return interaction.reply({ content: `${emojis.ERROR} This command must be used in a ticket channel.`, ephemeral: true });
            const ticket = db.getTicketByChannel(interaction.channel.id);
            if (!ticket) return interaction.reply({ content: `${emojis.ERROR} Not a ticket channel.`, ephemeral: true });
            // Check permissions: owner or admin or support role
            const panel = db.prepare('SELECT support_role_id FROM ticket_panels WHERE id = ?').get(ticket.panel_id);
            const isSupport = panel.support_role_id && interaction.member.roles.cache.has(panel.support_role_id);
            if (ticket.owner_id !== interaction.user.id && !db.isAdmin(guild.id, interaction.user.id) && !isSupport) {
                return interaction.reply({ content: `${emojis.ERROR} You cannot delete this ticket.`, ephemeral: true });
            }
            await interaction.channel.delete();
            db.prepare('DELETE FROM tickets WHERE channel_id = ?').run(interaction.channel.id);
        }
        else if (sub === 'rename') {
            if (!interaction.channel) return interaction.reply({ content: `${emojis.ERROR} This command must be used in a ticket channel.`, ephemeral: true });
            const newName = interaction.options.getString('name');
            await interaction.channel.setName(newName);
            await interaction.reply({ content: `${emojis.SUCCESS} Channel renamed to ${newName}`, ephemeral: true });
        }
        else if (sub === 'add') {
            if (!interaction.channel) return interaction.reply({ content: `${emojis.ERROR} This command must be used in a ticket channel.`, ephemeral: true });
            const user = interaction.options.getUser('user');
            await ticketManager.addUserToTicket(interaction, user);
        }
        else if (sub === 'remove') {
            if (!interaction.channel) return interaction.reply({ content: `${emojis.ERROR} This command must be used in a ticket channel.`, ephemeral: true });
            const user = interaction.options.getUser('user');
            await ticketManager.removeUserFromTicket(interaction, user);
        }
        else if (sub === 'claim') {
            if (!interaction.channel) return interaction.reply({ content: `${emojis.ERROR} This command must be used in a ticket channel.`, ephemeral: true });
            await ticketManager.claimTicket(interaction);
        }
        else if (sub === 'unclaim') {
            if (!interaction.channel) return interaction.reply({ content: `${emojis.ERROR} This command must be used in a ticket channel.`, ephemeral: true });
            const ticket = db.getTicketByChannel(interaction.channel.id);
            if (!ticket) return interaction.reply({ content: `${emojis.ERROR} Not a ticket channel.`, ephemeral: true });
            const claim = db.prepare('SELECT * FROM ticket_claims WHERE ticket_id = ?').get(ticket.id);
            if (!claim) return interaction.reply({ content: `${emojis.ERROR} This ticket is not claimed.`, ephemeral: true });
            if (claim.claimed_by !== interaction.user.id && !db.isAdmin(guild.id, interaction.user.id)) {
                return interaction.reply({ content: `${emojis.ERROR} You are not the claimer.`, ephemeral: true });
            }
            db.prepare('DELETE FROM ticket_claims WHERE ticket_id = ?').run(ticket.id);
            await interaction.reply({ content: `${emojis.SUCCESS} Ticket unclaimed.` });
        }
        else if (sub === 'transcript') {
            if (!interaction.channel) return interaction.reply({ content: `${emojis.ERROR} This command must be used in a ticket channel.`, ephemeral: true });
            const ticket = db.getTicketByChannel(interaction.channel.id);
            if (!ticket) return interaction.reply({ content: `${emojis.ERROR} Not a ticket channel.`, ephemeral: true });
            const messages = await ticketManager.fetchMessages(interaction.channel);
            const html = await require('../systems/ticket/ticketTranscript').generateHTML(ticket, messages, interaction.guild);
            await interaction.reply({ files: [{ attachment: Buffer.from(html), name: `ticket-${ticket.ticket_number}.html` }], ephemeral: true });
        }
    },

    // Optional: autocomplete for panel names if needed
};
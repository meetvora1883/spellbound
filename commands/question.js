const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const db = require('../database');
const QuestionManager = require('../systems/question/questionManager');
const emojis = require('../constants/emojis');

// Helper to get current date/time in a given timezone
function getCurrentInTimezone(zone) {
    const now = DateTime.now().setZone(zone);
    return {
        date: now.toFormat('yyyy-MM-dd'),
        time: now.toFormat('HH:mm')
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('question')
        .setDescription('Manage interactive questions')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a new question (opens a modal)')
        )
        .addSubcommand(sub =>
            sub.setName('option')
                .setDescription('Add an option to a question')
                .addIntegerOption(opt => opt.setName('question_id').setDescription('ID of the question').setRequired(true))
                .addStringOption(opt => opt.setName('label').setDescription('Button label').setRequired(true))
                .addStringOption(opt => opt.setName('emoji').setDescription('Emoji for the button (unicode or custom ID)').setRequired(false))
                .addStringOption(opt => opt.setName('answer_text').setDescription('Text answer (if any)').setRequired(false))
                .addNumberOption(opt => opt.setName('answer_number').setDescription('Numeric value (if any)').setRequired(false))
                .addStringOption(opt => opt.setName('style').setDescription('Button style').setRequired(false).addChoices(
                    { name: 'Primary', value: 'primary' },
                    { name: 'Secondary', value: 'secondary' },
                    { name: 'Success', value: 'success' },
                    { name: 'Danger', value: 'danger' }
                ))
        )
        .addSubcommand(sub =>
            sub.setName('send')
                .setDescription('Send the question to a channel (buttons disabled)')
                .addIntegerOption(opt => opt.setName('question_id').setDescription('ID of the question').setRequired(true))
                .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send to').setRequired(true))
                .addBooleanOption(opt => opt.setName('schedule').setDescription('Schedule for later? If true, you must specify a timezone').setRequired(false))
                .addStringOption(opt =>
                    opt.setName('timezone')
                        .setDescription('IANA timezone (e.g., Asia/Kolkata, Europe/London, UTC) – required if scheduling')
                        .setRequired(false)
                        .addChoices(
                            { name: 'UTC', value: 'UTC' },
                            { name: 'India (IST) – Asia/Kolkata', value: 'Asia/Kolkata' },
                            { name: 'UK (GMT/BST) – Europe/London', value: 'Europe/London' },
                            { name: 'US Eastern (EST/EDT) – America/New_York', value: 'America/New_York' },
                            { name: 'US Central (CST/CDT) – America/Chicago', value: 'America/Chicago' },
                            { name: 'US Mountain (MST/MDT) – America/Denver', value: 'America/Denver' },
                            { name: 'US Pacific (PST/PDT) – America/Los_Angeles', value: 'America/Los_Angeles' },
                            { name: 'Europe Central (CET/CEST) – Europe/Berlin', value: 'Europe/Berlin' },
                            { name: 'Japan (JST) – Asia/Tokyo', value: 'Asia/Tokyo' },
                            { name: 'Australia Eastern (AEST/AEDT) – Australia/Sydney', value: 'Australia/Sydney' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Start the question (enable buttons) – can be used on sent or closed questions')
                .addIntegerOption(opt => opt.setName('question_id').setDescription('ID of the question').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('Stop the question (disable or remove buttons) – can be used on active or sent questions')
                .addIntegerOption(opt => opt.setName('question_id').setDescription('ID of the question').setRequired(true))
                .addBooleanOption(opt => opt.setName('remove_buttons').setDescription('Remove buttons completely? If false, buttons stay disabled').setRequired(false))
                .addBooleanOption(opt => opt.setName('show_results').setDescription('Show final results in the channel').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('results')
                .setDescription('Show results of a question')
                .addIntegerOption(opt => opt.setName('question_id').setDescription('ID of the question').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a question and all data')
                .addIntegerOption(opt => opt.setName('question_id').setDescription('ID of the question').setRequired(true))
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // Permission check (admin or owner)
        if (!db.isAdmin(guildId, interaction.user.id) && interaction.user.id !== client.ownerId) {
            return interaction.reply({ content: `${emojis.ERROR} You need admin permissions.`, flags: MessageFlags.Ephemeral });
        }

        if (subcommand === 'create') {
            const modal = new ModalBuilder()
                .setCustomId('question_create')
                .setTitle('Create Question');

            const titleInput = new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(256);
            const descInput = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Description (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(2000);
            const footerInput = new TextInputBuilder()
                .setCustomId('footer')
                .setLabel('Footer (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(2048);
            const suffixInput = new TextInputBuilder()
                .setCustomId('suffix')
                .setLabel('Suffix for numbers (e.g., "points")')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(100);
            const maxInteractionsInput = new TextInputBuilder()
                .setCustomId('max_interactions')
                .setLabel('Max responses per user (0 = unlimited)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('Default 1');

            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descInput),
                new ActionRowBuilder().addComponents(footerInput),
                new ActionRowBuilder().addComponents(suffixInput),
                new ActionRowBuilder().addComponents(maxInteractionsInput)
            );

            await interaction.showModal(modal);

        } else if (subcommand === 'option') {
            const questionId = interaction.options.getInteger('question_id');
            const question = db.getQuestion(questionId);
            if (!question || question.guild_id !== guildId) {
                return interaction.reply({ content: `${emojis.ERROR} Question not found.`, flags: MessageFlags.Ephemeral });
            }
            if (question.status !== 'draft') {
                return interaction.reply({ content: `${emojis.ERROR} You can only add options while the question is in draft status.`, flags: MessageFlags.Ephemeral });
            }

            const label = interaction.options.getString('label');
            const emoji = interaction.options.getString('emoji');
            const answerText = interaction.options.getString('answer_text');
            const answerNumber = interaction.options.getNumber('answer_number');
            const style = interaction.options.getString('style') || 'primary';

            const existing = db.getQuestionOptions(questionId);
            const position = existing.length;

            db.addQuestionOption(questionId, label, answerText, answerNumber, emoji, style, position);

            await interaction.reply({ content: `${emojis.SUCCESS} Option "${label}" added.`, flags: MessageFlags.Ephemeral });

        } else if (subcommand === 'send') {
            const questionId = interaction.options.getInteger('question_id');
            const channel = interaction.options.getChannel('channel');
            const schedule = interaction.options.getBoolean('schedule') || false;
            const timezone = interaction.options.getString('timezone');

            if (schedule && !timezone) {
                return interaction.reply({ content: `${emojis.ERROR} You must specify a timezone when scheduling.`, flags: MessageFlags.Ephemeral });
            }

            const question = db.getQuestion(questionId);
            if (!question || question.guild_id !== guildId) {
                return interaction.reply({ content: `${emojis.ERROR} Question not found.`, flags: MessageFlags.Ephemeral });
            }
            if (question.status !== 'draft') {
                return interaction.reply({ content: `${emojis.ERROR} This question is already sent or closed.`, flags: MessageFlags.Ephemeral });
            }
            const options = db.getQuestionOptions(questionId);
            if (options.length === 0) {
                return interaction.reply({ content: `${emojis.ERROR} No options added yet. Use \`/question option\` first.`, flags: MessageFlags.Ephemeral });
            }

            if (schedule) {
                // Get current date/time in the user's chosen timezone for placeholders
                const { date, time } = getCurrentInTimezone(timezone);

                const modal = new ModalBuilder()
                    .setCustomId(`question_schedule_${questionId}_${timezone}_${channel.id}`)
                    .setTitle(`Schedule Question (${timezone})`);

                const dateInput = new TextInputBuilder()
                    .setCustomId('date')
                    .setLabel('Date (YYYY-MM-DD)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder(date);
                const timeInput = new TextInputBuilder()
                    .setCustomId('time')
                    .setLabel('Time (HH:MM) 24‑hour format')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder(time);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(dateInput),
                    new ActionRowBuilder().addComponents(timeInput)
                );

                await interaction.showModal(modal);
            } else {
                // Send immediately
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const message = await QuestionManager.sendQuestion(channel, question, options, true);
                db.setQuestionMessage(questionId, channel.id, message.id);
                db.setQuestionStatus(questionId, 'sent');
                await interaction.editReply({ content: `${emojis.SUCCESS} Question sent to ${channel} (buttons are currently disabled). Use \`/question start\` to enable them.` });
            }

        } else if (subcommand === 'start') {
            const questionId = interaction.options.getInteger('question_id');
            const question = db.getQuestion(questionId);
            if (!question || question.guild_id !== guildId) {
                return interaction.reply({ content: `${emojis.ERROR} Question not found.`, flags: MessageFlags.Ephemeral });
            }
            // Allowed statuses: sent, closed
            if (!['sent', 'closed'].includes(question.status)) {
                return interaction.reply({ 
                    content: `${emojis.ERROR} This question cannot be started because it is **${question.status}**. Only 'sent' or 'closed' questions can be started.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }
            if (!question.channel_id || !question.message_id) {
                return interaction.reply({ content: `${emojis.ERROR} Question has no message (this shouldn't happen).`, flags: MessageFlags.Ephemeral });
            }

            db.setQuestionStatus(questionId, 'active');
            await QuestionManager.updateQuestionMessage(client, { ...question, status: 'active' });
            await interaction.reply({ content: `${emojis.SUCCESS} Question started! Buttons are now active.`, flags: MessageFlags.Ephemeral });

        } else if (subcommand === 'stop') {
            const questionId = interaction.options.getInteger('question_id');
            const removeButtons = interaction.options.getBoolean('remove_buttons') || false;
            const showResults = interaction.options.getBoolean('show_results') || false;
            const question = db.getQuestion(questionId);
            if (!question || question.guild_id !== guildId) {
                return interaction.reply({ content: `${emojis.ERROR} Question not found.`, flags: MessageFlags.Ephemeral });
            }
            // Allowed statuses: active, sent
            if (!['active', 'sent'].includes(question.status)) {
                return interaction.reply({ 
                    content: `${emojis.ERROR} This question cannot be stopped because it is **${question.status}**. Only 'active' or 'sent' questions can be stopped.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }

            db.setQuestionStatus(questionId, 'closed');
            const options = db.getQuestionOptions(questionId);
            const embed = QuestionManager.buildEmbed(question, options);
            let rows = [];
            if (!removeButtons) {
                rows = QuestionManager.buildActionRows(questionId, options, true);
            }
            try {
                const channel = await client.channels.fetch(question.channel_id);
                const message = await channel.messages.fetch(question.message_id);
                await message.edit({ embeds: [embed], components: rows });
            } catch (err) {
                console.error('Failed to update message on stop:', err);
            }

            if (showResults) {
                const resultsEmbed = await this.buildResultsEmbed(questionId, null);
                const channel = await client.channels.fetch(question.channel_id);
                await channel.send({ embeds: [resultsEmbed] });
            }

            await interaction.reply({ content: `${emojis.SUCCESS} Question stopped.`, flags: MessageFlags.Ephemeral });

        } else if (subcommand === 'results') {
            const questionId = interaction.options.getInteger('question_id');
            const embed = await this.buildResultsEmbed(questionId, interaction.user.id);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        } else if (subcommand === 'delete') {
            const questionId = interaction.options.getInteger('question_id');
            const question = db.getQuestion(questionId);
            if (!question || question.guild_id !== guildId) {
                return interaction.reply({ content: `${emojis.ERROR} Question not found.`, flags: MessageFlags.Ephemeral });
            }
            if (question.channel_id && question.message_id) {
                try {
                    const channel = await interaction.guild.channels.fetch(question.channel_id);
                    const msg = await channel.messages.fetch(question.message_id);
                    await msg.delete();
                } catch {}
            }
            db.deleteQuestion(questionId);
            await interaction.reply({ content: `${emojis.SUCCESS} Question deleted.`, flags: MessageFlags.Ephemeral });
        }
    },

    async buildResultsEmbed(questionId, requestingUserId = null) {
        const { EmbedBuilder } = require('discord.js');
        const question = db.getQuestion(questionId);
        const options = db.getQuestionOptions(questionId);
        const responses = db.getQuestionResponses(questionId);

        const counts = {};
        const sums = {};
        options.forEach(o => {
            counts[o.id] = 0;
            if (o.answer_number !== null) sums[o.id] = 0;
        });
        let totalSum = 0;
        responses.forEach(r => {
            counts[r.option_id] = (counts[r.option_id] || 0) + 1;
            const opt = options.find(o => o.id === r.option_id);
            if (opt && opt.answer_number !== null) {
                sums[r.option_id] = (sums[r.option_id] || 0) + opt.answer_number;
                totalSum += opt.answer_number;
            }
        });

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`${emojis.BAR_CHART} Results: ${question.title}`)
            .setDescription(question.description || null)
            .setFooter({ text: question.footer || 'Final Results' })
            .setTimestamp();

        let fieldValue = '';
        options.forEach(o => {
            const count = counts[o.id] || 0;
            let line = `**${o.label}** – ${count} ${count === 1 ? 'response' : 'responses'}`;
            if (o.answer_number !== null && question.suffix) {
                const sum = sums[o.id] || 0;
                line += ` (total: ${sum}${question.suffix})`;
            }
            fieldValue += line + '\n';
        });
        if (totalSum > 0) {
            fieldValue += `\n**Overall total:** ${totalSum}${question.suffix ? ` ${question.suffix}` : ''}`;
        }
        embed.addFields({ name: 'Results', value: fieldValue });

        if (requestingUserId && (requestingUserId === question.created_by || db.isAdmin(question.guild_id, requestingUserId))) {
            let userList = '';
            responses.forEach(r => {
                const user = `<@${r.user_id}>`;
                const opt = options.find(o => o.id === r.option_id);
                if (opt) {
                    userList += `${user} – ${opt.label}`;
                    if (opt.answer_number !== null) userList += ` (${opt.answer_number}${question.suffix})`;
                    userList += '\n';
                }
            });
            if (userList.length > 0) {
                embed.addFields({ name: 'Individual Responses', value: userList.slice(0, 1024) });
            }
        }

        return embed;
    }
};
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database');
const emojis = require('../../constants/emojis');

class QuestionManager {
    /**
     * Build the live embed for a question.
     * Shows all users per option, splitting into multiple fields if needed.
     */
    static buildEmbed(question, options) {
        const responses = db.getQuestionResponses(question.id);
        
        // Group responses by option id
        const responsesByOption = {};
        options.forEach(o => responsesByOption[o.id] = []);
        responses.forEach(r => {
            if (responsesByOption[r.option_id]) {
                responsesByOption[r.option_id].push(r.user_id);
            }
        });

        // Pre‑compute sums per option if answer_number exists
        const sums = {};
        options.forEach(o => {
            if (o.answer_number !== null) {
                sums[o.id] = responsesByOption[o.id].length * o.answer_number;
            }
        });
        const totalSum = Object.values(sums).reduce((a, b) => a + b, 0);

        // Start building embed
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(question.title)
            .setDescription(question.description || null)
            .setTimestamp();

        if (question.footer) {
            embed.setFooter({ text: question.footer });
        } else {
            embed.setFooter({ text: `Status: ${question.status}` });
        }

        // Sort options by position
        const sortedOptions = [...options].sort((a, b) => a.position - b.position);

        // Build fields for each option
        for (const o of sortedOptions) {
            const users = responsesByOption[o.id] || [];
            const count = users.length;
            const plural = count === 1 ? 'response' : 'responses';
            
            // Header line for this option
            let header = `**${o.label}** – ${count} ${plural}`;
            if (o.answer_number !== null && question.suffix) {
                const sum = sums[o.id] || 0;
                header += ` (total: ${sum}${question.suffix})`;
            }

            // If no users, just add a field with the header and a note
            if (users.length === 0) {
                embed.addFields({ name: '\u200b', value: `${header}\n└ No responses yet` });
                continue;
            }

            // Generate the full list of user mentions (one per line)
            const userLines = users.map(id => `<@${id}>`);
            const fullList = userLines.join('\n');

            // Combine header and list
            let fieldContent = header + '\n' + fullList;

            // If total field content fits in one field (≤1024 chars), add it
            if (fieldContent.length <= 1024) {
                embed.addFields({ name: '\u200b', value: fieldContent });
            } else {
                // Need to split: first field contains header + first chunk of users
                const remainingChars = 1024 - header.length - 1; // -1 for newline
                // Find how many user lines we can fit in the first field
                let currentLines = [];
                let currentLength = 0;
                let linesUsed = 0;

                for (const line of userLines) {
                    const lineLength = line.length + 1; // +1 for newline
                    if (currentLength + lineLength <= remainingChars) {
                        currentLines.push(line);
                        currentLength += lineLength;
                        linesUsed++;
                    } else {
                        break;
                    }
                }

                // First field with header and first chunk
                const firstChunk = header + '\n' + currentLines.join('\n');
                embed.addFields({ name: '\u200b', value: firstChunk });

                // Remaining users
                let remainingUsers = userLines.slice(linesUsed);
                let part = 2;
                while (remainingUsers.length > 0) {
                    // Build continued header
                    const contHeader = `**${o.label} (continued)** – part ${part}`;
                    const contRemaining = remainingChars - contHeader.length - 1;
                    if (contRemaining <= 0) {
                        // This should not happen, but if header itself is too long, we'll truncate users
                        break;
                    }

                    // Take as many users as fit
                    let contLines = [];
                    let contLength = 0;
                    let taken = 0;
                    for (const line of remainingUsers) {
                        const lineLength = line.length + 1;
                        if (contLength + lineLength <= contRemaining) {
                            contLines.push(line);
                            contLength += lineLength;
                            taken++;
                        } else {
                            break;
                        }
                    }

                    const contChunk = contHeader + '\n' + contLines.join('\n');
                    embed.addFields({ name: '\u200b', value: contChunk });

                    remainingUsers = remainingUsers.slice(taken);
                    part++;
                }

                // If there are still users left (shouldn't happen if fields are properly sized), we could add a final truncated note
                if (remainingUsers.length > 0) {
                    embed.addFields({ 
                        name: '\u200b', 
                        value: `**${o.label}** (truncated) – and ${remainingUsers.length} more` 
                    });
                }
            }
        }

        // Add overall total field if applicable
        if (totalSum > 0 && question.suffix) {
            embed.addFields({ 
                name: 'Overall Total', 
                value: `**${totalSum}${question.suffix}**` 
            });
        }

        return embed;
    }

    static buildActionRows(questionId, options, disabled = false) {
        const rows = [];
        let currentRow = new ActionRowBuilder();
        options.sort((a, b) => a.position - b.position).forEach((opt) => {
            const btn = new ButtonBuilder()
                .setCustomId(`question_${questionId}_${opt.id}`)
                .setLabel(opt.label)
                .setStyle(ButtonStyle[opt.style.toUpperCase()] || ButtonStyle.Primary)
                .setDisabled(disabled);
            if (opt.emoji) {
                btn.setEmoji(opt.emoji);
            }
            currentRow.addComponents(btn);
            if (currentRow.components.length === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
        });
        if (currentRow.components.length > 0) rows.push(currentRow);
        return rows;
    }

    static async sendQuestion(channel, question, options) {
        const embed = this.buildEmbed(question, options);
        const rows = this.buildActionRows(question.id, options, question.status !== 'active');
        const message = await channel.send({ embeds: [embed], components: rows });
        db.setQuestionMessage(question.id, channel.id, message.id);
        db.setQuestionStatus(question.id, 'active');
        return message;
    }

    static async updateQuestionMessage(client, question) {
        if (!question.channel_id || !question.message_id) return;
        try {
            const channel = await client.channels.fetch(question.channel_id);
            const message = await channel.messages.fetch(question.message_id);
            const options = db.getQuestionOptions(question.id);
            const embed = this.buildEmbed(question, options);
            const rows = this.buildActionRows(question.id, options, question.status !== 'active');
            await message.edit({ embeds: [embed], components: rows });
        } catch (err) {
            console.error('Failed to update question message:', err);
        }
    }
}

module.exports = QuestionManager;
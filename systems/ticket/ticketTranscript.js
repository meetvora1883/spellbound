// systems/ticket/ticketTranscript.js
const { escapeHtml } = require('../../utils/helpers'); // you may need a simple escape function

class TicketTranscript {
    static async generateHTML(ticket, messages, guild) {
        const title = `Ticket #${ticket.ticket_number} - ${guild.name}`;
        let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; background: #2c2f33; color: #fff; }
        .message { padding: 10px; border-bottom: 1px solid #444; }
        .author { font-weight: bold; color: #7289da; }
        .timestamp { color: #99aab5; font-size: 0.8em; }
        .content { margin-top: 5px; white-space: pre-wrap; }
        .system { background: #23272a; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div>Opened: ${ticket.created_at}</div>
    <div>Owner: ${ticket.owner_id}</div>
    <hr>`;

        for (const msg of messages) {
            const author = msg.author?.tag || 'Unknown';
            const content = escapeHtml(msg.content || '');
            const timestamp = new Date(msg.createdTimestamp).toLocaleString();
            const systemClass = msg.author?.bot ? 'system' : '';
            html += `<div class="message ${systemClass}">
                <span class="author">${escapeHtml(author)}</span>
                <span class="timestamp">${escapeHtml(timestamp)}</span>
                <div class="content">${content.replace(/\n/g, '<br>')}</div>
            </div>`;
        }

        html += `</body></html>`;
        return html;
    }
}

module.exports = TicketTranscript;


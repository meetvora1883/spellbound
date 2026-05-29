// systems/warboard/warboardManager.js
const { BASES, TOTAL_CAPACITY } = require('../../config');
const db = require('../../database');
const { getRandomTemplate } = require('./dmTemplates');
const { logger } = require('../../utils/logger');
const { formatMight, formatDateDisplay } = require('../../utils/dateUtils');

class WarboardManager {
  /**
   * Build the FULL warboard message as a single string (for previews / small warboards)
   */
  static buildWarboardMessage(guildId, warDate, assignments = null) {
    const chunks = this.buildWarboardMessageChunks(guildId, warDate, assignments);
    return chunks.join('\n');
  }

  /**
   * Build warboard message, return array of chunks (max 1900 chars each)
   * Respects the 'mention' flag – if false, uses stored username instead of <@id>
   */
  static buildWarboardMessageChunks(guildId, warDate, assignments = null) {
    if (!assignments) {
      assignments = db.getAssignments(guildId, warDate);
    }
    
    const baseMap = new Map();
    BASES.forEach(base => baseMap.set(base.name, []));
    
    let totalMight = 0;
    assignments.forEach(ass => {
      if (baseMap.has(ass.base)) {
        baseMap.get(ass.base).push(ass);
        totalMight += parseFloat(ass.might || 0);
      }
    });
    
    const displayDate = formatDateDisplay(warDate);
    let fullMessage = `⚔️ WARBOARD - New Setup\n📅 ${displayDate}\n\n`;
    
    BASES.forEach(base => {
      const assigned = baseMap.get(base.name) || [];
      const count = assigned.length;
      const capacity = base.capacity;
      
      fullMessage += `**${base.name}** (${count}/${capacity})\n`;
      
      assigned.forEach(ass => {
        const formattedMight = formatMight(ass.might || '0');
        // If mention is 1, show mention; otherwise show stored username
        const playerDisplay = ass.mention ? `<@${ass.user_id}>` : (ass.username || `Unknown (${ass.user_id})`);
        fullMessage += `${playerDisplay} - ${formattedMight} Might\n`;
      });
      
      if (assigned.length === 0) {
        fullMessage += `*No players assigned*\n`;
      }
      fullMessage += '\n';
    });
    
    const totalPlayers = assignments.length;
    const formattedTotalMight = formatMight(totalMight.toFixed(3));
    fullMessage += `**TOTAL:** ${totalPlayers}/${TOTAL_CAPACITY} players - ${formattedTotalMight} might\n`;
    
    // Split into chunks
    const chunks = [];
    let currentChunk = '';
    const lines = fullMessage.split('\n');
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > 1900) {
        chunks.push(currentChunk);
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    
    return chunks;
  }
  
  /**
   * Send DMs in batches of 5 with individual success/fail logs
   */
  static async dmAllAssigned(client, guildId, warDate) {
    const assignments = db.getAssignments(guildId, warDate);
    const results = [];
    const BATCH_SIZE = 5;
    
    logger.info(`Starting bulk DM for ${assignments.length} players (${warDate})`);
    
    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const batch = assignments.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (ass) => {
          try {
            const user = await client.users.fetch(ass.user_id);
            const guild = await client.guilds.fetch(guildId);
            
            const templateFn = getRandomTemplate();
            const dmMessage = templateFn(user, guild.name, warDate, ass.base, ass.might);
            
            await user.send(dmMessage);
            
            logger.success(`✔ DM: ${user.tag.padEnd(20)} | Base: ${ass.base.padEnd(15)} | Might: ${ass.might}`);
            return { success: true, user: user.tag, userId: ass.user_id };
          } catch (error) {
            logger.error(`✖ DM: ${ass.user_id.padEnd(20)} | Error: ${error.message.slice(0, 50)}`);
            return { success: false, userId: ass.user_id, error: error.message };
          }
        })
      );
      
      results.push(...batchResults.map(r => r.value || r.reason));
      
      if (i + BATCH_SIZE < assignments.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    logger.success(`Bulk DM completed: ${successCount} sent, ${failCount} failed`);
    
    return results;
  }
}

module.exports = WarboardManager;
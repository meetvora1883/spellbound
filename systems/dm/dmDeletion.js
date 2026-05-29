// systems/dm/dmDeletion.js
const db = require('../../database');
const { logger } = require('../../utils/logger');

class DMDeletionSystem {
  constructor(client) {
    this.client = client;
    this.timeouts = new Map(); // messageId -> setTimeout
    this.initialized = false;
    this.CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Initialize the system: reschedule all pending jobs.
   */
  async initialize() {
    if (this.initialized) return;
    logger.info('[DM-Deletion] Initializing...');

    const jobs = db.getAllDMDeletionJobs();
    logger.info(`[DM-Deletion] Rescheduling ${jobs.length} pending deletions`);

    for (const job of jobs) {
      const now = Date.now();
      if (job.delete_at <= now) {
        // Overdue – execute now
        await this._deleteMessage(job.user_id, job.message_id);
      } else {
        // Schedule for future
        this._schedule(job.user_id, job.message_id, job.delete_at - now);
      }
    }

    // Start periodic cleanup
    this._startCleanupInterval();
    this.initialized = true;
    logger.success('[DM-Deletion] System ready');
  }

  /**
   * Schedule a DM for auto‑deletion.
   */
  scheduleDeletion(userId, messageId, sentAt = Date.now()) {
    const deleteAt = sentAt + 24 * 60 * 60 * 1000; // 24 hours
    const delay = deleteAt - Date.now();

    // Save to database
    db.addDMDeletionJob(userId, messageId, deleteAt);
    logger.debug(`[DM-Deletion] Scheduled ${messageId} for ${new Date(deleteAt).toISOString()}`);

    // Schedule timeout
    this._schedule(userId, messageId, delay);
  }

  /**
   * Internal: schedule a single deletion.
   */
  _schedule(userId, messageId, delay) {
    // Cancel any existing timeout for this message
    this._cancel(messageId);

    const timeout = setTimeout(async () => {
      await this._deleteMessage(userId, messageId);
    }, Math.max(0, delay));

    this.timeouts.set(messageId, timeout);
  }

  /**
   * Cancel a scheduled deletion.
   */
  cancelDeletion(messageId) {
    this._cancel(messageId);
    db.removeDMDeletionJob(messageId);
  }

  _cancel(messageId) {
    if (this.timeouts.has(messageId)) {
      clearTimeout(this.timeouts.get(messageId));
      this.timeouts.delete(messageId);
    }
  }

  /**
   * Delete the actual message.
   */
  async _deleteMessage(userId, messageId) {
    try {
      const user = await this.client.users.fetch(userId);
      const dmChannel = user.dmChannel || await user.createDM();
      const message = await dmChannel.messages.fetch(messageId);

      if (message.author.id === this.client.user.id) {
        await message.delete();
        logger.success(`[DM-Deletion] Deleted message ${messageId} from ${user.tag}`);
      }

      // Remove from DB
      db.removeDMDeletionJob(messageId);
      this.timeouts.delete(messageId);
    } catch (error) {
      // Message already deleted / user closed DMs – just clean up DB
      if (error.code === 10008 || error.code === 50007) {
        logger.debug(`[DM-Deletion] Message ${messageId} already gone, cleaning up`);
      } else {
        logger.error(`[DM-Deletion] Failed to delete ${messageId}: ${error.message}`);
      }
      db.removeDMDeletionJob(messageId);
      this.timeouts.delete(messageId);
    }
  }

  /**
   * Periodic cleanup of overdue jobs (in case bot was down).
   */
  _startCleanupInterval() {
    setInterval(async () => {
      const expired = db.getExpiredDMDeletionJobs();
      for (const job of expired) {
        await this._deleteMessage(job.user_id, job.message_id);
      }
    }, this.CHECK_INTERVAL);
  }

  /**
   * Shutdown – cancel all pending timeouts.
   */
  shutdown() {
    for (const [messageId, timeout] of this.timeouts) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
    logger.info('[DM-Deletion] Shutdown complete');
  }
}

module.exports = DMDeletionSystem;
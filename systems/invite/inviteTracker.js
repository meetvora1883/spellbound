// systems/invite/inviteTracker.js
const { logger } = require('../../utils/logger');
const db = require('../../database');

class InviteTracker {
  constructor(client) {
    this.client = client;
    this.inviteCache = new Map(); // guildId -> Map(code -> inviteData)
  }

  async initialize() {
    for (const guild of this.client.guilds.cache.values()) {
      if (db.isInviteTrackingEnabled(guild.id)) {
        await this.cacheGuildInvites(guild);
      }
    }
    logger.success('Invite tracker initialized');
  }

  async cacheGuildInvites(guild) {
    try {
      const invites = await guild.invites.fetch();
      const inviteMap = new Map();
      invites.forEach(invite => {
        inviteMap.set(invite.code, {
          uses: invite.uses,
          inviterId: invite.inviter?.id,
          maxUses: invite.maxUses,
          temporary: invite.temporary,
          createdAt: invite.createdTimestamp
        });
      });
      this.inviteCache.set(guild.id, inviteMap);
    } catch (error) {
      logger.error(`Failed to cache invites for guild ${guild.id}:`, error);
    }
  }

  async handleGuildMemberAdd(member) {
    if (!db.isInviteTrackingEnabled(member.guild.id)) return;

    try {
      const cachedInvites = this.inviteCache.get(member.guild.id);
      if (!cachedInvites) {
        await this.cacheGuildInvites(member.guild);
        return;
      }

      const currentInvites = await member.guild.invites.fetch();
      let usedInvite = null;

      for (const [code, invite] of currentInvites) {
        const cached = cachedInvites.get(code);
        if (cached && invite.uses > cached.uses) {
          usedInvite = invite;
          break;
        } else if (!cached && invite.uses > 0) {
          // New invite with uses > 0 (could be vanity or created while bot offline)
          usedInvite = invite;
          break;
        }
      }

      if (usedInvite && usedInvite.inviter) {
        const inviterId = usedInvite.inviter.id;
        const isFake = member.user.bot ? 1 : 0;

        db.addInviteRecord(member.guild.id, inviterId, member.id, usedInvite.code, Date.now());
        if (isFake) db.markInviteeFake(member.guild.id, member.id);

        // Update cache
        const updatedMap = this.inviteCache.get(member.guild.id) || new Map();
        updatedMap.set(usedInvite.code, {
          uses: usedInvite.uses,
          inviterId: usedInvite.inviter.id,
          maxUses: usedInvite.maxUses,
          temporary: usedInvite.temporary,
          createdAt: usedInvite.createdTimestamp
        });
        this.inviteCache.set(member.guild.id, updatedMap);
      }
    } catch (error) {
      logger.error('Error in handleGuildMemberAdd invite tracking:', error);
    }
  }

  async handleGuildMemberRemove(member) {
    if (!db.isInviteTrackingEnabled(member.guild.id)) return;
    db.markInviteeLeft(member.guild.id, member.id);
  }

  async handleInviteCreate(invite) {
    if (!db.isInviteTrackingEnabled(invite.guild.id)) return;
    const guildInvites = this.inviteCache.get(invite.guild.id) || new Map();
    guildInvites.set(invite.code, {
      uses: invite.uses,
      inviterId: invite.inviter?.id,
      maxUses: invite.maxUses,
      temporary: invite.temporary,
      createdAt: invite.createdTimestamp
    });
    this.inviteCache.set(invite.guild.id, guildInvites);
  }

  async handleInviteDelete(invite) {
    if (!db.isInviteTrackingEnabled(invite.guild?.id)) return;
    const guildInvites = this.inviteCache.get(invite.guild.id);
    if (guildInvites) {
      guildInvites.delete(invite.code);
      this.inviteCache.set(invite.guild.id, guildInvites);
    }
  }
}

module.exports = InviteTracker;
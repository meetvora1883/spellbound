const ownerIds = (process.env.OWNER_IDS || '').split(',').map(id => id.trim());
const guideOwnerIds = (process.env.GUIDE_OWNER_IDS || '').split(',').map(id => id.trim());

function isOwner(userId) {
  return ownerIds.includes(userId);
}

function isGuideOwner(userId) {
  return guideOwnerIds.includes(userId);
}

module.exports = { isOwner, isGuideOwner, ownerIds, guideOwnerIds };
// server/sessionStore.js
// Simple in-memory session store (for development; use Redis in production)
const sessions = new Map();

function createSession(userId, data, io) {
  const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  sessions.set(sessionId, { userId, data, createdAt: Date.now() });
  if (io) {
    setTimeout(() => {
      if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        io.emit('webUserOffline', { sessionId, userId });
      }
    }, 7 * 24 * 60 * 60 * 1000);
  } else {
    setTimeout(() => sessions.delete(sessionId), 7 * 24 * 60 * 60 * 1000);
  }
  return sessionId;
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function deleteSession(sessionId) {
  sessions.delete(sessionId);
}


function deleteSessionsForDiscordId(userId) {
  for (const [sessionId, session] of sessions) {
    if (session.userId === userId) {
      sessions.delete(sessionId);
    }
  }
}

function getAllSessions() {
  const result = [];
  for (const [sessionId, session] of sessions) {
    result.push({
      sessionId,
      userId: session.userId,
      data: session.data,
      createdAt: session.createdAt
    });
  }
  return result;
}

module.exports = { createSession, getSession, deleteSession, deleteSessionsForDiscordId, getAllSessions };
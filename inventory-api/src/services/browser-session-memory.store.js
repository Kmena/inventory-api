function now() {
  return Date.now();
}

class BrowserSessionMemoryStore {
  constructor() {
    this.sessionsById = new Map();
    this.sessionIdsByUserId = new Map();
  }

  addSessionToUserIndex(sessionId, userId) {
    const normalizedUserId = String(userId);
    const sessionIds = this.sessionIdsByUserId.get(normalizedUserId) || new Set();
    sessionIds.add(sessionId);
    this.sessionIdsByUserId.set(normalizedUserId, sessionIds);
  }

  removeSessionFromUserIndex(sessionId, userId) {
    const normalizedUserId = String(userId);
    const sessionIds = this.sessionIdsByUserId.get(normalizedUserId);
    if (!sessionIds) {
      return;
    }

    sessionIds.delete(sessionId);
    if (sessionIds.size === 0) {
      this.sessionIdsByUserId.delete(normalizedUserId);
    }
  }

  removeExpiredSessions() {
    const currentTime = now();
    for (const [sessionId, session] of this.sessionsById.entries()) {
      if (session.expiresAt <= currentTime) {
        this.sessionsById.delete(sessionId);
        this.removeSessionFromUserIndex(sessionId, session.userId);
      }
    }
  }

  async create(session) {
    this.removeExpiredSessions();
    this.sessionsById.set(session.sessionId, {
      userId: session.userId,
      expiresAt: session.expiresAt,
    });
    this.addSessionToUserIndex(session.sessionId, session.userId);
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      expiresAt: session.expiresAt,
    };
  }

  async get(sessionId) {
    if (!sessionId) {
      return null;
    }

    this.removeExpiredSessions();
    const session = this.sessionsById.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.expiresAt <= now()) {
      this.sessionsById.delete(sessionId);
      this.removeSessionFromUserIndex(sessionId, session.userId);
      return null;
    }

    return {
      sessionId,
      userId: session.userId,
      expiresAt: session.expiresAt,
    };
  }

  async invalidate(sessionId) {
    if (!sessionId) {
      return false;
    }

    const session = this.sessionsById.get(sessionId);
    if (!session) {
      return false;
    }

    this.sessionsById.delete(sessionId);
    this.removeSessionFromUserIndex(sessionId, session.userId);
    return true;
  }

  async invalidateSessionsForUser(userId) {
    if (!userId) {
      return 0;
    }

    this.removeExpiredSessions();
    const normalizedUserId = String(userId);
    const sessionIds = this.sessionIdsByUserId.get(normalizedUserId);
    if (!sessionIds || sessionIds.size === 0) {
      return 0;
    }

    let invalidatedCount = 0;
    for (const sessionId of sessionIds) {
      if (this.sessionsById.delete(sessionId)) {
        invalidatedCount += 1;
      }
    }
    this.sessionIdsByUserId.delete(normalizedUserId);
    return invalidatedCount;
  }

  async invalidateSessionsForUsers(userIds) {
    const normalizedUserIds = [...new Set((Array.isArray(userIds) ? userIds : [])
      .filter((userId) => userId !== null && userId !== undefined && String(userId).trim() !== '')
      .map((userId) => String(userId)))];

    let invalidatedCount = 0;
    for (const userId of normalizedUserIds) {
      invalidatedCount += await this.invalidateSessionsForUser(userId);
    }

    return invalidatedCount;
  }

  async checkReadiness() {
    this.removeExpiredSessions();
    return {
      mode: 'memory',
      status: 'memory',
    };
  }

  async resetForTests() {
    this.sessionsById.clear();
    this.sessionIdsByUserId.clear();
  }
}

module.exports = {
  BrowserSessionMemoryStore,
};

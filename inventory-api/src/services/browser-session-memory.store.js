function now() {
  return Date.now();
}

class BrowserSessionMemoryStore {
  constructor() {
    this.sessionsById = new Map();
  }

  removeExpiredSessions() {
    const currentTime = now();
    for (const [sessionId, session] of this.sessionsById.entries()) {
      if (session.expiresAt <= currentTime) {
        this.sessionsById.delete(sessionId);
      }
    }
  }

  async create(session) {
    this.removeExpiredSessions();
    this.sessionsById.set(session.sessionId, {
      userId: session.userId,
      expiresAt: session.expiresAt,
    });
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

    return this.sessionsById.delete(sessionId);
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
  }
}

module.exports = {
  BrowserSessionMemoryStore,
};

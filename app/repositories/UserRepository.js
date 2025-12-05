/**
 * PATRÓN: Repository Pattern
 * SOLID: Dependency Inversion Principle (DIP) & SRP
 * POR QUÉ: Abstrae la lógica de base de datos (Firestore). Si mañana se cambia a MongoDB o SQL, solo se modifica este archivo, no los controladores.
 */
export class UserRepository {
  constructor(db) {
    this.db = db;
  }

  async findUserByFirebaseUid(uid) {
    const doc = await this.db.collection('users').doc(uid).get();
    return doc.exists ? doc.data() : null;
  }

  async findFirebaseUidByTelegramId(telegramId) {
    const doc = await this.db.collection('telegramUserMapping').doc(telegramId).get();
    return doc.exists ? doc.data().firebaseUid : null;
  }

  async createTelegramMapping(telegramId, firebaseUid) {
    await this.db.collection('telegramUserMapping').doc(telegramId).set({
      firebaseUid,
      telegramUserId: telegramId,
      createdAt: new Date()
    });
  }

  async saveTokens(firebaseUid, tokens) {
    await this.db.collection('users').doc(firebaseUid).set({
      googleCalendarRefreshToken: tokens.refresh_token,
      googleCalendarAccessToken: tokens.access_token,
      googleCalendarExpiryDate: new Date(tokens.expiry_date),
      updatedAt: new Date()
    }, { merge: true });
  }
}
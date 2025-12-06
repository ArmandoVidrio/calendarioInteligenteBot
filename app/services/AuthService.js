/**
 * PATRÓN: Service Layer
 * SOLID: Open/Closed Principle
 * POR QUÉ: Orquesta el flujo: Verifica si el usuario existe -> Lo crea si no -> Genera URL.
 */
export class AuthService {
  constructor(userRepository, googleAuthAdapter) {
    this.userRepo = userRepository;
    this.googleAuth = googleAuthAdapter;
  }

  async initiateAuthFlow(telegramUserId) {
    let firebaseUid;

    const mapping = await this.userRepo.findMappingByTelegramId(telegramUserId);

    if (mapping) {
      firebaseUid = mapping.firebaseUid;
    } else {
      const newUser = await this.userRepo.createFirebaseUser(telegramUserId);
      firebaseUid = newUser.uid;
      await this.userRepo.createTelegramMapping(telegramUserId, firebaseUid);
    }

    const loginUrl = this.googleAuth.generateAuthUrl(firebaseUid);

    return { loginUrl, firebaseUid };
  }

  async handleCallback(code, firebaseUid) {
    // Intercambiar código por tokens
    const tokens = await this.googleAuth.exchangeCodeForTokens(code);

    await this.userRepo.saveTokens(firebaseUid, tokens);

    return true;
  }
}
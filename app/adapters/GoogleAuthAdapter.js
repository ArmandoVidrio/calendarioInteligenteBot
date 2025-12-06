/**
 * PATRÓN: Adapter
 * SOLID: Single Responsibility Principle (SRP)
 * POR QUÉ: Encapsula la complejidad de la librería OAuth2 de Google.
 * Si Google cambia cómo genera URLs o intercambia tokens, solo se cambia este archivo
 */
export class GoogleAuthAdapter {
  constructor(oauth2Client, scopes) {
    this.client = oauth2Client;
    this.scopes = scopes;
  }

  generateAuthUrl(firebaseUid) {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      prompt: 'consent',
      state: firebaseUid
    });
  }

  async exchangeCodeForTokens(code) {
    const { tokens } = await this.client.getToken(code);
    return tokens;
  }
}
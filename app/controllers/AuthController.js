/**
 * PATRÓN: Controller
 * SOLID: SRP
 * POR QUÉ: Recibe la petición web, extrae parámetros, llama al servicio y devuelve JSON o HTML.
 */
export class AuthController {
  constructor(authService) {
    this.service = authService;
  }

  initiate = async (req, res) => {
    const { telegramUserId } = req.query;
    if (!telegramUserId) return res.status(400).send('Falta telegramUserId.');

    try {
      const result = await this.service.initiateAuthFlow(telegramUserId);
      res.json({ login_url: result.loginUrl, firebaseUid: result.firebaseUid });
    } catch (error) {
      console.error('Auth Init Error:', error);
      res.status(500).send('Error al iniciar autenticación.');
    }
  }

  callback = async (req, res) => {
    const { code, state: firebaseUid } = req.query;
    if (!code || !firebaseUid) return res.status(400).send('Faltan datos (code/state).');

    try {
      await this.service.handleCallback(code, firebaseUid);
      // Respuesta HTML simple para el navegador del usuario
      res.status(200).send(`
        <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
          <h1 style="color: green;">¡Conectado exitosamente!</h1>
          <p>Ya puedes cerrar esta ventana y volver a Telegram.</p>
        </div>
      `);
    } catch (error) {
      console.error('Callback Error:', error);
      res.status(500).send('Error en la autenticación con Google.');
    }
  }
}
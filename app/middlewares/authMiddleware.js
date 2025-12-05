/**
 * SOLID: SRP
 * POR QUÉ: Centraliza la lógica de protección de rutas. Si cambia la forma
 * de autenticar (ej. a JWT) solo se mofica este archivo.
 */
const N8N_API_KEY = process.env.N8N_API_KEY;

export const authenticateN8n = (req, res, next) => {
  if (!N8N_API_KEY) {
    console.warn('ADVERTENCIA: API KEY no configurada.');
    return next();
  }
  const providedApiKey = req.headers['x-api-key'];
  if (!providedApiKey || providedApiKey !== N8N_API_KEY) {
    return res.status(401).send('Unauthorized: Invalid API Key');
  }
  next();
};
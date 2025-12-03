// server.js

import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import admin from 'firebase-admin';
import { google } from 'googleapis'; // Para interactuar con la API de Google Calendar
import cors from 'cors'; // Importa cors para manejar peticiones desde otros orígenes

// --- Inicialización de Firebase Admin SDK ---
// Firebase App Hosting ya inicializa el SDK con las credenciales del proyecto
// automáticamente. Si corres esto localmente, necesitarías un service account key.
admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(express.json());
app.use(cors());

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// --- Configuración de OAuth2Client ---
const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Scopes necesarios para Google Calendar. ¡Revisa qué permisos necesitas!
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events', // Crear, editar, eliminar eventos
  'https://www.googleapis.com/auth/calendar'        // Acceso a ver y editar calendarios
];

// --- Endpoint para iniciar el flujo de autenticación (equivalente a tu /auth/login) ---
app.get('/auth/initiate-google-calendar-auth', async (req, res) => {
  // n8n o tu cliente debería enviar un identificador único para el usuario,
  // por ejemplo, el ID de Telegram del usuario.
  const telegramUserId = req.query.telegramUserId;

  if (!telegramUserId) {
    return res.status(400).send('Missing telegramUserId parameter.');
  }

  try {
    let firebaseUid;
    // 1. Verificar si ya existe un usuario de Firebase asociado a este telegramUserId
    const userMappingDoc = await db.collection('telegramUserMapping').doc(telegramUserId).get();

    if (userMappingDoc.exists) {
      firebaseUid = userMappingDoc.data().firebaseUid;
      console.log(`Existing Firebase UID ${firebaseUid} for Telegram user ${telegramUserId}`);
    } else {
      // 2. Si no existe, crear un nuevo usuario de Firebase
      // Puedes crear un UID personalizado o dejar que Firebase lo genere.
      // Aquí, usaremos un UID basado en el telegramUserId para facilitar el mapeo.
      const newFirebaseUser = await admin.auth().createUser({
        uid: `telegram-${telegramUserId}`,
        displayName: `Telegram User ${telegramUserId}`,
      });
      firebaseUid = newFirebaseUser.uid;
      console.log(`Created new Firebase UID ${firebaseUid} for Telegram user ${telegramUserId}`);

      // Guardar el mapeo en Firestore
      await db.collection('telegramUserMapping').doc(telegramUserId).set({
        firebaseUid: firebaseUid,
        telegramUserId: telegramUserId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // 3. Generar la URL de autorización de Google OAuth
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',           // MUY IMPORTANTE: para obtener el refresh_token
      scope: CALENDAR_SCOPES,
      prompt: 'consent',                // Siempre pide consentimiento, útil para cambiar scopes
      state: firebaseUid                // Pasar el firebaseUid a la callback
    });

    console.log(`Generated Google OAuth URL for Firebase UID ${firebaseUid}: ${authUrl}`);
    res.json({ login_url: authUrl, firebaseUid: firebaseUid });

  } catch (error) {
    console.error('Error initiating Google Calendar auth:', error);
    res.status(500).send('Failed to initiate Google Calendar authentication. Error: ' + error.message + 
    ' Stack: ' + error.stack
    );
  }
});


// --- Ruta de callback de Google (donde Google redirige al usuario) ---
app.get('/auth/google-calendar-callback', async (req, res) => {
  try {
    const { code, state: firebaseUid } = req.query; // 'state' contendrá nuestro firebaseUid

    if (!code || !firebaseUid) {
      return res.status(400).send('Missing authorization code or Firebase UID.');
    }

    // Intercambiar el código de autorización por tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Guardar el refresh_token en Firestore asociado al firebaseUid
    // Es crucial guardar el refresh_token, ya que el access_token expira rápidamente.
    await db.collection('users').doc(firebaseUid).set({
      googleCalendarRefreshToken: tokens.refresh_token,
      googleCalendarAccessToken: tokens.access_token, // Opcional, solo para uso inmediato
      googleCalendarExpiryDate: new Date(tokens.expiry_date), // Opcional
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }); // Usar merge para no sobrescribir otros datos del usuario

    // Puedes enviar un mensaje de éxito al usuario en el navegador
    res.status(200).send('<h1>Google Calendar access granted!</h1><p>You can now close this tab.</p>');

    // Opcional: Enviar una notificación a n8n para indicar que el usuario ha autorizado
    // Puedes implementar un webhook o alguna otra forma de comunicación aquí.

  } catch (error) {
    console.error('Error during Google Calendar callback:', error);
    res.status(500).send('Authentication failed during callback.');
  }
});


// --- Endpoint para que n8n cree eventos en el calendario ---
app.post('/api/create-calendar-event', async (req, res) => {
  const { firebaseUid, eventDetails } = req.body;

  if (!firebaseUid || !eventDetails) {
    return res.status(400).send('Missing firebaseUid or eventDetails in request body.');
  }

  try {
    // 1. Obtener el refresh_token del usuario de Firestore
    const userDoc = await db.collection('users').doc(firebaseUid).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;

    if (!refreshToken) {
      return res.status(404).send('User has not authorized Google Calendar or refresh token is missing.');
    }

    // 2. Configurar el cliente OAuth con el refresh_token
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // La librería 'google-auth-library' automáticamente usará el refresh_token
    // para obtener un nuevo access_token si el actual ha expirado.
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 3. Insertar el evento en el calendario del usuario
    const response = await calendar.events.insert({
      calendarId: 'primary', // 'primary' se refiere al calendario principal del usuario
      resource: eventDetails, // Los detalles del evento (ej. { summary: 'Reunión', start: {...}, end: {...} })
    });

    console.log(`Event created for Firebase UID ${firebaseUid}:`, response.data.htmlLink);
    res.status(200).json({
      message: 'Event created successfully!',
      eventLink: response.data.htmlLink,
      eventId: response.data.id
    });

  } catch (error) {
    console.error('Error creating calendar event:', error);
    // Errores comunes: invalid_grant (refresh token revocado/expirado), permisos insuficientes
    res.status(500).send(`Failed to create event: ${error.message}`);
  }
});

// --- Iniciar el servidor ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

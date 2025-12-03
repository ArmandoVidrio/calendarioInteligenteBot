// server.js

import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import admin from 'firebase-admin';
import { google } from 'googleapis';
import cors from 'cors';

// --- Inicialización de Firebase Admin SDK ---
admin.initializeApp();
const db = admin.firestore(); // Para almacenar los refresh_tokens

const app = express();
app.use(express.json());
app.use(cors()); // Habilita CORS si n8n u otro cliente va a hacer peticiones directas

// --- Variables de Entorno y Configuración OAuth ---
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

// --- Middleware para autenticación con API Key (RECOMENDADO para N8N) ---
// Define esta variable de entorno en tu apphosting.yaml y Secret Manager
const N8N_API_KEY = process.env.N8N_API_KEY;

const authenticateN8n = (req, res, next) => {
  if (!N8N_API_KEY) {
    console.warn('ADVERTENCIA DE SEGURIDAD: N8N_API_KEY no está configurada. Los endpoints de API están desprotegidos.');
    return next(); // Si no hay API Key configurada, permite continuar (solo para desarrollo/pruebas)
  }

  const providedApiKey = req.headers['x-api-key']; // N8N debe enviar la API Key en este header

  if (!providedApiKey || providedApiKey !== N8N_API_KEY) {
    console.warn(`Intento de acceso no autorizado con API Key: ${providedApiKey}`);
    return res.status(401).send('Unauthorized: Invalid API Key');
  }
  next(); // La API Key es válida, continúa con la ruta
};


// --- Endpoint para iniciar el flujo de autenticación ---
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
    res.status(500).send('Failed to initiate Google Calendar authentication.');
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


// 1. Endpoint para crear eventos en el calendario
app.post('/api/create-calendar-event', authenticateN8n, async (req, res) => {
  const { firebaseUid, eventDetails } = req.body;

  if (!firebaseUid || !eventDetails) {
    return res.status(400).send('Missing firebaseUid or eventDetails in request body.');
  }

  try {
    const userDoc = await db.collection('users').doc(firebaseUid).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;

    if (!refreshToken) {
      return res.status(404).send('User has not authorized Google Calendar or refresh token is missing.');
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventDetails,
    });

    console.log(`Event created for Firebase UID ${firebaseUid}:`, response.data.htmlLink);
    res.status(200).json({
      message: 'Event created successfully!',
      eventLink: response.data.htmlLink,
      eventId: response.data.id
    });

  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).send(`Failed to create event: ${error.message}`);
  }
});

// 2. Endpoint para modificar un evento existente en el calendario
app.put('/api/update-calendar-event', authenticateN8n, async (req, res) => {
  const { firebaseUid, eventId, eventDetails } = req.body;

  if (!firebaseUid || !eventId || !eventDetails) {
    return res.status(400).send('Missing firebaseUid, eventId, or eventDetails.');
  }

  try {
    const userDoc = await db.collection('users').doc(firebaseUid).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;

    if (!refreshToken) {
      return res.status(404).send('User has not authorized Google Calendar or refresh token is missing.');
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,             // El ID del evento a actualizar
      resource: eventDetails,       // El objeto de evento con los campos actualizados (parcial o completo)
    });

    console.log(`Event updated for Firebase UID ${firebaseUid}, Event ID ${eventId}:`, response.data.htmlLink);
    res.status(200).json({
      message: 'Event updated successfully!',
      eventLink: response.data.htmlLink,
      eventId: response.data.id
    });

  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).send(`Failed to update event: ${error.message}`);
  }
});

// 3. Endpoint para eliminar un evento del calendario
app.delete('/api/delete-calendar-event', authenticateN8n, async (req, res) => {
  const { firebaseUid, eventId } = req.body; // Para DELETE, se suele usar path params o query params, pero body también funciona con JSON

  if (!firebaseUid || !eventId) {
    return res.status(400).send('Missing firebaseUid or eventId.');
  }

  try {
    const userDoc = await db.collection('users').doc(firebaseUid).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;

    if (!refreshToken) {
      return res.status(404).send('User has not authorized Google Calendar or refresh token is missing.');
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId, // El ID del evento a eliminar
    });

    console.log(`Event deleted for Firebase UID ${firebaseUid}, Event ID ${eventId}`);
    res.status(200).json({
      message: 'Event deleted successfully!',
      eventId: eventId
    });

  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).send(`Failed to delete event: ${error.message}`);
  }
});


// 4. Endpoint para verificar si hay un evento a una hora específica
app.post('/api/check-event-at-time', authenticateN8n, async (req, res) => {
  const { firebaseUid, queryTime, durationMinutes } = req.body; // queryTime en formato ISO (ej. "2025-12-05T09:00:00-08:00")

  if (!firebaseUid || !queryTime) {
    return res.status(400).send('Missing firebaseUid or queryTime.');
  }

  try {
    const userDoc = await db.collection('users').doc(firebaseUid).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;

    if (!refreshToken) {
      return res.status(404).send('User has not authorized Google Calendar or refresh token is missing.');
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Calcular timeMin y timeMax para la consulta
    const startDateTime = new Date(queryTime);
    if (isNaN(startDateTime.getTime())) {
      return res.status(400).send('Invalid queryTime format. Must be a valid ISO 8601 date string.');
    }

    const endDateTime = new Date(startDateTime);
    // Si durationMinutes se proporciona, se verifica si hay eventos dentro de esa ventana.
    // De lo contrario, se verifica si hay eventos que se superponen con una pequeña ventana de 1 minuto
    // para encontrar cualquier actividad en el punto queryTime.
    const effectiveDurationMinutes = durationMinutes && typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 1;
    endDateTime.setMinutes(endDateTime.getMinutes() + effectiveDurationMinutes);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDateTime.toISOString(),
      timeMax: endDateTime.toISOString(),
      singleEvents: true, // Expande eventos recurrentes en instancias individuales
      orderBy: 'startTime',
      maxResults: 1 // Solo necesitamos saber si al menos uno existe
    });

    const events = response.data.items;

    if (events && events.length > 0) {
      console.log(`Event found at/around ${queryTime} for Firebase UID ${firebaseUid}.`);
      res.status(200).json({
        exists: true,
        message: 'An event exists at/around the specified time.',
        foundEvent: events[0] // Retorna el primer evento encontrado
      });
    } else {
      console.log(`No event found at/around ${queryTime} for Firebase UID ${firebaseUid}.`);
      res.status(200).json({
        exists: false,
        message: 'No event found at/around the specified time.'
      });
    }

  } catch (error) {
    console.error('Error checking event at time:', error);
    res.status(500).send(`Failed to check event: ${error.message}`);
  }
});

// --- Iniciar el servidor ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

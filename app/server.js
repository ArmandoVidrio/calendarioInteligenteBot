// server.js

import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import admin from 'firebase-admin';
import { google } from 'googleapis';
import cors from 'cors';

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(express.json());
app.use(cors());

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const N8N_API_KEY = process.env.N8N_API_KEY;

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events', // Crear, editar, eliminar eventos
  'https://www.googleapis.com/auth/calendar'        // Acceso a ver y editar calendarios
];

const authenticateN8n = (req, res, next) => {
  if (!N8N_API_KEY) {
    console.warn('ADVERTENCIA DE SEGURIDAD: N8N_API_KEY no está configurada. Los endpoints de API están desprotegidos.');
    return next();
  }

  const providedApiKey = req.headers['x-api-key'];

  if (!providedApiKey || providedApiKey !== N8N_API_KEY) {
    console.warn(`Intento de acceso no autorizado con API Key: ${providedApiKey}`);
    return res.status(401).send('Unauthorized: Invalid API Key');
  }
  next();
};

// --- RUTAS AUTENTICACION ---
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
        uid: telegramUserId,
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


// --- RUTAS DE CALENDARIO ---
app.get('/auth/google-calendar-callback', async (req, res) => {
  try {
    const { code, state: firebaseUid } = req.query;

    if (!code || !firebaseUid) {
      return res.status(400).send('Missing authorization code or Firebase UID.');
    }

    const { tokens } = await oauth2Client.getToken(code);

    // Guardar el refresh_token en Firestore asociado al firebaseUid
    await db.collection('users').doc(firebaseUid).set({
      googleCalendarRefreshToken: tokens.refresh_token,
      googleCalendarAccessToken: tokens.access_token,
      googleCalendarExpiryDate: new Date(tokens.expiry_date),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.status(200).send('<h1>Google Calendar access granted!</h1><p>You can now close this tab.</p>');

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

// 4. Endpoint para listar eventos en un rango de tiempo específico
app.get('/api/list-events-by-time', authenticateN8n, async (req, res) => {
  const { firebaseUid, timeMin, timeMax } = req.query;

  if (!firebaseUid || !timeMin || !timeMax) {
    return res.status(400).send('Missing firebaseUid, timeMin, or timeMax query parameters.');
  }

  try {
    const userDoc = await db.collection('users').doc(firebaseUid).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;

    if (!refreshToken) {
      return res.status(404).send('User has not authorized Google Calendar or refresh token is missing.');
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const startDateTime = new Date(timeMin);
    const endDateTime = new Date(timeMax);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return res.status(400).send('Invalid timeMin or timeMax format. Must be valid ISO 8601 date strings.');
    }
    if (startDateTime >= endDateTime) {
      return res.status(400).send('timeMin must be before timeMax.');
    }

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDateTime.toISOString(),
      timeMax: endDateTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;

    console.log(`Found ${events ? events.length : 0} events for Firebase UID ${firebaseUid} between ${timeMin} and ${timeMax}.`);
    res.status(200).json({
      message: 'Events retrieved successfully!',
      events: events || []
    });

  } catch (error) {
    console.error('Error listing events by time:', error);
    res.status(500).send(`Failed to list events: ${error.message}`);
  }
});

// 5. NUEVO Endpoint para verificar la existencia de un usuario
app.get('/api/user-exists', authenticateN8n, async (req, res) => {
  const { firebaseUid } = req.query;

  if (!firebaseUid) {
    return res.status(400).json({ message: 'Missing firebaseUid query parameter.' });
  }

  try {
    const userDoc = await db.collection('users').doc(firebaseUid).get();

    // Verificamos si el documento existe Y si tiene un refresh_token (lo que indica autorización)
    const existsAndAuthorized = userDoc.exists && userDoc.data()?.googleCalendarRefreshToken !== undefined;

    res.status(200).json({
      firebaseUid: firebaseUid,
      exists: existsAndAuthorized,
      message: existsAndAuthorized ? 'User found' : 'User not found'
    });

  } catch (error) {
    console.error('Error checking user existence:', error);
    res.status(500).json({ message: `Failed to check user existence: ${error.message}` });
  }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

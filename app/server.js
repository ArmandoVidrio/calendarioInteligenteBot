import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import admin from 'firebase-admin';
import { google } from 'googleapis';
import cors from 'cors';

// --- CONFIGURACIÓN INICIAL ---
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
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar'
];

// --- MIDDLEWARE DE SEGURIDAD ---
const authenticateN8n = (req, res, next) => {
  if (!N8N_API_KEY) {
    console.warn('ADVERTENCIA: N8N_API_KEY no configurada.');
    return next();
  }
  const providedApiKey = req.headers['x-api-key'];
  if (!providedApiKey || providedApiKey !== N8N_API_KEY) {
    console.warn(`Acceso no autorizado: ${providedApiKey}`);
    return res.status(401).send('Unauthorized: Invalid API Key');
  }
  next();
};

// --- RUTAS DE AUTENTICACIÓN (OAUTH) ---
app.get('/auth/initiate-google-calendar-auth', async (req, res) => {
  const telegramUserId = req.query.telegramUserId;
  if (!telegramUserId) return res.status(400).send('Missing telegramUserId.');

  try {
    let firebaseUid;
    const userMappingDoc = await db.collection('telegramUserMapping').doc(telegramUserId).get();

    if (userMappingDoc.exists) {
      firebaseUid = userMappingDoc.data().firebaseUid;
    } else {
      const newFirebaseUser = await admin.auth().createUser({
        uid: telegramUserId,
        displayName: `Telegram User ${telegramUserId}`,
      });
      firebaseUid = newFirebaseUser.uid;
      await db.collection('telegramUserMapping').doc(telegramUserId).set({
        firebaseUid: firebaseUid,
        telegramUserId: telegramUserId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: CALENDAR_SCOPES,
      prompt: 'consent',
      state: firebaseUid
    });

    res.json({ login_url: authUrl, firebaseUid: firebaseUid });
  } catch (error) {
    console.error('Auth Init Error:', error);
    res.status(500).send('Failed to initiate auth.');
  }
});

app.get('/auth/google-calendar-callback', async (req, res) => {
  try {
    const { code, state: firebaseUid } = req.query;
    if (!code || !firebaseUid) return res.status(400).send('Missing code or UID.');

    const { tokens } = await oauth2Client.getToken(code);

    await db.collection('users').doc(firebaseUid).set({
      googleCalendarRefreshToken: tokens.refresh_token,
      googleCalendarAccessToken: tokens.access_token,
      googleCalendarExpiryDate: new Date(tokens.expiry_date),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.status(200).send('<h1>¡Conectado!</h1><p>Ya puedes cerrar esta ventana y usar el bot.</p>');
  } catch (error) {
    console.error('Callback Error:', error);
    res.status(500).send('Auth failed.');
  }
});

// =========================================================
//                   ENDPOINTS DE CALENDARIO
// =========================================================

// 1. CREAR EVENTO
app.post('/api/create-calendar-event', authenticateN8n, async (req, res) => {
  const { firebaseUid, eventDetails } = req.body;
  if (!firebaseUid || !eventDetails) return res.status(400).send('Missing data.');

  try {
    const userDoc = await db.collection('users').doc(String(firebaseUid)).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;
    if (!refreshToken) return res.status(404).send('User unauthorized.');

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventDetails,
    });

    console.log(`Event created: ${response.data.htmlLink}`);
    res.status(200).json({
      message: 'Event created successfully!',
      eventLink: response.data.htmlLink,
      eventId: response.data.id
    });
  } catch (error) {
    console.error('Create Error:', error);
    res.status(500).send(`Failed to create: ${error.message}`);
  }
});

// 2. MODIFICAR EVENTO (HÍBRIDO: Global + Fallback 1 Semana + PATCH)
app.put('/api/update-calendar-event', authenticateN8n, async (req, res) => {
  const { firebaseUid, searchTitle, eventDetails } = req.body;

  if (!firebaseUid || !searchTitle || !eventDetails) return res.status(400).send('Missing data.');
  const targetTitle = String(searchTitle).trim().toLowerCase();
  if (!targetTitle) return res.status(400).send('Empty search title.');

  // Respaldo servidor: autocompletar hora fin si falta
  if (eventDetails.start?.dateTime && !eventDetails.end?.dateTime) {
    const start = new Date(eventDetails.start.dateTime);
    const end = new Date(start.getTime() + 60*60*1000);
    eventDetails.end = { dateTime: end.toISOString(), timeZone: eventDetails.start.timeZone || "America/Mexico_City" };
  }

  try {
    const userDoc = await db.collection('users').doc(String(firebaseUid)).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;
    if (!refreshToken) return res.status(404).send('User unauthorized.');

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    let matchingEvents = [];
    
    // ESTRATEGIA 1: Búsqueda Global (+/- 1 año)
    const now = new Date();
    const globalMin = new Date(now); globalMin.setFullYear(now.getFullYear() - 1);
    const globalMax = new Date(now); globalMax.setFullYear(now.getFullYear() + 2);

    console.log(`[Update] Attempt 1: Global search "${targetTitle}"`);
    const globalRes = await calendar.events.list({
        calendarId: 'primary', q: targetTitle, timeMin: globalMin.toISOString(), timeMax: globalMax.toISOString(), singleEvents: true, orderBy: 'startTime'
    });
    if (globalRes.data.items?.length > 0) matchingEvents = globalRes.data.items;

    // ESTRATEGIA 2: Fallback Local (+/- 7 días de la fecha objetivo)
    if (matchingEvents.length === 0 && eventDetails.start?.dateTime) {
        console.log(`[Update] Attempt 1 Failed. Attempt 2: Local 1-week scan...`);
        const targetDate = new Date(eventDetails.start.dateTime);
        if (!isNaN(targetDate.getTime())) {
            const localMin = new Date(targetDate); localMin.setDate(localMin.getDate() - 7);
            const localMax = new Date(targetDate); localMax.setDate(localMax.getDate() + 7);

            const localRes = await calendar.events.list({
                calendarId: 'primary', timeMin: localMin.toISOString(), timeMax: localMax.toISOString(), singleEvents: true, orderBy: 'startTime'
            });
            // Filtro manual JS
            matchingEvents = (localRes.data.items || []).filter(e => (e.summary || "").toLowerCase().includes(targetTitle));
        }
    }

    if (matchingEvents.length === 0) {
        return res.status(404).json({ message: `No events found for "${targetTitle}" (checked global & local).`, searchTitle: targetTitle });
    }

    // PROCESO DE UPDATE (PATCH)
    const updatedEvents = [];
    for (const event of matchingEvents) {
        if ((event.summary || "").toLowerCase().includes(targetTitle)) {
            const patchRes = await calendar.events.patch({
                calendarId: 'primary', eventId: event.id, resource: eventDetails 
            });
            updatedEvents.push({ eventId: patchRes.data.id, summary: patchRes.data.summary, link: patchRes.data.htmlLink });
        }
    }

    if (updatedEvents.length === 0) return res.status(404).json({ message: "Candidates found but matched no strict title criteria." });

    console.log(`Updated ${updatedEvents.length} events.`);
    res.status(200).json({ message: `${updatedEvents.length} events updated!`, updatedEvents });

  } catch (error) {
    console.error('Update Error:', error);
    res.status(500).send(`Update failed: ${error.message}`);
  }
});

// 3. ELIMINAR EVENTO (HÍBRIDO: Global + Fallback 3 Meses)
app.delete('/api/delete-calendar-event', authenticateN8n, async (req, res) => {
  const { firebaseUid, searchTitle } = req.body;
  if (!firebaseUid || !searchTitle) return res.status(400).send('Missing data.');
  
  const targetTitle = String(searchTitle).trim().toLowerCase();
  if (!targetTitle) return res.status(400).send('Empty title.');

  try {
    const userDoc = await db.collection('users').doc(String(firebaseUid)).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;
    if (!refreshToken) return res.status(404).send('User unauthorized.');

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    let matchingEvents = [];

    // ESTRATEGIA 1: Búsqueda Global
    const now = new Date();
    const globalMin = new Date(now); globalMin.setFullYear(now.getFullYear() - 1);
    const globalMax = new Date(now); globalMax.setFullYear(now.getFullYear() + 1);

    console.log(`[Delete] Attempt 1: Global search "${targetTitle}"`);
    const globalRes = await calendar.events.list({
        calendarId: 'primary', q: targetTitle, timeMin: globalMin.toISOString(), timeMax: globalMax.toISOString(), singleEvents: true, orderBy: 'startTime'
    });
    if (globalRes.data.items?.length > 0) matchingEvents = globalRes.data.items;

    // ESTRATEGIA 2: Fallback Próximos 3 meses
    if (matchingEvents.length === 0) {
        console.log(`[Delete] Attempt 1 Failed. Attempt 2: Scanning next 3 months...`);
        const scanMax = new Date(); scanMax.setMonth(scanMax.getMonth() + 3);
        
        const scanRes = await calendar.events.list({
            calendarId: 'primary', timeMin: new Date().toISOString(), timeMax: scanMax.toISOString(), singleEvents: true, orderBy: 'startTime'
        });
        // Filtro manual estricto
        matchingEvents = (scanRes.data.items || []).filter(e => (e.summary || "").toLowerCase().trim() === targetTitle);
    }

    if (matchingEvents.length === 0) {
        return res.status(404).json({ message: `No events found for "${targetTitle}" deletion.`, searchTitle: targetTitle });
    }

    const deletedEvents = [];
    for (const event of matchingEvents) {
        const summary = (event.summary || "").toLowerCase().trim();
        if (summary === targetTitle) {
            await calendar.events.delete({ calendarId: 'primary', eventId: event.id });
            deletedEvents.push({ eventId: event.id, summary: event.summary });
        }
    }

    if (deletedEvents.length === 0) return res.status(404).json({ message: "Similar events found, but exact match required for deletion." });

    console.log(`Deleted ${deletedEvents.length} events.`);
    res.status(200).json({ message: `${deletedEvents.length} events deleted!`, deletedEvents });

  } catch (error) {
    console.error('Delete Error:', error);
    res.status(500).send(`Delete failed: ${error.message}`);
  }
});

// 4. LISTAR EVENTOS (Por rango de tiempo recibido de n8n)
app.get('/api/list-events-by-time', authenticateN8n, async (req, res) => {
  const { firebaseUid, timeMin, timeMax } = req.query;
  if (!firebaseUid || !timeMin || !timeMax) return res.status(400).send('Missing params.');

  try {
    const userDoc = await db.collection('users').doc(String(firebaseUid)).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;
    if (!refreshToken) return res.status(404).send('User unauthorized.');

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.status(200).json({ message: 'Events retrieved!', events: response.data.items || [] });

  } catch (error) {
    console.error('List Error:', error);
    res.status(500).send(`List failed: ${error.message}`);
  }
});

// 5. CHECK USER
app.get('/api/user-exists', authenticateN8n, async (req, res) => {
  const { firebaseUid } = req.query;
  if (!firebaseUid) return res.status(400).json({ message: 'Missing firebaseUid.' });
  try {
    const userDoc = await db.collection('users').doc(firebaseUid).get();
    const exists = userDoc.exists && userDoc.data()?.googleCalendarRefreshToken !== undefined;
    res.status(200).json({ firebaseUid, exists, message: exists ? 'User found' : 'User not found' });
  } catch (error) {
    res.status(500).json({ message: `Check failed: ${error.message}` });
  }
});

// --- SERVER START ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
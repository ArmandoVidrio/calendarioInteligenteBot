// server.js (esquemático)
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import admin from 'firebase-admin';
import { google } from 'googleapis'; // Para interactuar con la API de Google Calendar

admin.initializeApp();
const db = admin.firestore();
const app = express();
app.use(express.json());

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI; // URL de tu App Hosting

const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar'];

// 1. Ruta para iniciar el flujo de consentimiento
app.get('/auth/google-calendar-init', (req, res) => {
  const uid = req.query.uid; // El cliente debe enviar el UID del usuario
  if (!uid) return res.status(400).send('UID is required.');
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Muy importante para obtener el refresh_token
    scope: CALENDAR_SCOPES,
    prompt: 'consent', // Asegura que siempre se solicite el consentimiento
    state: uid // Para pasar el UID a la callback de forma segura
  });
  res.redirect(authUrl);
});

// 2. Ruta de callback que maneja la respuesta de Google
app.get('/auth/google-calendar-callback', async (req, res) => {
  try {
    const { code, state: uid } = req.query;
    if (!code || !uid) return res.status(400).send('Missing code or state.');
    const { tokens } = await oauth2Client.getToken(code);
    await db.collection('users').doc(uid).set({
      googleCalendarRefreshToken: tokens.refresh_token,
    }, { merge: true }); // Guarda el refresh_token
    res.send('Google Calendar access granted! You can close this tab.');
  } catch (error) {
    console.error('Error durante la autenticación de Google Calendar:', error);
    res.status(500).send('Authentication failed.');
  }
});

// 3. Endpoint para que n8n cree eventos
app.post('/api/create-calendar-event', async (req, res) => {
  try {
    const { uid, eventDetails } = req.body; // n8n envía UID y detalles del evento
    if (!uid || !eventDetails) return res.status(400).send('Missing UID or event details.');

    const userDoc = await db.collection('users').doc(uid).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;
    if (!refreshToken) return res.status(404).send('User not authorized for Google Calendar.');

    oauth2Client.setCredentials({ refresh_token: refreshToken }); // Configura el cliente con el refresh_token
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.insert({
      calendarId: 'primary',
      resource: eventDetails,
    });
    res.status(200).send('Event created successfully!');
  } catch (error) {
    console.error('Error al crear evento:', error);
    res.status(500).send('Failed to create event.');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

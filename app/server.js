import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import { admin, db } from './config/firebase.js';
import { UserRepository } from './repositories/UserRepository.js';
import { GoogleCalendarAdapter } from './adapters/GoogleCalendarAdapter.js';
import { GoogleAuthAdapter } from './adapters/GoogleAuthAdapter.js';
import { CalendarService } from './services/CalendarService.js';
import { AuthService } from './services/AuthService.js';
import { CalendarController } from './controllers/CalendarController.js';
import { AuthController } from './controllers/AuthController.js';
import { authenticateN8n } from './middlewares/authMiddleware.js';

const app = express();
app.use(express.json());
app.use(cors());

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar'
];

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID, 
  GOOGLE_CLIENT_SECRET, 
  GOOGLE_REDIRECT_URI
);

const userRepo = new UserRepository(db, admin.auth());

const googleCalAdapter = new GoogleCalendarAdapter(oauth2Client);
const googleAuthAdapter = new GoogleAuthAdapter(oauth2Client, CALENDAR_SCOPES);

const calendarService = new CalendarService(userRepo, googleCalAdapter);
const authService = new AuthService(userRepo, googleAuthAdapter);

const calendarController = new CalendarController(calendarService);
const authController = new AuthController(authService);

// Rutas de Autenticación
app.get('/auth/initiate-google-calendar-auth', authController.initiate);
app.get('/auth/google-calendar-callback', authController.callback);

// Rutas de Gestión de Eventos
app.post('/api/create-calendar-event', authenticateN8n, calendarController.create);
app.put('/api/update-calendar-event', authenticateN8n, calendarController.update);
app.delete('/api/delete-calendar-event', authenticateN8n, calendarController.delete);
app.get('/api/list-events-by-time', authenticateN8n, calendarController.list);

// Helper User Check
app.get('/api/user-exists', authenticateN8n, async (req, res) => {
    const { firebaseUid } = req.query;
    if (!firebaseUid) return res.status(400).json({ message: 'Missing uid' });
    
    try {
        const user = await userRepo.findUserByFirebaseUid(firebaseUid);
        const exists = user && user.googleCalendarRefreshToken;
        res.json({ exists: !!exists, firebaseUid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
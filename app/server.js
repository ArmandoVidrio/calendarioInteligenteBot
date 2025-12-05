/**
 * PATRÓN: Dependency Injection
 * SOLID: Dependency Inversion Principle
 * POR QUÉ: Clase principal que ensambla todas las dependencias (Inversión de Control).
 */
import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import { db } from './config/firebase.js';
import { UserRepository } from './repositories/UserRepository.js';
import { GoogleCalendarAdapter } from './adapters/GoogleCalendarAdapter.js';
import { CalendarService } from './services/CalendarService.js';
import { CalendarController } from './controllers/CalendarController.js';
import { authenticateN8n } from './middlewares/authMiddleware.js';

const app = express();
app.use(express.json());
app.use(cors());

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

// 2. Inyección de Dependencias (Ensamblaje)
const userRepo = new UserRepository(db);
const googleAdapter = new GoogleCalendarAdapter(oauth2Client);
const calendarService = new CalendarService(userRepo, googleAdapter);
const calendarController = new CalendarController(calendarService);

// Definir rutas
app.post('/api/create-calendar-event', authenticateN8n, calendarController.create);
app.put('/api/update-calendar-event', authenticateN8n, calendarController.update);
app.delete('/api/delete-calendar-event', authenticateN8n, calendarController.delete);
app.get('/api/list-events-by-time', authenticateN8n, calendarController.list);

// Nota: Las rutas de Auth (/auth/...) irían en un AuthController similar.

// 4. Servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with Layered Architecture`);
});
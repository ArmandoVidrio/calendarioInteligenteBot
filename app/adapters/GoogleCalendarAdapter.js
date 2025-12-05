/**
 * PATRÓN: Adapter Pattern
 * SOLID: Open/Closed Principle (OCP) & Interface Segregation
 * POR QUÉ: Se envuelve la librería externa 'googleapis'. Nuestro sistema no debe depender directamente de la implementación de Google.
 */
import { google } from 'googleapis';

export class GoogleCalendarAdapter {
  constructor(authClient) {
    this.authClient = authClient;
    this.calendar = google.calendar({ version: 'v3', auth: authClient });
  }

  setCredentials(refreshToken) {
    this.authClient.setCredentials({ refresh_token: refreshToken });
  }

  async listEvents(params) {
    // Abstracción: transformamos la llamada compleja de Google en algo simple
    const response = await this.calendar.events.list({
      calendarId: 'primary',
      singleEvents: true,
      orderBy: 'startTime',
      ...params
    });
    return response.data.items || [];
  }

  async insertEvent(eventData) {
    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      resource: eventData
    });
    return { id: response.data.id, link: response.data.htmlLink };
  }

  async patchEvent(eventId, eventData) {
    const response = await this.calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      resource: eventData
    });
    return { id: response.data.id, summary: response.data.summary, link: response.data.htmlLink };
  }

  async deleteEvent(eventId) {
    await this.calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId
    });
    return true;
  }
}
/**
 * PATRÓN: Facade / Service Layer
 * SOLID: Single Responsibility Principle (SRP) - Lógica de Negocio Pura
 * POR QUÉ: Aquí reside la inteligencia del sistema (Búsqueda Híbrida, Fallbacks).
 * El controlador solo recibe datos y llama a este servicio. Este servicio
 * orquesta al Repositorio y al Adaptador.
 */
export class CalendarService {
  constructor(userRepository, googleAdapter) {
    this.userRepo = userRepository;
    this.google = googleAdapter;
  }

  // Helper privado para inicializar sesión
  async _initSession(firebaseUid) {
    const user = await this.userRepo.findUserByFirebaseUid(String(firebaseUid));
    if (!user || !user.googleCalendarRefreshToken) {
      throw new Error('Usuario no autorizado o token faltante.');
    }
    this.google.setCredentials(user.googleCalendarRefreshToken);
  }

  async createEvent(uid, eventDetails) {
    await this._initSession(uid);
    return await this.google.insertEvent(eventDetails);
  }

  async listEvents(uid, timeMin, timeMax) {
    await this._initSession(uid);
    return await this.google.listEvents({ timeMin, timeMax });
  }

  // Lógica de Negocio Crítica: Búsqueda Híbrida para Update
  async updateEventHybrid(uid, searchTitle, changes) {
    await this._initSession(uid);
    const targetTitle = searchTitle.trim().toLowerCase();
    
    // Auto-completar fecha fin si falta (Regla de negocio)
    if (changes.start?.dateTime && !changes.end?.dateTime) {
        const start = new Date(changes.start.dateTime);
        const end = new Date(start.getTime() + 60*60*1000);
        changes.end = { dateTime: end.toISOString(), timeZone: changes.start.timeZone || "America/Mexico_City" };
    }

    let matchingEvents = [];

    // Estrategia 1: Búsqueda Global
    const now = new Date();
    const globalMin = new Date(now); globalMin.setFullYear(now.getFullYear() - 1);
    const globalMax = new Date(now); globalMax.setFullYear(now.getFullYear() + 2);
    
    matchingEvents = await this.google.listEvents({ q: targetTitle, timeMin: globalMin.toISOString(), timeMax: globalMax.toISOString() });

    // Estrategia 2: Fallback Local (si falló la global y tenemos fecha objetivo)
    if (matchingEvents.length === 0 && changes.start?.dateTime) {
        const targetDate = new Date(changes.start.dateTime);
        if (!isNaN(targetDate.getTime())) {
            const localMin = new Date(targetDate); localMin.setDate(localMin.getDate() - 7);
            const localMax = new Date(targetDate); localMax.setDate(localMax.getDate() + 7);
            
            const localEvents = await this.google.listEvents({ timeMin: localMin.toISOString(), timeMax: localMax.toISOString() });
            matchingEvents = localEvents.filter(e => (e.summary || "").toLowerCase().includes(targetTitle));
        }
    }

    if (matchingEvents.length === 0) throw new Error(`No se encontraron eventos para: ${targetTitle}`);

    const updatedResults = [];
    for (const event of matchingEvents) {
        if ((event.summary || "").toLowerCase().includes(targetTitle)) {
            const result = await this.google.patchEvent(event.id, changes);
            updatedResults.push(result);
        }
    }
    return updatedResults;
  }

  // Lógica de Negocio Crítica: Borrado con Escaneo Futuro
  async deleteEventHybrid(uid, searchTitle) {
    await this._initSession(uid);
    const targetTitle = searchTitle.trim().toLowerCase();
    let matchingEvents = [];

    // Estrategia 1: Global
    const now = new Date();
    const globalMin = new Date(now); globalMin.setFullYear(now.getFullYear() - 1);
    const globalMax = new Date(now); globalMax.setFullYear(now.getFullYear() + 1);
    matchingEvents = await this.google.listEvents({ q: targetTitle, timeMin: globalMin.toISOString(), timeMax: globalMax.toISOString() });

    // Estrategia 2: Fallback Futuro (3 meses)
    if (matchingEvents.length === 0) {
        const scanMax = new Date(); scanMax.setMonth(scanMax.getMonth() + 3);
        const scanEvents = await this.google.listEvents({ timeMin: new Date().toISOString(), timeMax: scanMax.toISOString() });
        // Filtro estricto para borrado
        matchingEvents = scanEvents.filter(e => (e.summary || "").toLowerCase().trim() === targetTitle);
    }

    if (matchingEvents.length === 0) throw new Error(`Evento no encontrado para eliminar: ${targetTitle}`);

    const deletedResults = [];
    for (const event of matchingEvents) {
        const summary = (event.summary || "").toLowerCase().trim();
        if (summary === targetTitle) {
            await this.google.deleteEvent(event.id);
            deletedResults.push({ id: event.id, summary: event.summary });
        }
    }
    return deletedResults;
  }
}
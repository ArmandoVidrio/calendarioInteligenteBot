/**
 * PATRÓN: Controller
 * SOLID: SRP (Solo maneja HTTP)
 * POR QUÉ: Desacopla la red (Express) de la lógica. Recibe requests, extrae datos, llama al servicio y devuelve respuestas estandarizadas.
 */
export class CalendarController {
  constructor(calendarService) {
    this.service = calendarService;
  }

  create = async (req, res) => {
    try {
      const { firebaseUid, eventDetails } = req.body;
      if (!firebaseUid || !eventDetails) return res.status(400).send('Faltan datos.');
      
      const result = await this.service.createEvent(firebaseUid, eventDetails);
      res.json({ message: 'Evento creado', ...result });
    } catch (error) {
      console.error(error);
      res.status(500).send(error.message);
    }
  }

  update = async (req, res) => {
    try {
      const { firebaseUid, searchTitle, eventDetails } = req.body;
      if (!firebaseUid || !searchTitle) return res.status(400).send('Faltan datos.');

      const result = await this.service.updateEventHybrid(firebaseUid, searchTitle, eventDetails);
      res.json({ message: `${result.length} eventos actualizados`, updatedEvents: result });
    } catch (error) {
      console.error(error);
      const status = error.message.includes('No se encontraron') ? 404 : 500;
      res.status(status).send(error.message);
    }
  }

  delete = async (req, res) => {
    try {
      const { firebaseUid, searchTitle } = req.body;
      if (!firebaseUid || !searchTitle) return res.status(400).send('Faltan datos.');

      const result = await this.service.deleteEventHybrid(firebaseUid, searchTitle);
      res.json({ message: `${result.length} eventos eliminados`, deletedEvents: result });
    } catch (error) {
      console.error(error);
      const status = error.message.includes('No encontrado') ? 404 : 500;
      res.status(status).send(error.message);
    }
  }

  list = async (req, res) => {
    try {
      const { firebaseUid, timeMin, timeMax } = req.query;
      if (!firebaseUid || !timeMin || !timeMax) return res.status(400).send('Faltan parámetros.');

      const events = await this.service.listEvents(firebaseUid, timeMin, timeMax);
      res.json({ message: 'Eventos recuperados', events });
    } catch (error) {
      console.error(error);
      res.status(500).send(error.message);
    }
  }
}
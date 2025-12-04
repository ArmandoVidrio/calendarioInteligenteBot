// --- server.js (Endpoints modificados) ---

// 3. Endpoint para eliminar un evento por título (CON BÚSQUEDA ROBUSTA)
app.delete('/api/delete-calendar-event', authenticateN8n, async (req, res) => {
  const { firebaseUid, searchTitle } = req.body;

  if (!firebaseUid || !searchTitle) {
    return res.status(400).send('Missing firebaseUid or searchTitle.');
  }

  const targetTitle = String(searchTitle).trim().toLowerCase();
  if (targetTitle === '') {
    return res.status(400).send('searchTitle must be a non-empty string.');
  }

  try {
    const firebaseUidAsString = String(firebaseUid);
    const userDoc = await db.collection('users').doc(firebaseUidAsString).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;

    if (!refreshToken) {
      return res.status(404).send('User has not authorized Google Calendar.');
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    let matchingEvents = [];

    // ESTRATEGIA 1: BÚSQUEDA GLOBAL 'q'
    // Buscamos en un rango amplio de +/- 1 año para encontrar el evento donde sea.
    const now = new Date();
    const globalMin = new Date(now); globalMin.setFullYear(now.getFullYear() - 1);
    const globalMax = new Date(now); globalMax.setFullYear(now.getFullYear() + 1);

    console.log(`[Delete] Attempt 1: Global search for "${targetTitle}"`);

    const globalSearchResponse = await calendar.events.list({
        calendarId: 'primary',
        q: targetTitle,
        timeMin: globalMin.toISOString(),
        timeMax: globalMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
    });

    if (globalSearchResponse.data.items && globalSearchResponse.data.items.length > 0) {
        matchingEvents = globalSearchResponse.data.items;
        console.log(`[Delete] Found ${matchingEvents.length} candidates via Global Search.`);
    }

    // ESTRATEGIA 2: FALLBACK - ESCANEO DE PRÓXIMOS 3 MESES
    // Si la búsqueda global falla (por indexación), asumimos que el usuario quiere
    // borrar un evento futuro cercano.
    if (matchingEvents.length === 0) {
        console.log(`[Delete] Attempt 1 Failed. Starting [Attempt 2] Scanning next 3 months...`);
        
        const scanMin = new Date(); // Desde ahora
        const scanMax = new Date(); 
        scanMax.setMonth(scanMax.getMonth() + 3); // Hasta 3 meses

        const scanResponse = await calendar.events.list({
            calendarId: 'primary',
            timeMin: scanMin.toISOString(),
            timeMax: scanMax.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        const allUpcomingEvents = scanResponse.data.items || [];
        
        // Filtro manual estricto
        matchingEvents = allUpcomingEvents.filter(e => {
            const summary = (e.summary || "").toLowerCase();
            return summary.trim() === targetTitle; // Para borrar, preferimos coincidencia exacta o muy cercana
        });
        
        console.log(`[Delete] Scanned ${allUpcomingEvents.length} upcoming events. Found ${matchingEvents.length} matches manually.`);
    }

    if (matchingEvents.length === 0) {
        return res.status(404).json({
            message: `No exact matching events found with title "${targetTitle}" for deletion.`,
            searchTitle: targetTitle
        });
    }

    // PROCESO DE BORRADO
    const deletedEvents = [];

    for (const event of matchingEvents) {
        // Doble verificación del título (Coincidencia exacta case-insensitive para evitar borrar "Cena" cuando pides borrar "Cena Trabajo")
        const eventSummary = (event.summary || "").toLowerCase().trim();
        
        if (eventSummary === targetTitle) {
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: event.id,
            });
            deletedEvents.push({
                eventId: event.id,
                summary: event.summary
            });
        }
    }

    if (deletedEvents.length === 0) {
        return res.status(404).json({
            message: `Found similar events but none matched title "${targetTitle}" exactly. Safety abort.`,
            candidates: matchingEvents.map(e => e.summary)
        });
    }

    console.log(`Deleted ${deletedEvents.length} events.`);
    res.status(200).json({
        message: `${deletedEvents.length} events deleted successfully!`,
        deletedEvents: deletedEvents
    });

  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).send(`Failed to delete event: ${error.message}`);
  }
});

// 4. Endpoint para listar eventos (Ya soporta rangos gracias a n8n)
app.get('/api/list-events-by-time', authenticateN8n, async (req, res) => {
  const { firebaseUid, timeMin, timeMax } = req.query;

  if (!firebaseUid || !timeMin || !timeMax) {
    return res.status(400).send('Missing parameters.');
  }

  try {
    const userDoc = await db.collection('users').doc(firebaseUid).get();
    const refreshToken = userDoc.data()?.googleCalendarRefreshToken;

    if (!refreshToken) return res.status(404).send('User unauthorized.');

    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin, // Recibe ISO directo de n8n
      timeMax: timeMax, // Recibe ISO directo de n8n
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    res.status(200).json({
      message: 'Events retrieved!',
      events: events
    });

  } catch (error) {
    console.error('Error listing events:', error);
    res.status(500).send(`Failed to list events: ${error.message}`);
  }
});
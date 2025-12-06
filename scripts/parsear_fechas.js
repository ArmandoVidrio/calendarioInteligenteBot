// Obtenemos la lista de eventos que viene del nodo anterior (HTTP Request)
// Nota: Ajusta 'HTTP Request' al nombre real de tu nodo si es diferente, 
// o usa $input.item.json.events si usas n8n versión > 1.0
const events = $input.item.json.events || [];

// Configuración de formato de fecha para México
const options = { 
  timeZone: "America/Mexico_City", 
  weekday: 'long', 
  day: 'numeric', 
  month: 'short', 
  hour: '2-digit', 
  minute: '2-digit',
  hour12: false
};

// Función helper para capitalizar primera letra (jueves -> Jueves)
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

if (events.length === 0) {
  return {
    json: {
      message: "📭 **Agenda vacía**\nNo encontré eventos en este rango de fechas."
    }
  };
}

let message = `🗓️ **Tus Eventos Encontrados (${events.length}):**\n\n`;

// Iteramos sobre cada evento para construir la lista
events.forEach(event => {
  const summary = event.summary || "Sin título";
  
  // Manejo seguro de fechas (por si es evento de todo el día o con hora)
  const startRaw = event.start.dateTime || event.start.date;
  const startDate = new Date(startRaw);
  
  // Formateamos la fecha bonito
  // Ej: "Jueves 04 Dic, 18:00"
  const formatter = new Intl.DateTimeFormat('es-MX', options);
  const dateString = formatter.format(startDate);
  
  // Limpiamos el string para que se vea elegante
  // Intl a veces retorna "jueves, 4 de dic., 18:00", lo simplificamos:
  const finalDate = capitalize(dateString).replace(',', '').replace('.', '');

  // Agregamos línea al mensaje final
  // Formato: 🕒 Jueves 04 Dic 18:00 - Título
  message += `🕒 ${finalDate} hrs\n📌 **${summary}**\n\n`;
});

// Agregamos un pie de página útil
message += "💡 _Usa /modificar o /cancelar seguido del título para editar._";

return {
  json: {
    message: message
  }
};
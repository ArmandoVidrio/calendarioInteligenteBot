const events = $input.item.json.events || [];

const options = { 
  timeZone: "America/Mexico_City", 
  weekday: 'long', 
  day: 'numeric', 
  month: 'short', 
  hour: '2-digit', 
  minute: '2-digit',
  hour12: false
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

if (events.length === 0) {
  return {
    json: {
      message: "📭 **Agenda vacía**\nNo encontré eventos en este rango de fechas."
    }
  };
}

let message = `🗓️ **Tus Eventos Encontrados (${events.length}):**\n\n`;

events.forEach(event => {
  const summary = event.summary || "Sin título";
  const startRaw = event.start.dateTime || event.start.date;
  const startDate = new Date(startRaw);
  
  const formatter = new Intl.DateTimeFormat('es-MX', options);
  const dateString = formatter.format(startDate);
  
  const finalDate = capitalize(dateString).replace(',', '').replace('.', '');

  message += `🕒 ${finalDate} hrs\n📌 **${summary}**\n\n`;
});

message += "💡 _Usa /modificar o /cancelar seguido del título para editar._";

return {
  json: {
    message: message
  }
};
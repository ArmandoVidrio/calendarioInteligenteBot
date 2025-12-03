/**
 * ---------------------------------------------------------
 * CONFIGURACIÓN
 * ---------------------------------------------------------
 */
const DEFAULT_TIMEZONE = "America/Mexico_City"; 

/**
 * ---------------------------------------------------------
 * UTILIDAD: PARSER DE FECHAS EN ESPAÑOL
 * Convierte "16 de septiembre a las 13:30" -> Date Object
 * ---------------------------------------------------------
 */
function parseSpanishDate(text) {
    const months = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };

    const currentYear = new Date().getFullYear();
    const lowerText = text.toLowerCase();

    // Regex para: "16 de septiembre" ó "16 de septiembre del 2025"
    // Captura: Dia, Mes, Año (Opcional), Hora (Opcional)
    // Ej: "16 de septiembre a las 13:30"
    const regex = /(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+del?\s+(\d{4}))?(?:\s+a\s+las\s+(\d{1,2})(?::(\d{2}))?)?/i;
    const match = lowerText.match(regex);

    if (match) {
        const day = parseInt(match[1]);
        const monthName = match[2];
        const year = match[3] ? parseInt(match[3]) : currentYear;
        const hour = match[4] ? parseInt(match[4]) : 9; // Si no pone hora, default 9am
        const minute = match[5] ? parseInt(match[5]) : 0;

        if (months[monthName] !== undefined) {
            const date = new Date(year, months[monthName], day, hour, minute);
            // Ajustamos a ISO String
            return date.toISOString().split('.')[0] + "-06:00"; // Ajuste manual offset México
        }
    }
    
    // Si no es fecha en español, intentamos formato ISO estándar por si acaso
    const isoDate = new Date(text);
    if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString().split('.')[0] + "-06:00";
    }

    return null;
}

/**
 * ---------------------------------------------------------
 * ESTRATEGIAS (Lógica de Negocio)
 * ---------------------------------------------------------
 */
class CommandStrategy {
    validate(args) { return { isValid: false, message: "Error interno" }; }
    buildPayload(args, uid) { return {}; }
}

// 0. BIENVENIDA
class WelcomeStrategy extends CommandStrategy {
    validate(args) { return { isValid: true }; }
    buildPayload(args, uid) { return {}; }
}

// 1. CREAR (Agendar con fecha natural)
class CreateStrategy extends CommandStrategy {
    validate(args) {
        // Acepta: "Dentista | 16 de septiembre a las 13:30"
        const parts = args.split('|');
        if (parts.length < 2) {
            return { 
                isValid: false, 
                message: "❌ **Falta información.**\n\nIntenta así (en español):\n`/agendar Título | Día de Mes a las Hora:Min`\n\nEjemplo:\n`/agendar Cita Dentista | 16 de septiembre a las 13:30`" 
            };
        }
        
        const dateStr = parts[1].trim();
        const parsedDate = parseSpanishDate(dateStr);

        if (!parsedDate) {
            return { isValid: false, message: "❌ **No entendí la fecha.**\n\nAsegúrate de escribir bien el mes (ej: '16 de septiembre')." };
        }

        return { isValid: true, parsedDate: parsedDate }; // Pasamos la fecha ya limpia
    }

    buildPayload(args, uid, validationResult) {
        const parts = args.split('|');
        const summary = parts[0].trim();
        const startDate = new Date(validationResult.parsedDate); // Usamos la fecha que ya limpiamos
        const endDate = new Date(startDate.getTime() + 60 * 60000); // +1 hora

        return {
            firebaseUid: uid,
            eventDetails: {
                summary: summary,
                description: "Creado desde Telegram",
                start: { dateTime: startDate.toISOString(), timeZone: DEFAULT_TIMEZONE },
                end: { dateTime: endDate.toISOString(), timeZone: DEFAULT_TIMEZONE }
            }
        };
    }
}

// 2. MODIFICAR (Por Título en vez de ID)
class UpdateStrategy extends CommandStrategy {
    validate(args) {
        const parts = args.split('|');
        if (parts.length < 2) {
            return { isValid: false, message: "❌ **Faltan datos.**\n\nUsa: `/modificar <Titulo de evento> | <Nueva fecha>`" };
        }
        
        const dateStr = parts[1].trim();
        const parsedDate = parseSpanishDate(dateStr);
        if (!parsedDate) return { isValid: false, message: "❌ Fecha inválida." };

        return { isValid: true, parsedDate: parsedDate };
    }

    buildPayload(args, uid, validationResult) {
        const parts = args.split('|');
        // MANDAMOS "searchTitle" en lugar de "eventId" 
        // (Tu amigo tendrá que adaptar su API para buscar por nombre o tú hacer un paso previo)
        return {
            firebaseUid: uid,
            searchTitle: parts[0].trim(), // <--- CAMBIO IMPORTANTE
            eventDetails: {
                start: { dateTime: validationResult.parsedDate, timeZone: DEFAULT_TIMEZONE }
            }
        };
    }
}

// 3. BORRAR (Por Título en vez de ID)
class DeleteStrategy extends CommandStrategy {
    validate(args) {
        if (!args.trim()) return { isValid: false, message: "❌ **Falta el nombre.**\n\nUsa: `/cancelar Título del Evento`\nEj: `/cancelar Dentista`" };
        return { isValid: true };
    }

    buildPayload(args, uid) {
        // Mandamos el título para que el backend busque y borre
        return {
            firebaseUid: uid,
            searchTitle: args.trim() // <--- CAMBIO IMPORTANTE
        };
    }
}

// 4. CONSULTAR (Solo por día)
class CheckStrategy extends CommandStrategy {
    validate(args) {
        // Acepta: "16 de septiembre" (sin hora)
        if (!args.trim()) return { isValid: false, message: "❌ **Falta la fecha.**\n\nEj: `/checar 16 de septiembre`" };
        
        const parsedDate = parseSpanishDate(args.trim());
        if (!parsedDate) return { isValid: false, message: "❌ No entendí la fecha." };

        return { isValid: true, parsedDate: parsedDate };
    }

    buildPayload(args, uid, validationResult) {
        // Al checar, enviamos la fecha con hora 00:00 o la que detecte
        return {
            firebaseUid: uid,
            queryTime: validationResult.parsedDate,
            durationMinutes: 60
        };
    }
}

// --- FACTORY & PARSER ---
class CommandContext {
    constructor(msg) {
        this.rawText = (msg.text || "").trim();
        this.chatId = msg.chat.id;
        this.firebaseUid = String(msg.chat.id); 
    }

    parse() {
        const lower = this.rawText.toLowerCase();
        
        // Saludos
        if (['hola', 'inicio', 'start', 'ayuda'].some(w => lower.includes(w)) || lower === '/start') {
            return { action: 'start', args: '' };
        }

        // Comandos
        if (this.rawText.startsWith('/')) {
            const clean = this.rawText.substring(1);
            const firstSpace = clean.indexOf(' ');
            const action = firstSpace === -1 ? clean : clean.substring(0, firstSpace);
            const args = firstSpace === -1 ? "" : clean.substring(firstSpace + 1);
            return { action: action.toLowerCase(), args };
        }
        return { action: 'unknown', args: '' };
    }
}

function getStrategy(action) {
    switch (action) {
        case 'start': return new WelcomeStrategy();
        case 'agendar': return new CreateStrategy();
        case 'modificar': return new UpdateStrategy();
        case 'cancelar': return new DeleteStrategy();
        case 'checar': return new CheckStrategy(); // Antes listar
        default: return null;
    }
}

// --- MAIN ---
let msg;
try { msg = $('Mensaje del usuario').item.json.message; } 
catch (e) { msg = $input.item.json.message; }

const context = new CommandContext(msg);
const { action, args } = context.parse();
const strategy = getStrategy(action);

let result = { action, isValid: false, message: "", payload: {} };

if (action === 'start') {
    result.isValid = true;
    result.message = "👋 **¡Hola!**\n\nPuedes escribirme naturalmente:\n\n📅 `/agendar Cita Dentista | 16 de septiembre a las 10:00`\n🔍 `/modificar <nombre de evento> <nueva fecha de evento>`\n🗑️ `/cancelar <nombre de evento>`\n\n **IMPORTANTE: El formato de hora es 24hrs, es decir, si quieres un evento a las 2 de la tarde ingresa `12:00` **";
    return { json: result };
}

if (strategy) {
    const validation = strategy.validate(args);
    if (validation.isValid) {
        result.isValid = true;
        result.message = "Procesando...";
        result.payload = strategy.buildPayload(args, context.firebaseUid, validation);
    } else {
        result.message = validation.message;
    }
} else {
    result.message = "⚠️ No entendí. Intenta: `/agendar Título | Fecha`";
}

return { json: result };
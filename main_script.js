/**
 * ---------------------------------------------------------
 * CONFIGURACIÓN
 * ---------------------------------------------------------
 */
const DEFAULT_TIMEZONE = "America/Mexico_City";

/**
 * ---------------------------------------------------------
 * UTILIDAD: PARSER ROBUSTO CON TIMEZONE FIJO (MÉXICO)
 * ---------------------------------------------------------
 */
function parseSpanishDate(text) {
    const months = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };
    
    const pad = (n) => n < 10 ? '0' + n : n;

    const lowerText = text.toLowerCase().trim();
    const now = new Date(); 
    
    let year, monthIdx, day, hour, minute;
    let yearExplicitlyProvided = false;

    // A. DETECCIÓN DE FECHA RELATIVA (HOY / MAÑANA)
    if (lowerText.includes('mañana') || lowerText.includes('hoy')) {
        const offsetMexico = -6 * 60; 
        const nowMexico = new Date(now.getTime() + (offsetMexico * 60 * 1000));
        
        const daysToAdd = lowerText.includes('mañana') ? 1 : 0;
        nowMexico.setDate(nowMexico.getDate() + daysToAdd);

        year = nowMexico.getUTCFullYear();
        monthIdx = nowMexico.getUTCMonth();
        day = nowMexico.getUTCDate();

        const timeRegex = /(?:a\s+las?|at|\s)\s*(\d{1,2})(?:[:\.](\d{2}))?\s*(am|pm)?/i;
        const timeMatch = lowerText.match(timeRegex);

        hour = 9; minute = 0; // Default
        if (timeMatch) {
            hour = parseInt(timeMatch[1]);
            minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const ampm = timeMatch[3];
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
        } else if (lowerText.includes('hoy')) {
            hour = nowMexico.getUTCHours() + 1; 
        }

    } else {
        // B. DETECCIÓN DE FECHA ESPECÍFICA
        const regex = /(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+del?\s+(\d{4}))?(?:[\s,]+(?:a\s+las?|a\s+la|at)?\s*(\d{1,2})(?:[:\.](\d{2}))?\s*(am|pm)?)?/i;
        const match = lowerText.match(regex);

        if (!match) {
            const isoDate = new Date(text);
            if (!isNaN(isoDate.getTime())) {
                return isoDate.toISOString().split('.')[0] + "-06:00";
            }
            return null; 
        }

        day = parseInt(match[1]);
        const monthName = match[2];
        
        if (months[monthName] === undefined) return null;
        monthIdx = months[monthName];

        if (match[3]) {
            year = parseInt(match[3]);
            yearExplicitlyProvided = true;
        } else {
            year = new Date().getFullYear();
        }

        hour = 9; minute = 0;
        if (match[4]) {
            hour = parseInt(match[4]);
            minute = match[5] ? parseInt(match[5]) : 0;
            const ampm = match[6];
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
        }
    }

    let isoString = `${year}-${pad(monthIdx + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00-06:00`;
    let parsedDate = new Date(isoString);

    if (!yearExplicitlyProvided && parsedDate < now) {
        year += 1;
        isoString = `${year}-${pad(monthIdx + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00-06:00`;
    }

    return isoString;
}

/**
 * ---------------------------------------------------------
 * ESTRATEGIAS
 * ---------------------------------------------------------
 */
class CommandStrategy {
    validate(args) { return { isValid: false, message: "Error interno" }; }
    buildPayload(args, uid) { return {}; }
    
    // Helper compartido para sumar 1 hora seguro en MX
    addOneHourSafe(isoDateString) {
        const date = new Date(isoDateString);
        date.setHours(date.getHours() + 1);
        const options = { 
            timeZone: "America/Mexico_City", 
            year: 'numeric', month: '2-digit', day: '2-digit', 
            hour: '2-digit', minute: '2-digit', second: '2-digit', 
            hour12: false 
        };
        const formatter = new Intl.DateTimeFormat('en-CA', options); 
        const parts = formatter.formatToParts(date);
        const getPart = (type) => parts.find(p => p.type === type).value;
        return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}-06:00`;
    }
}

// 0. BIENVENIDA
class WelcomeStrategy extends CommandStrategy {
    validate(args) { return { isValid: true }; }
    buildPayload(args, uid) {
        return {
            message: "👋 ¡Hola! Soy tu asistente de calendario.\n\n⚡ **Comando Rápido:**\n`/agendar Título | Fecha Inicio`\n_(Se creará un evento de 1 hora automáticamente)_\n\nComandos disponibles:\n📅 `/agendar` - Crear eventos\n🔍 `/modificar` - Cambiar horario\n🗑️ `/cancelar` - Borrar eventos\n🗓️ `/checar` - Ver agenda\n\nEscribe `/help` para ver todos los detalles.",
            action: 'bienvenida' 
        };
    }
}

// AYUDA
class HelpStrategy extends CommandStrategy {
    validate(args) { return { isValid: true }; }
    buildPayload(args, uid) {
        return {
            message: "📘 **CENTRO DE AYUDA Y COMANDOS**\n\n" +
                     "📅 **1. AGENDAR EVENTOS**\n" +
                     "Tienes dos formas de crear eventos:\n" +
                     "🔹 **Rápida (1 hora automática):**\n" +
                     "`/agendar Título | Fecha Inicio`\n" +
                     "Ej: `/agendar Gym | hoy a las 18:00`\n\n" +
                     "🔹 **Completa (Inicio y Fin):**\n" +
                     "`/agendar Título | Inicio | Fin`\n" +
                     "Ej: `/agendar Reunión | mañana 9am | mañana 10:30am`\n\n" +
                     "--------------------------------\n\n" +
                     "🔍 **2. MODIFICAR EVENTOS**\n" +
                     "Busca por título y cambia el horario:\n" +
                     "🔹 **Rápida (Mover a nueva hora):**\n" +
                     "`/modificar Título | Nueva Inicio`\n" +
                     "Ej: `/modificar Gym | hoy 19:00`\n\n" +
                     "🔹 **Completa (Cambiar todo):**\n" +
                     "`/modificar Título | Inicio | Fin`\n\n" +
                     "--------------------------------\n\n" +
                     "✨ **3. OPCIONES EXTRAS**\n" +
                     "Al Agendar o Modificar, agrega detalles al final con `|`:\n" +
                     "📝 `| Descripción: nota del evento`\n" +
                     "📍 `| Ubicación: lugar o link`\n" +
                     "👥 `| Asistentes: correo1@gmail.com, correo2@hotmail.com`\n\n" +
                     "💡 *Ejemplo Pro:*\n" +
                     "`/agendar Cita Dr | viernes 16:00 | Ubicación: Clinica | Descripción: Llevar estudios`\n\n" +
                     "--------------------------------\n\n" +
                     "🗓️ **4. CONSULTAR AGENDA (NUEVO)**\n" +
                     "Puedes ver tu agenda por día o por rango:\n" +
                     "• `/checar hoy`\n" +
                     "• `/checar mañana`\n" +
                     "• `/checar 1 semana` (Próximos 7 días)\n" +
                     "• `/checar 15 dias`\n" +
                     "• `/checar 1 mes`\n\n" +
                     "--------------------------------\n\n" +
                     "🗑️ **5. CANCELAR**\n" +
                     "`/cancelar Título Exacto`",
            action: 'ayuda'
        };
    }
}

// 1. CREAR (Agendar)
class CreateStrategy extends CommandStrategy {
    parseEventArgs(args) {
        const parts = args.split('|').map(s => s.trim());
        if (parts.length < 2) return { isValid: false, message: "❌ **Faltan datos.**\nUsa: `/agendar Título | Fecha Inicio`" };

        const summary = parts[0];
        const startDateStr = parts[1];
        if (!summary) return { isValid: false, message: "❌ El título no puede estar vacío." };

        const parsedStartDate = parseSpanishDate(startDateStr);
        if (!parsedStartDate) return { isValid: false, message: `❌ No entendí la fecha de inicio: "${startDateStr}".` };

        let parsedEndDate = null;
        let optionalParamsStartIndex = 2;

        if (parts.length > 2) {
            const possibleEndDateStr = parts[2];
            const possibleEndDate = parseSpanishDate(possibleEndDateStr);
            if (possibleEndDate) {
                parsedEndDate = possibleEndDate;
                optionalParamsStartIndex = 3;
            } 
        }

        if (!parsedEndDate) parsedEndDate = this.addOneHourSafe(parsedStartDate);
        if (new Date(parsedStartDate) >= new Date(parsedEndDate)) return { isValid: false, message: "❌ La fecha de inicio debe ser anterior a la de fin." };

        let description, location;
        const attendees = [];

        for (let i = optionalParamsStartIndex; i < parts.length; i++) {
            const part = parts[i];
            const lowerPart = part.toLowerCase();
            if (lowerPart.startsWith('descripción:')) description = part.substring('descripción:'.length).trim();
            else if (lowerPart.startsWith('ubicación:')) location = part.substring('ubicación:'.length).trim();
            else if (lowerPart.startsWith('asistentes:')) {
                const emailsStr = part.substring('asistentes:'.length).trim();
                emailsStr.split(',').forEach(email => {
                    const trimmedEmail = email.trim();
                    if (trimmedEmail) attendees.push({ email: trimmedEmail });
                });
            }
        }

        return { isValid: true, summary, parsedStartDate, parsedEndDate, description: description || undefined, location: location || undefined, attendees: attendees.length > 0 ? attendees : undefined };
    }
    validate(args) { return this.parseEventArgs(args); }
    buildPayload(args, uid, validationResult) {
        const data = validationResult;
        const eventDetails = {
            summary: data.summary,
            description: data.description || "Creado desde Telegram",
            start: { dateTime: data.parsedStartDate, timeZone: DEFAULT_TIMEZONE },
            end: { dateTime: data.parsedEndDate, timeZone: DEFAULT_TIMEZONE }
        };
        if (data.location) eventDetails.location = data.location;
        if (data.attendees) eventDetails.attendees = data.attendees;
        return { firebaseUid: uid, eventDetails: eventDetails };
    }
}

// 2. MODIFICAR
class UpdateStrategy extends CommandStrategy {
    validate(args) {
        const parts = args.split('|').map(s => s.trim());
        if (parts.length < 2) return { isValid: false, message: "❌ **Faltan datos.**\nUsa: `/modificar Título | Nueva Inicio`" };
        
        const searchTitle = parts[0];
        const startDateStr = parts[1];
        if (!searchTitle) return { isValid: false, message: "❌ Falta el título." };

        const parsedStartDate = parseSpanishDate(startDateStr);
        if (!parsedStartDate) return { isValid: false, message: "❌ Nueva fecha de inicio inválida." };

        let parsedEndDate = null;
        let optionalParamsStartIndex = 2;

        if (parts.length > 2) {
            const possibleEndDateStr = parts[2];
            const possibleEndDate = parseSpanishDate(possibleEndDateStr);
            if (possibleEndDate) {
                parsedEndDate = possibleEndDate;
                optionalParamsStartIndex = 3;
            } 
        }

        if (!parsedEndDate) parsedEndDate = this.addOneHourSafe(parsedStartDate);
        if (new Date(parsedStartDate) >= new Date(parsedEndDate)) return { isValid: false, message: "❌ Inicio debe ser antes del fin." };

        let description, location;
        const attendees = [];
        for (let i = optionalParamsStartIndex; i < parts.length; i++) {
            const part = parts[i];
            const lowerPart = part.toLowerCase();
            if (lowerPart.startsWith('descripción:')) description = part.substring('descripción:'.length).trim();
            else if (lowerPart.startsWith('ubicación:')) location = part.substring('ubicación:'.length).trim();
            else if (lowerPart.startsWith('asistentes:')) {
                const emailsStr = part.substring('asistentes:'.length).trim();
                emailsStr.split(',').forEach(email => {
                    const trimmedEmail = email.trim();
                    if (trimmedEmail) attendees.push({ email: trimmedEmail });
                });
            }
        }

        return { isValid: true, parsedStartDate, parsedEndDate, searchTitle, description, location, attendees: attendees.length > 0 ? attendees : undefined };
    }
    buildPayload(args, uid, validationResult) {
        const data = validationResult;
        const eventDetails = {
            start: { dateTime: data.parsedStartDate, timeZone: DEFAULT_TIMEZONE },
            end: { dateTime: data.parsedEndDate, timeZone: DEFAULT_TIMEZONE }
        };
        if (data.description) eventDetails.description = data.description;
        if (data.location) eventDetails.location = data.location;
        if (data.attendees) eventDetails.attendees = data.attendees;
        return { firebaseUid: uid, searchTitle: data.searchTitle, eventDetails: eventDetails };
    }
}

// 3. BORRAR
class DeleteStrategy extends CommandStrategy {
    validate(args) {
        if (!args.trim()) return { isValid: false, message: "❌ **Falta el título.**\nUsa: `/cancelar Título del Evento`" };
        return { isValid: true };
    }
    buildPayload(args, uid) {
        return { firebaseUid: uid, searchTitle: args.trim() };
    }
}

// 4. CONSULTAR (CORREGIDO: Manejo estricto de "Hoy" y "Ahora")
class CheckStrategy extends CommandStrategy {
    
    // Helper para obtener string ISO con zona horaria MX (-06:00)
    getMexicoISO(dateObj) {
        const options = { 
            timeZone: "America/Mexico_City", 
            year: 'numeric', month: '2-digit', day: '2-digit', 
            hour: '2-digit', minute: '2-digit', second: '2-digit', 
            hour12: false 
        };
        const formatter = new Intl.DateTimeFormat('en-CA', options);
        const parts = formatter.formatToParts(dateObj);
        const getPart = (type) => parts.find(p => p.type === type).value;
        
        return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}-06:00`;
    }

    validate(args) {
        const text = args.trim().toLowerCase();
        if (!text) return { isValid: false, message: "❌ **Falta el rango.**\nEj: `/checar hoy`, `/checar 1 semana`" };
        
        const now = new Date();
        const nowISO = this.getMexicoISO(now); 

        // 1. CASO ESPECIAL: "HOY" (Prioridad alta)
        // Si el usuario dice "hoy", queremos desde AHORA MISMO hasta el final del día.
        if (text === 'hoy') {
            const todayDatePart = nowISO.split('T')[0]; // 2025-12-04
            return { 
                isValid: true, 
                timeMin: nowISO, // Desde este segundo exacto
                timeMax: `${todayDatePart}T23:59:59-06:00` // Hasta media noche
            };
        }

        // 2. DETECCIÓN DE RANGO: "1 semana", "2 dias"
        const rangeRegex = /^(\d+)\s*(dias?|semanas?|mes(?:es)?)$/i;
        const match = text.match(rangeRegex);

        if (match) {
            const quantity = parseInt(match[1]);
            const unit = match[2];
            
            // timeMin es AHORA MISMO
            const timeMin = nowISO;
            
            // Calculamos timeMax
            const endDate = new Date(now);
            if (unit.startsWith('dia')) {
                endDate.setDate(endDate.getDate() + quantity);
            } else if (unit.startsWith('semana')) {
                endDate.setDate(endDate.getDate() + (quantity * 7));
            } else if (unit.startsWith('mes')) {
                endDate.setMonth(endDate.getMonth() + quantity);
            }
            
            const endISO = this.getMexicoISO(endDate);
            const endDatePart = endISO.split('T')[0];
            const timeMax = `${endDatePart}T23:59:59-06:00`; // Final del último día del rango

            return { isValid: true, timeMin, timeMax };
        }

        // 3. DETECCIÓN DE FECHA ESPECÍFICA (Mañana, 4 de diciembre, etc.)
        const parsedDateStr = parseSpanishDate(text);
        if (parsedDateStr) {
            const baseDateString = parsedDateStr.substring(0, 10); // YYYY-MM-DD
            
            // Si es un día futuro o pasado específico, mostramos desde las 00:00
            return { 
                isValid: true, 
                timeMin: `${baseDateString}T00:00:00-06:00`,
                timeMax: `${baseDateString}T23:59:59-06:00`
            };
        }

        return { isValid: false, message: "❌ No entendí el rango.\nIntenta: `/checar 1 semana` o `/checar hoy`" };
    }

    buildPayload(args, uid, validationResult) {
        return {
            firebaseUid: uid,
            timeMin: validationResult.timeMin,
            timeMax: validationResult.timeMax
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
        if (lower === '/help' || lower.includes('ayuda')) return { action: 'help', args: '' };
        if (['hola', 'inicio', 'start'].some(w => lower.includes(w)) || lower === '/start') return { action: 'welcome', args: '' };
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
        case 'welcome': return new WelcomeStrategy();
        case 'help': return new HelpStrategy();
        case 'agendar': return new CreateStrategy();
        case 'modificar': return new UpdateStrategy();
        case 'cancelar': return new DeleteStrategy();
        case 'checar': case 'listar': return new CheckStrategy(); // Soporta ambos
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

if (strategy) {
    const validation = strategy.validate(args);
    if (validation.isValid) {
        result.isValid = true;
        if (action === 'welcome' || action === 'help') {
            const strategyResult = strategy.buildPayload(args, context.firebaseUid);
            result.message = strategyResult.message;
            result.action = strategyResult.action; 
            result.payload = {};
        } else {
            result.message = "Procesando...";
            result.payload = strategy.buildPayload(args, context.firebaseUid, validation);
        }
    } else {
        result.message = validation.message;
        if (!result.message.includes('/help')) result.message += "\n\nEscribe `/help` para ver los formatos.";
    }
} else {
    result.message = "⚠️ No entendí tu comando. Escribe `/help` para ayuda.";
}
return { json: result };
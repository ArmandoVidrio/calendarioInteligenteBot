# Backend de Google Calendar para Telegram Bot (Firebase App Hosting)

## 📝 Descripción General

Este proyecto implementa un backend en **Node.js + Express**, alojado en **Firebase App Hosting**, que actúa como puente entre un **bot de Telegram** (orquestado mediante n8n) y **Google Calendar**.

El propósito del backend es permitir que los usuarios autoricen el acceso a su Google Calendar mediante OAuth 2.0, y posteriormente, que n8n pueda crear, modificar, eliminar y consultar eventos del calendario de esos usuarios, utilizando endpoints seguros protegidos por API Key.

El sistema almacena tokens de acceso y refresco en Firestore y expone endpoints REST diseñados específicamente para automatizaciones.

---

## 📌 Endpoints

La URL base del backend corresponde al dominio asignado por Firebase App Hosting:

```
https://<tu-backend>.hosted.app
```

---

### 1. **GET /auth/initiate-google-calendar-auth**

Inicia el flujo OAuth 2.0 para vincular el Google Calendar del usuario.

**Método:** `GET`  
**Query Params:**
- `telegramUserId` (string)

**Ejemplo:**
```
GET /auth/initiate-google-calendar-auth?telegramUserId=123456789
```

**Respuesta:**
```json
{
  "login_url": "https://accounts.google.com/o/oauth2/auth?...",
  "firebaseUid": "telegram-123456789"
}
```

---

## 📅 Endpoints de Calendario (Protegidos con API Key)

Todos los endpoints `/api/*` requieren:

```
x-api-key: TU_API_KEY
```

---

### 2. **POST /api/create-calendar-event**

Crea un evento en el calendario del usuario.

**Body:**
```json
{
  "firebaseUid": "telegram-123456789",
  "eventDetails": {
    "summary": "Recordatorio",
    "description": "Descripción del evento",
    "start": { "dateTime": "...", "timeZone": "..." },
    "end": { "dateTime": "...", "timeZone": "..." }
  }
}
```

**Respuesta:**
```json
{
  "message": "Event created successfully!",
  "eventLink": "https://www.google.com/calendar/event?eid=...",
  "eventId": "abcdefg1234567890"
}
```

---

### 3. **PUT /api/update-calendar-event**

Actualiza un evento existente.

**Body:**
```json
{
  "firebaseUid": "telegram-123456789",
  "eventId": "abcdefg1234567890",
  "eventDetails": {
    "summary": "Nuevo título",
    "start": { "dateTime": "...", "timeZone": "..." },
    "end": { "dateTime": "...", "timeZone": "..." }
  }
}
```

**Respuesta:**
```json
{
  "message": "Event updated successfully!",
  "eventId": "abcdefg1234567890"
}
```

---

### 4. **DELETE /api/delete-calendar-event**

Elimina un evento del calendario del usuario.

**Body:**
```json
{
  "firebaseUid": "telegram-123456789",
  "eventId": "abcdefg1234567890"
}
```

**Respuesta:**
```json
{
  "message": "Event deleted successfully!",
  "eventId": "abcdefg1234567890"
}
```

---

### 5. **POST /api/check-event-at-time**

Verifica si existe un evento en un horario dado.

**Body:**
```json
{
  "firebaseUid": "telegram-123456789",
  "queryTime": "2025-12-05T09:00:00-08:00",
  "durationMinutes": 60
}
```

**Respuesta si existe evento:**
```json
{
  "exists": true,
  "message": "An event exists at/around the specified time.",
  "foundEvent": {
    "summary": "Reunión",
    "start": { "dateTime": "...", "timeZone": "..." },
    "end": { "dateTime": "...", "timeZone": "..." },
    "id": "eventId123"
  }
}
```

**Respuesta si no existe evento:**
```json
{
  "exists": false,
  "message": "No event found at/around the specified time."
}
```

---

## 🔐 Consideraciones de Seguridad

- Los endpoints `/api/*` están protegidos mediante API Key.
- Los refresh tokens se almacenan en Firestore.
- El backend sigue el principio de mínimo privilegio.
- Solo el backend debe acceder a los tokens almacenados en Firestore.

---

## 🛠 Tecnologías Utilizadas

- **Node.js + Express**
- **Firebase App Hosting**
- **Firebase Admin SDK**
- **Google APIs Node.js Client**
- **Google Auth Library**

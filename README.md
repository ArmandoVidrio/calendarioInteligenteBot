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
## 2. Endpoints

La URL base para todos los endpoints es el dominio de tu backend de App Hosting:
`https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app`

### `GET /auth/initiate-google-calendar-auth`

Inicia el flujo de autenticación OAuth de Google Calendar para un usuario.

*   **Descripción:** Este endpoint es llamado por n8n cuando se necesita que un usuario de Telegram autorice el acceso a su Google Calendar. Genera y devuelve una URL de consentimiento de Google. El usuario final debe visitar esta URL para otorgar los permisos necesarios.
*   **Método:** `GET`
*   **Query Parameters:**
    *   `telegramUserId` (string, requerido): El ID único del usuario de Telegram. Se utiliza para mapear al usuario de Firebase y almacenar su `refresh_token`.
*   **Request Ejemplo (desde n8n):**
    ```
    GET https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app/auth/initiate-google-calendar-auth?telegramUserId=123456789
    ```
*   **Response Ejemplo (JSON):**
    ```json
    {
      "login_url": "https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=YOUR_CLIENT_ID...&redirect_uri=https%3A%2F%2Fgoogle-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app%2Fauth%2Fgoogle-calendar-callback&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar&access_type=offline&prompt=consent&state=telegram-123456789",
      "firebaseUid": "telegram-123456789"
    }
    ```
*   **Notas:** Si el `telegramUserId` no tiene un Firebase UID asociado, se crea uno automáticamente en Firebase Authentication y se mapea en Firestore.

---

### Endpoints de API de Calendario (Protegidos con API Key)

Todos los siguientes endpoints (`/api/*`) están protegidos por un middleware de autenticación de API Key. Tu aplicación cliente (n8n) debe incluir un header `x-api-key` con el valor de tu `MY_N8N_SECRET_KEY` configurado en Secret Manager.

**Header Requerido:**
`x-api-key: TU_MY_N8N_SECRET_KEY`

### `POST /api/create-calendar-event`

Crea un nuevo evento en el calendario principal de Google del usuario.

*   **Descripción:** Recibe detalles de un evento y lo crea en el Google Calendar del `firebaseUid` especificado.
*   **Método:** `POST`
*   **Request Body (JSON):**
    *   `firebaseUid` (string, requerido): El ID de Firebase del usuario.
    *   `eventDetails` (object, requerido): Un objeto que sigue la estructura de un [recurso `Event` de la API de Google Calendar](https://developers.google.com/calendar/api/v3/reference/events#resource).
*   **Request Body Ejemplo:**
    ```json
    {
      "firebaseUid": "telegram-123456789",
      "eventDetails": {
        "summary": "Recordatorio: Enviar informe mensual",
        "description": "No olvides enviar el informe a final de mes a los stakeholders.",
        "start": {
          "dateTime": "2025-12-31T17:00:00-08:00",
          "timeZone": "America/Los_Angeles"
        },
        "end": {
          "dateTime": "2025-12-31T18:00:00-08:00",
          "timeZone": "America/Los_Angeles"
        },
        "reminders": {
          "useDefault": false,
          "overrides": [
            {"method": "email", "minutes": 24 * 60},
            {"method": "popup", "minutes": 60}
          ]
        }
      }
    }
    ```
*   **Response Ejemplo (JSON):**
    ```json
    {
      "message": "Event created successfully!",
      "eventLink": "https://www.google.com/calendar/event?eid=...",
      "eventId": "abcdefg1234567890abcdefg"
    }
    ```
*   **Notas:** El `eventId` devuelto es crucial si deseas actualizar o eliminar el evento más tarde.

### `PUT /api/update-calendar-event`

Modifica un evento existente en el calendario principal de Google del usuario.

*   **Descripción:** Actualiza los detalles de un evento específico en el Google Calendar del `firebaseUid` especificado.
*   **Método:** `PUT`
*   **Request Body (JSON):**
    *   `firebaseUid` (string, requerido): El ID de Firebase del usuario.
    *   `eventId` (string, requerido): El ID del evento de Google Calendar a actualizar.
    *   `eventDetails` (object, requerido): Un objeto `Event` con los campos a actualizar. Puedes enviar solo los campos que deseas cambiar.
*   **Request Body Ejemplo:**
    ```json
    {
      "firebaseUid": "telegram-123456789",
      "eventId": "abcdefg1234567890abcdefg",
      "eventDetails": {
        "summary": "Reunión de Equipo ACTUALIZADA",
        "location": "Sala de Conferencias B",
        "start": {
          "dateTime": "2025-12-05T10:00:00-08:00",
          "timeZone": "America/Los_Angeles"
        },
        "end": {
          "dateTime": "2025-12-05T11:00:00-08:00",
          "timeZone": "America/Los_Angeles"
        }
      }
    }
    ```
*   **Response Ejemplo (JSON):**
    ```json
    {
      "message": "Event updated successfully!",
      "eventLink": "https://www.google.com/calendar/event?eid=...",
      "eventId": "abcdefg1234567890abcdefg"
    }
    ```

### `DELETE /api/delete-calendar-event`

Elimina un evento del calendario principal de Google del usuario.

*   **Descripción:** Elimina un evento específico del Google Calendar del `firebaseUid` especificado.
*   **Método:** `DELETE`
*   **Request Body (JSON):**
    *   `firebaseUid` (string, requerido): El ID de Firebase del usuario.
    *   `eventId` (string, requerido): El ID del evento de Google Calendar a eliminar.
*   **Request Body Ejemplo:**
    ```json
    {
      "firebaseUid": "telegram-123456789",
      "eventId": "abcdefg1234567890abcdefg"
    }
    ```
*   **Response Ejemplo (JSON):**
    ```json
    {
      "message": "Event deleted successfully!",
      "eventId": "abcdefg1234567890abcdefg"
    }
    ```

### `GET /api/list-events-by-time`

Obtiene una lista de eventos dentro de un rango de tiempo específico en el calendario principal del usuario.

*   **Descripción:** Consulta el Google Calendar de un usuario para obtener todos los eventos que se superponen o caen completamente dentro del rango definido por `timeMin` y `timeMax`.
*   **Método:** `GET`
*   **Query Parameters:**
    *   `firebaseUid` (string, requerido): El ID de Firebase del usuario.
    *   `timeMin` (string, requerido): La fecha y hora de inicio del rango de búsqueda en formato [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) (ej. `"2025-12-05T08:00:00-08:00"`).
    *   `timeMax` (string, requerido): La fecha y hora de finalización del rango de búsqueda en formato [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) (ej. `"2025-12-05T12:00:00-08:00"`).
*   **Request Ejemplo:**
    ```
    GET https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app/api/list-events-by-time?firebaseUid=telegram-123456789&timeMin=2025-12-05T08:00:00-08:00&timeMax=2025-12-05T12:00:00-08:00
    ```
*   **Response Ejemplo (JSON - Eventos Encontrados):**
    ```json
    {
      "message": "Events retrieved successfully!",
      "events": [
        {
          "kind": "calendar#event",
          "id": "eventId1",
          "summary": "Reunión de equipo",
          "start": { "dateTime": "2025-12-05T08:30:00-08:00", "timeZone": "America/Los_Angeles" },
          "end": { "dateTime": "2025-12-05T09:30:00-08:00", "timeZone": "America/Los_Angeles" }
        },
        {
          "kind": "calendar#event",
          "id": "eventId2",
          "summary": "Presentación cliente",
          "start": { "dateTime": "2025-12-05T10:00:00-08:00", "timeZone": "America/Los_Angeles" },
          "end": { "dateTime": "2025-12-05T11:00:00-08:00", "timeZone": "America/Los_Angeles" }
        }
      ]
    }
    ```
*   **Response Ejemplo (JSON - No hay Eventos):**
    ```json
    {
      "message": "Events retrieved successfully!",
      "events": []
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

*   **Firebase App Hosting:** Plataforma de despliegue y gestión sobre Cloud Run.
*   **Node.js & Express:** Entorno de ejecución y framework web para el backend.
*   **Firebase Admin SDK:** Para interactuar con Firebase Authentication (creación/gestión de usuarios) y Cloud Firestore (almacenamiento de tokens).
*   **Google APIs Node.js Client (`googleapis`):** Librería oficial para interactuar con la API de Google Calendar.
*   **Google Auth Library (`google-auth-library`):** Gestión de la autenticación OAuth 2.0 con Google.
*   **`cors`:** Middleware para habilitar Cross-Origin Resource Sharing (CORS).
# Backend de Google Calendar para Telegram Bot (Firebase App Hosting)

## Descripción General del Proyecto

Este proyecto es un **backend robusto y scalable** alojado en Firebase App Hosting, diseñado para facilitar la interacción entre un bot de Telegram (gestionado a través de n8n) y los calendarios de Google de los usuarios. Su propósito principal es permitir que los usuarios de Telegram autoricen de forma segura el acceso a su Google Calendar, y posteriormente, que el bot pueda **crear, modificar, eliminar y consultar eventos** en sus calendarios de forma programática.

El backend gestiona el complejo flujo de autenticación OAuth 2.0 con Google Calendar, almacena de forma segura los tokens de acceso y refresco de los usuarios en Cloud Firestore, y expone una serie de **endpoints API protegidos por API Key** para que n8n pueda realizar operaciones en el calendario sin la intervención directa del usuario final. Esto crea un puente eficiente y seguro para integrar la funcionalidad de calendario de Google directamente en las conversaciones de Telegram.

## Tabla de Contenidos

1.  [Endpoints](#2-endpoints)
    *   [`GET /auth/initiate-google-calendar-auth`](#get-authinitiate-google-calendar-auth)
    *   [`POST /api/create-calendar-event`](#post-apicreate-calendar-event)
    *   [`PUT /api/update-calendar-event`](#put-apiupdate-calendar-event)
    *   [`DELETE /api/delete-calendar-event`](#delete-apidelete-calendar-event)
    *   [`GET /api/list-events-by-time`](#get-apilist-events-by-time)
2.  [Consideraciones de Seguridad](#3-consideraciones-de-seguridad)
3.  [Tecnologías Utilizadas](#4-tecnologías-utilizadas)


## 1. Endpoints

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
      "firebaseUid": "8269470160",
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

Modifica eventos existentes por título en el calendario principal de Google del usuario.

*   **Descripción:** Busca uno o varios eventos que coincidan exactamente con el `searchTitle` proporcionado y actualiza sus detalles con la información en `eventDetails`.
*   **Método:** `PUT`
*   **Request Body (JSON):**
    *   `firebaseUid` (string, requerido): El ID de Firebase del usuario.
    *   `searchTitle` (string, requerido): El título exacto del evento (o eventos) que deseas modificar. La búsqueda se realiza sin distinguir mayúsculas/minúsculas.
    *   `eventDetails` (object, requerido): Un objeto `Event` con los campos a actualizar. Puedes enviar solo los campos que deseas cambiar (ej. solo `start` para cambiar la hora).
*   **Request Body Ejemplo:**
    ```json
    {
      "firebaseUid": "8269470160",
      "searchTitle": "llamada demo",
      "eventDetails": {
        "start": {
          "dateTime": "2025-12-02T09:00:00-06:00",
          "timeZone": "America/Mexico_City"
        },
        "end": {
          "dateTime": "2025-12-02T10:00:00-06:00",
          "timeZone": "America/Mexico_City"
        },
        "summary": "Nueva Llamada Demo (Actualizada)"
      }
    }
    ```
*   **Response Ejemplo (JSON - Múltiples eventos actualizados):**
    ```json
    {
      "message": "2 events updated successfully!",
      "updatedEvents": [
        {
          "eventId": "eventId1_modificado",
          "eventLink": "https://www.google.com/calendar/event?eid=...",
          "summary": "Nueva Llamada Demo (Actualizada)",
          "status": "confirmed"
        },
        {
          "eventId": "eventId2_modificado",
          "eventLink": "https://www.google.com/calendar/event?eid=...",
          "summary": "Nueva Llamada Demo (Actualizada)",
          "status": "confirmed"
        }
      ]
    }
    ```
*   **Notas:** Si no se encuentran eventos que coincidan exactamente con el `searchTitle`, se devolverá un `404 Not Found`.

### `DELETE /api/delete-calendar-event`

Elimina eventos existentes por título del calendario principal de Google del usuario.

*   **Descripción:** Busca uno o varios eventos que coincidan exactamente con el `searchTitle` proporcionado y los elimina.
*   **Método:** `DELETE`
*   **Request Body (JSON):**
    *   `firebaseUid` (string, requerido): El ID de Firebase del usuario.
    *   `searchTitle` (string, requerido): El título exacto del evento (o eventos) que deseas eliminar. La búsqueda se realiza sin distinguir mayúsculas/minúsculas.
*   **Request Body Ejemplo:**
    ```json
    {
      "firebaseUid": "8269470160",
      "searchTitle": "llamada demo"
    }
    ```
*   **Response Ejemplo (JSON - Múltiples eventos eliminados):**
    ```json
    {
      "message": "2 events deleted successfully!",
      "deletedEvents": [
        {
          "eventId": "eventId1_eliminado",
          "summary": "llamada demo"
        },
        {
          "eventId": "eventId2_eliminado",
          "summary": "llamada demo"
        }
      ]
    }
    ```
*   **Notas:** Si no se encuentran eventos que coincidan exactamente con el `searchTitle`, se devolverá un `404 Not Found`.

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
    GET https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app/api/list-events-by-time?firebaseUid=8269470160&timeMin=2025-12-05T08:00:00-08:00&timeMax=2025-12-05T12:00:00-08:00
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

### `GET /api/user-exists`

Verifica si un usuario específico existe en la base de datos y ha autorizado Google Calendar.

*   **Descripción:** Consulta la base de datos para determinar si un `firebaseUid` dado corresponde a un usuario que ha completado el flujo de autorización de Google Calendar (es decir, tiene un `refresh_token` almacenado).
*   **Método:** `GET`
*   **Query Parameters:**
    *   `firebaseUid` (string, requerido): El ID de Firebase del usuario cuya existencia y autorización quieres verificar.
*   **Request Ejemplo:**
    ```
    GET https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app/api/user-exists?firebaseUid=8269470160
    ```
*   **Response Ejemplo (JSON - Usuario encontrado y autorizado):**
    ```json
    {
      "firebaseUid": "8269470160",
      "exists": true,
      "message": "User found and authorized for Google Calendar."
    }
    ```
*   **Response Ejemplo (JSON - Usuario no encontrado o no autorizado):**
    ```json
    {
      "firebaseUid": "OTRO_USUARIO",
      "exists": false,
      "message": "User not found or not authorized for Google Calendar."
    }
    ```
---

## 2. Consideraciones de Seguridad

*   **API Keys (`N8N_API_KEY`):** Es **fundamental** configurar `N8N_API_KEY` en Secret Manager y tu `apphosting.yaml` para proteger tus endpoints de API. Si no está configurada, el middleware `authenticateN8n` emitirá una advertencia y permitirá el acceso sin autenticación (solo para desarrollo/pruebas).
*   **Secret Manager:** Siempre almacena credenciales sensibles en Secret Manager y no directamente en tu código o repositorios Git.
*   **Principios de Mínimos Privilegios (Least Privilege):** La cuenta de servicio de tu backend (`firebase-app-hosting-compute@...`) debe tener solo los roles IAM mínimos necesarios para funcionar.
*   **Reglas de Seguridad de Firestore:** Protege tus colecciones `users` y `telegramUserMapping` en Firestore con reglas de seguridad estrictas para evitar el acceso no autorizado a los `refresh_token` y otros datos sensibles. Solo el Admin SDK de tu backend debería poder acceder a estos datos.

---

## 3. Tecnologías Utilizadas

*   **Firebase App Hosting:** Plataforma de despliegue y gestión sobre Cloud Run.
*   **Node.js & Express:** Entorno de ejecución y framework web para el backend.
*   **Firebase Admin SDK:** Para interactuar con Firebase Authentication (creación/gestión de usuarios) y Cloud Firestore (almacenamiento de tokens).
*   **Google APIs Node.js Client (`googleapis`):** Librería oficial para interactuar con la API de Google Calendar.
*   **Google Auth Library (`google-auth-library`):** Gestión de la autenticación OAuth 2.0 con Google.
*   **`cors`:** Middleware para habilitar Cross-Origin Resource Sharing (CORS).

---

# Backend de Google Calendar para Telegram Bot (Firebase App Hosting)

## Descripción General del Proyecto

Este proyecto es un **backend robusto y scalable** alojado en Firebase App Hosting, diseñado para facilitar la interacción entre un bot de Telegram (gestionado a través de n8n) y los calendarios de Google de los usuarios. Su propósito principal es permitir que los usuarios de Telegram autoricen de forma segura el acceso a su Google Calendar, y posteriormente, que el bot pueda **crear, modificar, eliminar y consultar eventos** en sus calendarios de forma programática.

El backend gestiona el complejo flujo de autenticación OAuth 2.0 con Google Calendar, almacena de forma segura los tokens de acceso y refresco de los usuarios en Cloud Firestore, y expone una serie de **endpoints API protegidos por API Key** para que n8n pueda realizar operaciones en el calendario sin la intervención directa del usuario final. Esto crea un puente eficiente y seguro para integrar la funcionalidad de calendario de Google directamente en las conversaciones de Telegram.

## Tabla de Contenidos

1.  [Configuración del Proyecto](#1-configuración-del-proyecto)
    *   [Google Cloud Project Setup](#google-cloud-project-setup)
    *   [Firebase App Hosting Setup](#firebase-app-hosting-setup)
    *   [Variables de Entorno y Secretos](#variables-de-entorno-y-secretos)
2.  [Endpoints](#2-endpoints)
    *   [`GET /auth/initiate-google-calendar-auth`](#get-authinitiate-google-calendar-auth)
    *   [`POST /api/create-calendar-event`](#post-apicreate-calendar-event)
    *   [`PUT /api/update-calendar-event`](#put-apiupdate-calendar-event)
    *   [`DELETE /api/delete-calendar-event`](#delete-apidelete-calendar-event)
    *   [`GET /api/list-events-by-time`](#get-apilist-events-by-time)
3.  [Consideraciones de Seguridad](#3-consideraciones-de-seguridad)
4.  [Tecnologías Utilizadas](#4-tecnologías-utilizadas)

---

## 1. Configuración del Proyecto

### Google Cloud Project Setup

1.  **Habilitar APIs:**
    Asegúrate de que las siguientes APIs estén habilitadas en tu proyecto de Google Cloud (`telegram-bot-ac92a`):
    *   `Google Calendar API`
    *   `Cloud Firestore API`
    *   `Identity Toolkit API` (para Firebase Authentication)
    *   `Cloud Secret Manager API`
    *   `Service Usage API`
    *   `Cloud Run API`

2.  **Configurar Credenciales OAuth 2.0:**
    *   Ve a [Google Cloud Console > APIs y servicios > Credenciales](https://console.cloud.google.com/apis/credentials).
    *   Crea un **"ID de cliente de OAuth"** de tipo **"Aplicación web"**.
    *   Anota el `ID de cliente` y el `Secreto de cliente` generados.
    *   En la sección **"URI de redireccionamiento autorizadas"**, agrega la siguiente URL:
        `https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app/auth/google-calendar-callback`
    *   No es necesario configurar "Orígenes de JavaScript autorizados" para este flujo.

3.  **Crear Instancia de Cloud Firestore:**
    *   Ve a [Firebase Console > Build > Firestore Database](https://console.firebase.google.com/project/telegram-bot-ac92a/firestore).
    *   Si aún no tienes una, haz clic en **"Crear base de datos"** y selecciona el modo de prueba y una ubicación. Esto es crucial para que `admin.firestore()` funcione.

4.  **Habilitar Firebase Authentication:**
    *   Ve a [Firebase Console > Build > Authentication](https://console.firebase.google.com/project/telegram-bot-ac92a/authentication).
    *   Haz clic en **"Comenzar"** para habilitar el servicio. No es necesario configurar proveedores de autenticación específicos para el uso con el Admin SDK.

5.  **Otorgar Permisos IAM Esenciales:**
    Asegúrate de que la cuenta de servicio que ejecuta tu backend en App Hosting tenga los permisos adecuados. La cuenta de servicio es `firebase-app-hosting-compute@telegram-bot-ac92a.iam.gserviceaccount.com`.
    *   Ve a [Google Cloud Console > IAM y administración > IAM](https://console.cloud.google.com/iam-admin/iam/project?project=telegram-bot-ac92a).
    *   Asegúrate de que `firebase-app-hosting-compute@telegram-bot-ac92a.iam.gserviceaccount.com` tenga el rol **`Consumidor de uso de servicio`** (`roles/serviceusage.serviceUsageConsumer`). Si no lo tiene, añádelo.

### Firebase App Hosting Setup

Este backend está diseñado para ser desplegado en Firebase App Hosting. Necesitarás un archivo `apphosting.yaml` en la raíz de tu proyecto para configurar las variables de entorno y los secretos.

### Variables de Entorno y Secretos

Para garantizar la seguridad, todas las credenciales sensibles (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `N8N_API_KEY`) deben almacenarse en **Google Cloud Secret Manager** y referenciarse desde tu `apphosting.yaml`.

1.  **Crea los Secretos en Secret Manager:**
    *   Ve a [Google Cloud Console > Secret Manager](https://console.cloud.google.com/security/secret-manager).
    *   Crea los siguientes secretos y asigna sus valores correspondientes:
        *   `GOOGLE_CLIENT_ID_SECRET`: Tu Client ID de OAuth.
        *   `CLIENT_SECRET_TELEGRAM_BOT`: Tu Client Secret de OAuth.
        *   `MY_N8N_SECRET_KEY`: Una cadena segura que usarás como API Key para autenticar las peticiones de n8n.
    *   **Asegúrate de que cada secreto tenga al menos una "versión" con el valor.**

2.  **Configura `apphosting.yaml`:**
    Tu archivo `apphosting.yaml` debe lucir así (reemplazando `672912123894` con el número de tu proyecto si fuera diferente, aunque ya está pre-configurado para tu proyecto):

    ```yaml
    runConfig:
      minInstances: 0
      maxInstances: 2

    env:
      - variable: GOOGLE_CLIENT_ID
        secret: projects/672912123894/secrets/GOOGLE_CLIENT_ID_SECRET
        availability:
          - RUNTIME

      - variable: GOOGLE_CLIENT_SECRET
        secret: projects/672912123894/secrets/CLIENT_SECRET_TELEGRAM_BOT
        availability:
          - RUNTIME

      - variable: GOOGLE_REDIRECT_URI
        value: https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app/auth/google-calendar-callback
        availability:
          - RUNTIME

      - variable: N8N_API_KEY
        secret: projects/672912123894/secrets/MY_N8N_SECRET_KEY
        availability:
          - RUNTIME
    ```

3.  **Otorga Acceso a Secret Manager:**
    Usa la CLI de Firebase para otorgar a tu backend de App Hosting acceso a estos secretos:
    ```bash
    firebase apphosting:secrets:grantaccess GOOGLE_CLIENT_ID_SECRET --backend google-auth-server-ds
    firebase apphosting:secrets:grantaccess CLIENT_SECRET_TELEGRAM_BOT --backend google-auth-server-ds
    firebase apphosting:secrets:grantaccess MY_N8N_SECRET_KEY --backend google-auth-server-ds
    ```

4.  **Despliegue:**
    Una vez configurado, haz `git commit` y `git push` a tu repositorio. Firebase App Hosting automáticamente construirá y desplegará tu backend.

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

## 3. Consideraciones de Seguridad

*   **API Keys (`N8N_API_KEY`):** Es **fundamental** configurar `N8N_API_KEY` en Secret Manager y tu `apphosting.yaml` para proteger tus endpoints de API. Si no está configurada, el middleware `authenticateN8n` emitirá una advertencia y permitirá el acceso sin autenticación (solo para desarrollo/pruebas).
*   **Secret Manager:** Siempre almacena credenciales sensibles en Secret Manager y no directamente en tu código o repositorios Git.
*   **Principios de Mínimos Privilegios (Least Privilege):** La cuenta de servicio de tu backend (`firebase-app-hosting-compute@...`) debe tener solo los roles IAM mínimos necesarios para funcionar.
*   **Reglas de Seguridad de Firestore:** Protege tus colecciones `users` y `telegramUserMapping` en Firestore con reglas de seguridad estrictas para evitar el acceso no autorizado a los `refresh_token` y otros datos sensibles. Solo el Admin SDK de tu backend debería poder acceder a estos datos.

---

## 4. Tecnologías Utilizadas

*   **Firebase App Hosting:** Plataforma de despliegue y gestión sobre Cloud Run.
*   **Node.js & Express:** Entorno de ejecución y framework web para el backend.
*   **Firebase Admin SDK:** Para interactuar con Firebase Authentication (creación/gestión de usuarios) y Cloud Firestore (almacenamiento de tokens).
*   **Google APIs Node.js Client (`googleapis`):** Librería oficial para interactuar con la API de Google Calendar.
*   **Google Auth Library (`google-auth-library`):** Gestión de la autenticación OAuth 2.0 con Google.
*   **`cors`:** Middleware para habilitar Cross-Origin Resource Sharing (CORS).

---

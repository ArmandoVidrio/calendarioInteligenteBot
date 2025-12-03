# Backend de Google Calendar para Telegram Bot (Firebase App Hosting)

Este repositorio contiene el backend de Node.js implementado con Express, diseñado para integrarse con un bot de Telegram (a través de n8n) y la API de Google Calendar. Permite a los usuarios autorizar el acceso a su Google Calendar, y al bot de Telegram (mediante n8n) crear, modificar, eliminar y consultar eventos en nombre de esos usuarios.
Está alojado en Firebase App Hosting utilizando Cloud Run, lo que proporciona escalabilidad y una integración nativa con otros servicios de Firebase y Google Cloud.

## Tabla de Contenidos

* Configuración del Proyecto
* Google Cloud Project Setup
* Firebase App Hosting Setup
* Variables de Entorno y Secretos
* Endpoints

  * GET /auth/initiate-google-calendar-auth
  * GET /auth/google-calendar-callback
  * POST /api/create-calendar-event
  * PUT /api/update-calendar-event
  * DELETE /api/delete-calendar-event
  * POST /api/check-event-at-time
* Consideraciones de Seguridad
* Tecnologías Utilizadas

---

## 1. Configuración del Proyecto

### Google Cloud Project Setup

#### Habilitar APIs

Asegúrate de que las siguientes APIs estén habilitadas en tu proyecto de Google Cloud (`telegram-bot-ac92a`):

* Google Calendar API
* Cloud Firestore API
* Identity Toolkit API (para Firebase Authentication)
* Cloud Secret Manager API
* Service Usage API
* Cloud Run API

#### Configurar Credenciales OAuth 2.0

1. Ve a **Google Cloud Console > APIs y servicios > Credenciales**.
2. Crea un **ID de cliente de OAuth** de tipo *Aplicación web*.
3. Guarda el *Client ID* y el *Client Secret*.
4. En *URIs de redireccionamiento autorizadas* agrega:

```
https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app/auth/google-calendar-callback
```

#### Crear Instancia de Cloud Firestore

Ve a **Firebase Console > Build > Firestore Database** y crea una base de datos si aún no existe.

#### Habilitar Firebase Authentication

Ve a **Firebase Console > Build > Authentication** y haz clic en *Comenzar*. No requiere proveedores adicionales.

#### Otorgar Permisos IAM Esenciales

Asegúrate de que la cuenta de servicio:

```
firebase-app-hosting-compute@telegram-bot-ac92a.iam.gserviceaccount.com
```

tenga el rol:

```
roles/serviceusage.serviceUsageConsumer
```

### Firebase App Hosting Setup

Este backend se despliega con Firebase App Hosting usando un `apphosting.yaml`.

---

## Variables de Entorno y Secretos

### Crear Secretos en Secret Manager

Crea los siguientes secretos:

* `GOOGLE_CLIENT_ID_SECRET`
* `CLIENT_SECRET_TELEGRAM_BOT`
* `MY_N8N_SECRET_KEY`

### Configurar `apphosting.yaml`

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

### Otorgar Acceso a los Secretos

```
firebase apphosting:secrets:grantaccess GOOGLE_CLIENT_ID_SECRET --backend google-auth-server-ds
firebase apphosting:secrets:grantaccess CLIENT_SECRET_TELEGRAM_BOT --backend google-auth-server-ds
firebase apphosting:secrets:grantaccess MY_N8N_SECRET_KEY --backend google-auth-server-ds
```

---

## 2. Endpoints

Base URL del backend:

```
https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app
```

---

### GET /auth/initiate-google-calendar-auth

Inicia el flujo OAuth y genera la URL de consentimiento de Google.

**Query params:**

* `telegramUserId` (string, requerido)

**Ejemplo:**

```
GET /auth/initiate-google-calendar-auth?telegramUserId=123456789
```

**Respuesta:**

```json
{
  "login_url": "https://accounts.google.com/...",
  "firebaseUid": "telegram-123456789"
}
```

---

### GET /auth/google-calendar-callback

Callback que recibe `code` y `state`, genera `access_token` + `refresh_token` y los almacena.

Respuesta: HTML simple indicando que el acceso fue otorgado.

---

## Endpoints protegidos (`/api/*`)

Requieren header:

```
x-api-key: TU_MY_N8N_SECRET_KEY
```

---

### POST /api/create-calendar-event

Crea un evento en el calendario del usuario.

**Body:**

```json
{
  "firebaseUid": "telegram-123456789",
  "eventDetails": { ... }
}
```

**Respuesta:**

```json
{
  "message": "Event created successfully!",
  "eventLink": "https://google.com/calendar/...",
  "eventId": "abcdefg123"
}
```

---

### PUT /api/update-calendar-event

Actualiza un evento existente.

**Body:**

```json
{
  "firebaseUid": "telegram-123456789",
  "eventId": "abcdefg123",
  "eventDetails": { ... }
}
```

---

### DELETE /api/delete-calendar-event

Elimina un evento.

**Body:**

```json
{
  "firebaseUid": "telegram-123456789",
  "eventId": "abcdefg123"
}
```

---

### POST /api/check-event-at-time

Verifica si existe un evento en una hora específica.

**Body:**

```json
{
  "firebaseUid": "telegram-123456789",
  "queryTime": "2025-12-05T09:00:00-08:00",
  "durationMinutes": 60
}
```

---

## 3. Consideraciones de Seguridad

* Usa siempre Secret Manager para credenciales.
* Protege Firestore con reglas estrictas.
* Limita permisos IAM.
* No expongas refresh tokens.

---

## 4. Tecnologías Utilizadas

* Firebase App Hosting
* Node.js & Express
* Firebase Admin SDK
* googleapis (Google Calendar API)
* google-auth-library
* Firestore
* Cloud Run
* cors

---

Fin del archivo README.

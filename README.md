# 📅 Telegram Google Calendar Bot (n8n + Node.js)

Este proyecto consta de dos partes principales: un **Bot de Telegram** (gestionado por n8n) que actúa como interfaz de usuario, y un **Backend en Firebase App Hosting** que maneja la lógica de autenticación, almacenamiento de tokens y sincronización con la API de Google Calendar.

---

## 🤖 Parte 1: Guía de Comandos (Telegram)

El bot utiliza procesamiento de lenguaje natural para interpretar fechas y horas. El separador de argumentos es `|`.

### 1. 📅 Agendar Eventos
Crea eventos nuevos. Si no especificas la hora de fin, se asigna **1 hora de duración**.

* **Opción Rápida:** `/agendar Título | Fecha Inicio`
    > *Ej:* `/agendar Gym | hoy a las 18:00`
* **Opción Completa:** `/agendar Título | Inicio | Fin`
    > *Ej:* `/agendar Reunión | mañana 9am | mañana 10:30am`
* **Opcionales:** Agrega `| Descripción: ...`, `| Ubicación: ...`, `| Asistentes: ...`
    > *Ej:* `/agendar Cena | viernes 20:00 | Ubicación: Centro`

### 2. 🔍 Modificar Eventos
Actualiza el horario o detalles sin borrar la información previa.

* **Mover horario:** `/modificar Título Exacto | Nueva Inicio`
    > *Ej:* `/modificar Gym | hoy 19:00`
* **Cambiar todo:** `/modificar Título | Inicio | Fin`
    > *Ej:* `/modificar Cena | hoy 20:00 | hoy 22:00`

### 3. 🗑️ Cancelar Eventos
Elimina un evento por título.
* **Comando:** `/cancelar Título del Evento`

### 4. 🗓️ Consultar Agenda
Lista eventos por día o rango.
* **Comandos:** `/checar hoy`, `/checar mañana`, `/checar 1 semana`, `/checar 15 dias`.

---

## ⚙️ Parte 2: Backend de Google Calendar (Firebase App Hosting)

### Descripción General

Este backend es **robusto y escalable**, diseñado para facilitar la interacción segura entre el bot y Google Calendar. Gestiona el flujo OAuth 2.0, almacena tokens en Firestore y expone una API REST protegida para realizar operaciones sin intervención del usuario.

### Tabla de Contenidos
1.  [Endpoints](#endpoints)
2.  [Consideraciones de Seguridad](#consideraciones-de-seguridad)
3.  [Tecnologías Utilizadas](#tecnologías-utilizadas)

---

### Endpoints

La URL base para todos los endpoints es el dominio de tu backend de App Hosting:
`https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app`

#### `GET /auth/initiate-google-calendar-auth`

Inicia el flujo de autenticación OAuth de Google Calendar para un usuario.

* **Descripción:** Llamado por n8n cuando un usuario necesita autorizar el acceso. Genera la URL de consentimiento.
* **Query Parameters:**
    * `telegramUserId` (string, requerido): ID de Telegram para mapear el `refresh_token`.
* **Response Ejemplo:**
    ```json
    {
      "login_url": "[https://accounts.google.com/](https://accounts.google.com/)...",
      "firebaseUid": "telegram-123456789"
    }
    ```

---

#### Endpoints de API de Calendario (Protegidos con API Key)

**Header Requerido:** `x-api-key: TU_MY_N8N_SECRET_KEY`

#### `POST /api/create-calendar-event`

Crea un nuevo evento en el calendario principal.

* **Request Body:**
    ```json
    {
      "firebaseUid": "8269470160",
      "eventDetails": {
        "summary": "Título del evento",
        "start": { "dateTime": "2025-12-31T17:00:00-08:00", "timeZone": "America/Mexico_City" },
        "end": { "dateTime": "2025-12-31T18:00:00-08:00", "timeZone": "America/Mexico_City" }
      }
    }
    ```

#### `PUT /api/update-calendar-event`

Modifica eventos existentes. Utiliza una **Estrategia de Búsqueda Híbrida** (Global + Escaneo Local) para asegurar que se encuentre el evento incluso si Google no lo ha indexado aún.

* **Descripción:** Busca eventos que coincidan con el `searchTitle`. Utiliza método `PATCH` para no sobrescribir datos no enviados.
* **Estrategia:** 1. Búsqueda Global (+/- 1 año). 2. Fallback Local (+/- 7 días de la fecha objetivo).
* **Request Body:**
    ```json
    {
      "firebaseUid": "8269470160",
      "searchTitle": "llamada demo",
      "eventDetails": {
        "start": { "dateTime": "2025-12-02T09:00:00-06:00" },
        "end": { "dateTime": "2025-12-02T10:00:00-06:00" }
      }
    }
    ```

#### `DELETE /api/delete-calendar-event`

Elimina eventos existentes por título. Implementa fallback de búsqueda en el futuro cercano para mayor robustez.

* **Estrategia:** 1. Búsqueda Global. 2. Fallback Escaneo próximos 3 meses.
* **Request Body:**
    ```json
    {
      "firebaseUid": "8269470160",
      "searchTitle": "llamada demo"
    }
    ```

#### `GET /api/list-events-by-time`

Obtiene una lista de eventos dentro de un rango de tiempo específico.

* **Query Parameters:**
    * `firebaseUid`: ID del usuario.
    * `timeMin`: ISO 8601 (ej. `2025-12-05T08:00:00-06:00`).
    * `timeMax`: ISO 8601.
* **Response Ejemplo:**
    ```json
    {
      "message": "Events retrieved successfully!",
      "events": [ ... ]
    }
    ```

#### `GET /api/user-exists`

Verifica si un usuario existe y está autorizado.

* **Query Parameters:** `firebaseUid`
* **Response:** `{ "exists": true, "message": "User found..." }`

---

### Consideraciones de Seguridad

* **API Keys:** El header `x-api-key` es obligatorio. Configura `N8N_API_KEY` en Google Cloud Secret Manager.
* **Firestore:** Los `refresh_token` están protegidos por reglas de seguridad que impiden el acceso público.
* **Mínimos Privilegios:** La cuenta de servicio solo tiene permisos de ejecución y lectura de base de datos necesarios.

### Tecnologías Utilizadas

* **Firebase App Hosting** (Cloud Run).
* **Node.js & Express**.
* **Firebase Admin SDK** (Auth & Firestore).
* **Google Calendar API v3** (`googleapis`).
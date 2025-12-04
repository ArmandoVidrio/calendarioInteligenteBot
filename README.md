# 📅 Telegram Google Calendar Bot (n8n + Node.js)

Este proyecto consta de dos partes principales: un **Bot de Telegram** (gestionado por n8n) que actúa como interfaz de usuario, y un **Backend en Firebase App Hosting** que maneja la lógica de autenticación, almacenamiento de tokens y sincronización con la API de Google Calendar.

---

## 🤖 Parte 1: Guía de Comandos (Telegram)

El bot utiliza un motor de procesamiento de lenguaje natural avanzado. Los comandos empiezan con `/` y los argumentos se separan con una barra vertical `|`.

### 🧠 Formatos de Fecha y Hora Soportados
El bot es flexible y entiende lenguaje natural. Puedes escribir fechas de las siguientes formas:

| Tipo | Formato Aceptado | Ejemplo Real |
| :--- | :--- | :--- |
| **Relativo** | `hoy`, `mañana` | `hoy a las 18:00` |
| **Formal** | `Día de Mes` | `4 de diciembre` |
| **Corto** | `Día Mes` (Sin "de") | `4 diciembre`, `25 enero` |
| **Con Año** | `Día Mes Año` | `4 diciembre 2025` |
| **Hora 24h** | `HH:MM` | `18:00`, `14:30` |
| **Hora 12h** | `am`, `pm` | `6pm`, `9:30 am`, `10 AM` |

> **Nota:** Si la fecha ya pasó, el bot intentará agendarla para el próximo año automáticamente, a menos que sea el mismo día de hoy.

---

### 1. 📅 Agendar Eventos (`/agendar`)

#### A) Agendar Rápido (1 hora por defecto)
Solo necesitas el título y la fecha de inicio.
* **Sintaxis:** `/agendar [Título] | [Fecha Inicio]`
* **Ejemplos Válidos:**
    * `/agendar Gym | hoy 18:00`
    * `/agendar Cita Dentista | mañana 10am`
    * `/agendar Cena | 24 diciembre 8pm`
    * `/agendar Reunión | 4 de enero a las 15:00`

#### B) Agendar Completo (Inicio y Fin)
Define exactamente cuándo empieza y cuándo termina.
* **Sintaxis:** `/agendar [Título] | [Inicio] | [Fin]`
* **Ejemplos Válidos:**
    * `/agendar Taller | hoy 10:00 | hoy 12:00`
    * `/agendar Viaje | 5 febrero 8am | 7 febrero 8pm`

#### C) Agendar con Detalles (Opcionales)
Puedes agregar `Descripción`, `Ubicación` y `Asistentes` al final de cualquier comando anterior, en cualquier orden.
* **Sintaxis:** `... | Ubicación: [Lugar] | Descripción: [Texto] | Asistentes: [Emails]`
* **Ejemplo Pro:**
    * `/agendar Junta | mañana 9am | Ubicación: Sala 1 | Descripción: Revisar Q1 | Asistentes: jefe@mail.com, ana@mail.com`

---

### 2. 🔍 Modificar Eventos (`/modificar`)

Busca un evento por su título (o parte de él) y lo actualiza.

#### A) Mover Horario (Rápido)
Mueve el evento a una nueva hora y ajusta su duración a 1 hora.
* **Sintaxis:** `/modificar [Título Actual] | [Nueva Fecha Inicio]`
* **Ejemplos:**
    * `/modificar Gym | hoy 19:00` *(Mueve el evento "Gym" a las 7pm)*
    * `/modificar Cita | mañana 11am`

#### B) Reagendar Completo
Cambia la hora de inicio y fin.
* **Sintaxis:** `/modificar [Título Actual] | [Inicio] | [Fin]`
* **Ejemplo:**
    * `/modificar Cena Equipo | viernes 20:00 | viernes 23:00`

#### C) Actualizar Detalles
También puedes usar este comando para agregar información sin cambiar la hora (poniendo la misma hora) o cambiando la hora y agregando datos.
* **Ejemplo:**
    * `/modificar Reunión | hoy 10am | Ubicación: Sala Virtual (Link Zoom)`

---

### 3. 🗑️ Cancelar Eventos (`/cancelar`)

Elimina un evento buscando por su título exacto.
* **Sintaxis:** `/cancelar [Título del Evento]`
* **Ejemplos:**
    * `/cancelar Gym`
    * `/cancelar Cita con el Dr`

---

### 4. 🗓️ Consultar Agenda (`/checar`)

Revisa qué tienes programado. Soporta días específicos o rangos de tiempo naturales.

#### A) Por Día Específico
* **Sintaxis:** `/checar [Día]`
* **Ejemplos:**
    * `/checar hoy`
    * `/checar mañana`
    * `/checar 24 de diciembre`
    * `/checar 1 enero`

#### B) Por Rango de Tiempo
Calcula automáticamente desde el inicio del día de hoy hasta X tiempo en el futuro.
* **Sintaxis:** `/checar [Número] [Unidad]`
* **Unidades aceptadas:** `dia`, `dias`, `semana`, `semanas`, `mes`.
* **Ejemplos:**
    * `/checar 1 semana` *(Muestra los próximos 7 días)*
    * `/checar 15 dias`
    * `/checar 3 dias`
    * `/checar 1 mes`

---

## ⚙️ Parte 2: Backend de Google Calendar (Firebase App Hosting)

### Descripción General

Este backend es **robusto y escalable**, diseñado para facilitar la interacción segura entre el bot y Google Calendar. Gestiona el flujo OAuth 2.0, almacena tokens en Firestore y expone una API REST protegida.

### Tabla de Contenidos
1.  [Endpoints](#endpoints)
2.  [Consideraciones de Seguridad](#consideraciones-de-seguridad)
3.  [Tecnologías Utilizadas](#tecnologías-utilizadas)

---

### Endpoints

La URL base para todos los endpoints es el dominio de tu backend de App Hosting:
`https://google-auth-server-ds--telegram-bot-ac92a.us-central1.hosted.app`

#### `GET /auth/initiate-google-calendar-auth`
Inicia el flujo de autenticación OAuth de Google Calendar.
* **Query Parameters:** `telegramUserId`

---

#### Endpoints de API de Calendario (Protegidos con API Key)
**Header Requerido:** `x-api-key: TU_MY_N8N_SECRET_KEY`

#### `POST /api/create-calendar-event`
Crea un nuevo evento.
* **Body:** `{ firebaseUid, eventDetails: { summary, start, end, ... } }`

#### `PUT /api/update-calendar-event`
Modifica eventos existentes.
* **Estrategia Híbrida:** 1. Búsqueda Global (+/- 1 año). 2. Fallback Local (+/- 7 días).
* **Body:** `{ firebaseUid, searchTitle, eventDetails }`

#### `DELETE /api/delete-calendar-event`
Elimina eventos por título.
* **Estrategia Híbrida:** 1. Búsqueda Global. 2. Fallback Escaneo próximos 3 meses.
* **Body:** `{ firebaseUid, searchTitle }`

#### `GET /api/list-events-by-time`
Obtiene una lista de eventos dentro de un rango de tiempo.
* **Query Parameters:** `firebaseUid`, `timeMin` (ISO), `timeMax` (ISO).

#### `GET /api/user-exists`
Verifica si un usuario existe y está autorizado.
* **Query Parameters:** `firebaseUid`

---

### Consideraciones de Seguridad
* **API Keys:** Header `x-api-key` obligatorio.
* **Firestore:** Tokens protegidos por reglas de seguridad.
* **Mínimos Privilegios:** Service account restringida.

### Tecnologías Utilizadas
* **Firebase App Hosting** (Cloud Run).
* **Node.js & Express**.
* **Firebase Admin SDK**.
* **Google Calendar API v3**.
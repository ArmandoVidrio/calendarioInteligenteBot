# 📅 Asistente Inteligente de Calendario (Telegram Bot + Google Calendar)

## 1. Descripción General del Proyecto

### Resumen
Este proyecto es un **asistente personal automatizado** que integra la mensajería instantánea de Telegram con la potencia de Google Calendar API. Su objetivo es eliminar la fricción administrativa de la gestión del tiempo, permitiendo a los usuarios interactuar con su agenda mediante **comandos de lenguaje natural en español** (ej. *"agendar cita mañana a las 5pm"*), sin necesidad de abrir interfaces gráficas complejas.
> **Nota:** Consultar [Guia de uso](Guia_de_uso.md) para mas información sobre los comandos que el ChatBot acepta.

### Declaración del Problema
Hoy en día, la coordinación de reuniones ocurre en el chat, pero el registro sucede en aplicaciones de calendario externas. Este cambio de contexto genera fricción, olvidos y errores humanos al transcribir fechas. Este sistema resuelve:
* **Fricción Operativa:** Elimina los múltiples clics necesarios para crear un evento.
* **Ambigüedad Temporal:** Interpreta frases como "el próximo viernes" automáticamente.
* **Sincronización:** Permite consultar disponibilidad en tiempo real sin salir del chat.

---

## 2. Arquitectura del Sistema

El sistema utiliza una arquitectura híbrida y desacoplada:

1.  **Interfaz (Telegram):** Capa de presentación.
2.  **Orquestador (n8n):** Middleware encargado del Procesamiento de Lenguaje Natural (NLP) y la normalización de fechas a la zona horaria `America/Mexico_City`.
3.  **Backend (Firebase App Hosting):** Servidor Node.js/Express que gestiona la lógica de negocio, la seguridad (OAuth 2.0) y la persistencia de datos.
4.  **Persistencia (Firestore):** Base de datos NoSQL para tokens de acceso y mapeo de usuarios.

### Diagrama C1: Contexto del Sistema
* **Usuario Final** -> interactúa con -> **Telegram**.
* **Telegram** -> envía Webhook a -> **Sistema (Bot)**.
* **Sistema (Bot)** -> lee/escribe en -> **Google Calendar API**.

---

## 3. Guía de Usuario (Comandos)

El bot utiliza el separador `|` para distinguir parámetros.

### 🧠 Formatos de Fecha Soportados
| Tipo | Ejemplo |
| :--- | :--- |
| **Relativo** | `hoy`, `mañana` |
| **Formal** | `4 de diciembre` |
| **Informal** | `4 dic`, `25 enero` |
| **Hora** | `18:00`, `6pm`, `9 am` |

### 📅 3.1. Agendar Eventos (`/agendar`)
* **Rápido (1h por defecto):** `/agendar Gym | hoy 18:00`
* **Completo:** `/agendar Reunión | mañana 9am | mañana 10:30am`
* **Con Detalles:** `/agendar Cena | hoy 8pm | Ubicación: Centro | Descripción: No olvidar regalo`

### 🔍 3.2. Modificar Eventos (`/modificar`)
* **Mover Horario:** `/modificar Gym | hoy 19:00`
* **Reagendar:** `/modificar Cena | viernes 20:00 | viernes 23:00`
* **Actualizar Datos:** `/modificar Cita | hoy 5pm | Ubicación: Consultorio 2`

### 🗑️ 3.3. Cancelar Eventos (`/cancelar`)
* **Comando:** `/cancelar Título del Evento`
    * *Nota:* Requiere el nombre exacto del evento.

### 🗓️ 3.4. Consultar Agenda (`/checar`)
* **Tiempo Real:** `/checar hoy` (Muestra solo eventos pendientes del día).
* **Día Completo:** `/checar mañana`.
* **Rangos:** `/checar 1 semana`, `/checar 3 dias`, `/checar 1 mes`.

### 🆘 3.5. Ayuda y Navegación
* **Inicio:** `/start` (Mensaje de bienvenida y verificación de cuenta).
* **Manual:** `/help` (Guía de sintaxis y ejemplos).

---

## 4. Documentación Técnica (API Backend)

La URL base es el dominio de Firebase App Hosting. Todos los endpoints privados requieren el header `x-api-key`.

### 🔐 Autenticación (OAuth 2.0)
* **`GET /auth/initiate-google-calendar-auth`**
    * Inicia el flujo de vinculación. Genera la URL de consentimiento de Google.
    * *Query:* `telegramUserId`

### 📡 Endpoints de Calendario

#### `POST /api/create-calendar-event`
Crea un evento nuevo.
* **Body:** `{ firebaseUid, eventDetails }`
* **Lógica:** Asigna duración de 60 min si falta `end.dateTime`.

#### `PUT /api/update-calendar-event`
Modifica eventos usando **Búsqueda Híbrida** para resiliencia.
* **Body:** `{ firebaseUid, searchTitle, eventDetails }`
* **Estrategia:**
    1.  Búsqueda Global (`q` parameter).
    2.  Fallback Local (Escaneo +/- 7 días) si la indexación falla.
* **Método:** `PATCH` (No sobrescribe datos no enviados).

#### `DELETE /api/delete-calendar-event`
Elimina eventos por título.
* **Body:** `{ firebaseUid, searchTitle }`
* **Estrategia:** Búsqueda Global + Fallback Futuro (3 meses).

#### `GET /api/list-events-by-time`
Lista eventos en rango ISO.
* **Query:** `firebaseUid`, `timeMin`, `timeMax`.

#### `GET /api/user-exists`
Verifica estado del usuario.
* **Query:** `firebaseUid`.

---

## 5. Requerimientos del Sistema

### Funcionales (RF)
1.  **Gestión de Identidad:** Vinculación segura Telegram-Google sin almacenar contraseñas.
2.  **NLP:** Interpretación de fechas relativas y normalización a `UTC-6`.
3.  **Consulta Contextual:** Filtrado inteligente de eventos pasados al consultar "hoy".
4.  **Resiliencia:** Algoritmos de búsqueda híbrida para mitigar latencia de Google API.

### No Funcionales (RNF)
1.  **Seguridad:** Protección de API con Keys y Firestore con reglas estrictas (`allow read, write: if false`).
2.  **Disponibilidad:** Infraestructura Serverless (99.5% Uptime).
3.  **Usabilidad:** Retroalimentación clara de errores al usuario en menos de 3 segundos.
4.  **Portabilidad:** Despliegue automatizado en contenedores gestionados (Firebase).

---

## 6. Stack Tecnológico

* **Lenguaje:** Node.js (Express Framework).
* **Orquestador:** n8n (Docker/Cloud).
* **Base de Datos:** Google Cloud Firestore.
* **Infraestructura:** Firebase App Hosting (Cloud Run).
* **Integraciones:** Telegram Bot API, Google Calendar API v3.
# --- Estados del Diálogo (Para atributos de sesión) ---
DIALOG_STATE = "dialogState"
STATE_MENU_SELECTION = "MENU_SELECTION"
STATE_CREATE_EVENT_NAME = "CREATE_EVENT_NAME"
STATE_CREATE_EVENT_DATE = "CREATE_EVENT_DATE"
STATE_CREATE_EVENT_TIME = "CREATE_EVENT_TIME"
STATE_QUERY_CRITERIA = "QUERY_CRITERIA"
STATE_QUERY_NAME_VALUE = "QUERY_NAME_VALUE"
STATE_QUERY_DATE_VALUE = "QUERY_DATE_VALUE"
STATE_MODIFY_EVENT_NAME = "MODIFY_EVENT_NAME"
STATE_MODIFY_EVENT_FIELD = "MODIFY_EVENT_FIELD"
STATE_MODIFY_NEW_VALUE = "MODIFY_NEW_VALUE"
STATE_CANCEL_EVENT_NAME = "CANCEL_EVENT_NAME"

# --- Mensajes de Voz (SSML) ---
WELCOME_MESSAGE = "¡Hola! Bienvenido a tu biblioteca inteligente. ¿Deseas programar un evento, escuchar los recordatorios del día, escuchar un recordatorio específico o cancelar o modificar uno existente?"
REPROMPT_MENU = "Puedes agendar un evento, escuchar los recordatorios del día, consultar un recordatorio específico, modificar un evento, o cancelar un evento. ¿Qué deseas hacer?"
ASK_EVENT_NAME = "Claro, ¿cuál será el nombre de tu evento?"
ASK_EVENT_DATE = "Perfecto, agendaremos {}. ¿Para qué fecha lo quieres?"
ASK_EVENT_TIME = "Muy bien, el {}. ¿A qué hora lo agendo?"
ASK_FULL_DESCRIPTION = "¿Desea saber la descripción completa de alguno de estos eventos o recordatorios?"
ASK_EVENT_TO_DESCRIBE = "¿Cuál es el nombre del evento del que le gustaría saber más?"
ASK_MODIFICATION_FIELD = "Perfecto, del evento {}. ¿Qué te gustaría modificar: El nombre del evento, la fecha, o el horario?"
ASK_NEW_VALUE = "Muy bien, dime cómo quieres actualizarlo."
PROMPT_FINAL_MENU = "¿Quieres hacer algo más? " + REPROMPT_MENU

# Errores y Alertas
AUTH_REQUIRED_ERROR = "Necesito que vincules tu cuenta de Microsoft Outlook para acceder a tu calendario. Por favor, revisa la tarjeta en tu aplicación Alexa para vincular tu cuenta."
API_GENERIC_ERROR = "Lo siento, hubo un problema al comunicarme con Outlook. Por favor, inténtalo de nuevo más tarde."
EVENT_NOT_FOUND_RETRY = "No encontré el evento {}. ¿Desea intentarlo de nuevo o desea parar?"
UNEXPECTED_INPUT = "Lo siento, no entendí. Por favor, dime una de las opciones."
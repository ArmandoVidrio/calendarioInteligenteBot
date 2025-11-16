# handlers/query_and_read_handlers.py
from ask_sdk_core.dispatch_components import AbstractRequestHandler
from ask_sdk_core.utils import is_intent_name
from ask_sdk_model.ui import LinkAccountCard
from utils.constants import *
from services.outlook_service import OutlookService
import datetime

# --- Lógica de Lectura Diaria ---

class ReadDailyEventsIntentHandler(AbstractRequestHandler):
    """Maneja 'Escuchar mis recordatorios del día'."""
    # Este handler se invoca desde MenuSelectionIntentHandler para simplificar el flujo.
    def can_handle(self, handler_input):
        return is_intent_name("ReadDailyEventsIntent")(handler_input)

    async def handle(self, handler_input):
        outlook_service = OutlookService(handler_input)
        today = datetime.date.today().isoformat()
        attributes = handler_input.attributes_manager.get_session_attributes()
        
        speak_output = ""
        try:
            events = await outlook_service.get_events_by_date(today)
            
            if not events:
                speak_output = "Hoy no tienes recordatorios pendientes. " + PROMPT_FINAL_MENU
                attributes[DIALOG_STATE] = STATE_MENU_SELECTION
            else:
                event_names = [event.get('subject') for event in events]
                event_list = ", ".join(event_names)
                
                speak_output = f"Claro, estos son tus recordatorios de hoy: {event_list}. {ASK_FULL_DESCRIPTION}"
                
                # Guardamos los eventos para la siguiente pregunta
                attributes['daily_events'] = events
                attributes[DIALOG_STATE] = 'ASKING_FULL_DESCRIPTION'
            
        except Exception as e:
            if str(e) == 'AUTH_REQUIRED':
                speak_output = AUTH_REQUIRED_ERROR
                return handler_input.response_builder.speak(speak_output).set_card(LinkAccountCard()).response
            else:
                speak_output = API_GENERIC_ERROR
                attributes[DIALOG_STATE] = STATE_MENU_SELECTION

        handler_input.attributes_manager.set_session_attributes(attributes)
        return handler_input.response_builder.speak(speak_output).ask(REPROMPT_MENU).response


class DescribeEventIntentHandler(AbstractRequestHandler):
    """Maneja la respuesta 'Si' a la descripción del evento."""
    def can_handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        return (is_intent_name("ConfirmOrDenyIntent")(handler_input) or is_intent_name("CreateEventIntent")(handler_input)) and \
               attributes.get(DIALOG_STATE) == 'ASKING_FULL_DESCRIPTION'

    def handle(self, handler_input):
        intent_name = handler_input.request_envelope.request.intent.name
        attributes = handler_input.attributes_manager.get_session_attributes()
        
        if is_intent_name("ConfirmOrDenyIntent")(handler_input) and handler_input.request_envelope.request.intent.slots.get('Confirmation').value == 'no':
            # Usuario dice NO, regresa al menú
            attributes.pop('daily_events', None)
            attributes[DIALOG_STATE] = STATE_MENU_SELECTION
            handler_input.attributes_manager.set_session_attributes(attributes)
            return handler_input.response_builder.speak(PROMPT_FINAL_MENU).ask(REPROMPT_MENU).response
        
        # El usuario dijo SI o dio el nombre del evento
        
        # Si la respuesta es SI, preguntamos el nombre
        if is_intent_name("ConfirmOrDenyIntent")(handler_input):
            speak_output = ASK_EVENT_TO_DESCRIBE
            attributes[DIALOG_STATE] = 'AWAITING_EVENT_NAME'
            handler_input.attributes_manager.set_session_attributes(attributes)
            return handler_input.response_builder.speak(speak_output).ask(speak_output).response

        # Si el usuario ya da el nombre (usando CreateEventIntent, que tiene slot de nombre)
        elif is_intent_name("CreateEventIntent")(handler_input):
            return self._describe_event_logic(handler_input)
            
    
    def _describe_event_logic(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        event_name_slot = handler_input.request_envelope.request.intent.slots.get('EventName')
        event_name = event_name_slot.value if event_name_slot else None
        
        daily_events = attributes.get('daily_events', [])
        found_event = next((e for e in daily_events if e.get('subject').lower() == event_name.lower()), None)
        
        if found_event:
            start_time = found_event.get('start', {}).get('dateTime').split('T')[1].split(':')[0:2]
            start_date = found_event.get('start', {}).get('dateTime').split('T')[0]
            speak_output = f"Claro. El evento {found_event.get('subject')} es el {start_date}, a las {start_time[0]} con {start_time[1]} minutos. ¿Desea la descripción completa de algún otro evento?"
        else:
            speak_output = f"No encontré un evento llamado {event_name} en tus recordatorios de hoy. ¿Desea la descripción completa de algún otro evento?"

        attributes[DIALOG_STATE] = 'ASKING_FULL_DESCRIPTION'
        handler_input.attributes_manager.set_session_attributes(attributes)
        
        return handler_input.response_builder.speak(speak_output).ask(ASK_FULL_DESCRIPTION).response

# --- Lógica de Consulta Específica (QuerySpecificReminderIntent) ---
# Implementar SearchCriteriaIntentHandler, SearchValueIntentHandler, etc.
# Siguiendo el mismo patrón de estados: QUERY_CRITERIA -> QUERY_DATE_VALUE -> FINAL_QUERY
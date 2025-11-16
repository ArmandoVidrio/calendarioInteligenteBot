# handlers/modify_and_cancel_handlers.py
from ask_sdk_core.dispatch_components import AbstractRequestHandler
from ask_sdk_core.utils import is_intent_name
from ask_sdk_model.ui import LinkAccountCard
from utils.constants import *
from services.outlook_service import OutlookService
import datetime

# Helper para buscar evento (usado en modificar y cancelar)
async def _find_and_store_event(handler_input, event_name_slot):
    outlook_service = OutlookService(handler_input)
    event_name = event_name_slot.value
    
    event = await outlook_service.find_event(event_name)
    
    if event:
        # Guardar detalles del evento en sesión
        attributes = handler_input.attributes_manager.get_session_attributes()
        attributes['target_event_id'] = event.get('id')
        attributes['target_event_name'] = event.get('subject')
        attributes['old_data'] = {
            'nombre': event.get('subject'),
            'fecha': event.get('start', {}).get('dateTime').split('T')[0],
            'horario': event.get('start', {}).get('dateTime').split('T')[1].split(':00')[0]
        }
        handler_input.attributes_manager.set_session_attributes(attributes)
        return event
    return None

# --- CANCELAR EVENTO ---

class CancelEventStartIntentHandler(AbstractRequestHandler):
    """Maneja el inicio de la cancelación de un evento."""
    def can_handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        return (is_intent_name("CancelEventIntent")(handler_input) and 
                attributes.get(DIALOG_STATE) == STATE_CANCEL_EVENT_NAME)

    async def handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        outlook_service = OutlookService(handler_input)
        event_name_slot = handler_input.request_envelope.request.intent.slots.get('EventToCancel')
        
        speak_output = ""
        try:
            event = await _find_and_store_event(handler_input, event_name_slot)
            
            if event:
                event_id = attributes.get('target_event_id')
                await outlook_service.delete_event(event_id)
                speak_output = f"Se ha cancelado el evento {event.get('subject')}. {PROMPT_FINAL_MENU}"
                
            else:
                # No encontrado, preguntar si desea reintentar
                speak_output = EVENT_NOT_FOUND_RETRY.format(event_name_slot.value)
                attributes['last_action'] = 'CANCEL'
                attributes[DIALOG_STATE] = 'AWAITING_RETRY_CONFIRMATION'
                handler_input.attributes_manager.set_session_attributes(attributes)
                return handler_input.response_builder.speak(speak_output).ask(speak_output).response

        except Exception as e:
            if str(e) == 'AUTH_REQUIRED':
                speak_output = AUTH_REQUIRED_ERROR
                return handler_input.response_builder.speak(speak_output).set_card(LinkAccountCard()).response
            else:
                speak_output = API_GENERIC_ERROR

        # Finalizar y regresar al menú
        attributes[DIALOG_STATE] = STATE_MENU_SELECTION
        handler_input.attributes_manager.set_session_attributes(attributes)
        return handler_input.response_builder.speak(speak_output).ask(REPROMPT_MENU).response


# --- MODIFICAR EVENTO ---

class ModifyEventStartIntentHandler(AbstractRequestHandler):
    """Maneja el inicio de la modificación de un evento."""
    def can_handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        return (is_intent_name("ModifyStartIntent")(handler_input) and 
                attributes.get(DIALOG_STATE) == STATE_MODIFY_EVENT_NAME)

    async def handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        event_name_slot = handler_input.request_envelope.request.intent.slots.get('OldEventName')
        
        try:
            event = await _find_and_store_event(handler_input, event_name_slot)
            
            if event:
                event_name = event.get('subject')
                speak_output = ASK_MODIFICATION_FIELD.format(event_name)
                attributes[DIALOG_STATE] = STATE_MODIFY_EVENT_FIELD
                handler_input.attributes_manager.set_session_attributes(attributes)
                return handler_input.response_builder.speak(speak_output).ask(speak_output).response
            else:
                speak_output = EVENT_NOT_FOUND_RETRY.format(event_name_slot.value)
                attributes['last_action'] = 'MODIFY'
                attributes[DIALOG_STATE] = 'AWAITING_RETRY_CONFIRMATION'
                handler_input.attributes_manager.set_session_attributes(attributes)
                return handler_input.response_builder.speak(speak_output).ask(speak_output).response

        except Exception as e:
            # Manejo de error o AUTH_REQUIRED
            # ... (Lógica similar a CancelEventStartIntentHandler) ...
            speak_output = API_GENERIC_ERROR
            attributes[DIALOG_STATE] = STATE_MENU_SELECTION
            return handler_input.response_builder.speak(speak_output).ask(REPROMPT_MENU).response
            
# (Clases para SelectModificationFieldIntentHandler, NewValueIntentHandler y ConfirmOrDenyIntentHandler para reintento van aquí)
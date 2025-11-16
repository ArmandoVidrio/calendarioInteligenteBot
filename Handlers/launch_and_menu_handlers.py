# handlers/launch_and_menu_handlers.py
from ask_sdk_core.dispatch_components import AbstractRequestHandler
from ask_sdk_core.utils import is_request_type, is_intent_name
from ask_sdk_model.ui import LinkAccountCard
from utils.constants import *
from services.outlook_service import OutlookService

class LaunchRequestHandler(AbstractRequestHandler):
    """Maneja la invocación de la Skill."""
    def can_handle(self, handler_input):
        return is_request_type("LaunchRequest")(handler_input)

    async def handle(self, handler_input):
        outlook_service = OutlookService(handler_input)
        access_token = await outlook_service.get_access_token()
        
        attributes = handler_input.attributes_manager.get_session_attributes()
        
        if not access_token:
            speak_output = AUTH_REQUIRED_ERROR
            return (
                handler_input.response_builder
                    .speak(speak_output)
                    .set_card(LinkAccountCard())
                    .response
            )
        else:
            attributes[DIALOG_STATE] = STATE_MENU_SELECTION
            handler_input.attributes_manager.set_session_attributes(attributes)
            
            return (
                handler_input.response_builder
                    .speak(WELCOME_MESSAGE)
                    .ask(REPROMPT_MENU)
                    .response
            )

class MenuSelectionIntentHandler(AbstractRequestHandler):
    """Maneja la selección de las 5 opciones principales del menú."""
    def can_handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        return (is_intent_name("MenuSelectionIntent")(handler_input) and
                attributes.get(DIALOG_STATE) == STATE_MENU_SELECTION)

    def handle(self, handler_input):
        intent = handler_input.request_envelope.request.intent
        option = intent.slots.get('OptionType').value
        attributes = handler_input.attributes_manager.get_session_attributes()
        
        speak_output = UNEXPECTED_INPUT
        next_state = STATE_MENU_SELECTION
        
        # Limpiamos atributos temporales antes de iniciar un nuevo flujo
        attributes = {DIALOG_STATE: STATE_MENU_SELECTION}

        if option in ['crear un evento', 'programar un evento']:
            speak_output = ASK_EVENT_NAME
            next_state = STATE_CREATE_EVENT_NAME
        elif option in ['escuchar los recordatorios del día']:
            # Pasa el control al handler de lectura
            return ReadDailyEventsIntentHandler().handle(handler_input)
        elif option in ['consultar un recordatorio específico']:
            speak_output = "Claro. ¿Quieres buscarlo por Fecha del evento, nombre del evento, o dentro de un rango de fechas?"
            next_state = STATE_QUERY_CRITERIA
        elif option in ['modificar un evento']:
            speak_output = "Claro. Para comenzar ¿cuál es el nombre del evento que deseas modificar?"
            next_state = STATE_MODIFY_EVENT_NAME
        elif option in ['cancelar un evento']:
            speak_output = "Claro. Para comenzar ¿cuál es el nombre del evento que deseas cancelar?"
            next_state = STATE_CANCEL_EVENT_NAME
        
        attributes[DIALOG_STATE] = next_state
        handler_input.attributes_manager.set_session_attributes(attributes)

        return (
            handler_input.response_builder
                .speak(speak_output)
                .ask(REPROMPT_MENU if next_state == STATE_MENU_SELECTION else speak_output)
                .response
        )
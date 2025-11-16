from Utils.constants import REPROMPT_MENU, PROMPT_FINAL_MENU, STATE_MENU_SELECTION, EVENT_NOT_FOUND_RETRY

class HelpIntentHandler(AbstractRequestHandler):
    """Maneja el AMAZON.HelpIntent."""
    def can_handle(self, handler_input):
        return is_intent_name("AMAZON.HelpIntent")(handler_input)

    def handle(self, handler_input):
        speak_output = REPROMPT_MENU
        return handler_input.response_builder.speak(speak_output).ask(speak_output).response

class CancelAndStopIntentHandler(AbstractRequestHandler):
    """Maneja el AMAZON.CancelIntent y AMAZON.StopIntent."""
    def can_handle(self, handler_input):
        return is_intent_name("AMAZON.CancelIntent")(handler_input) or is_intent_name("AMAZON.StopIntent")(handler_input)

    def handle(self, handler_input):
        speak_output = '¡Adiós! Espero que tu calendario esté bien organizado.'
        return handler_input.response_builder.speak(speak_output).response

class FallbackIntentHandler(AbstractRequestHandler):
    """Maneja el AMAZON.FallbackIntent, cuando Alexa no entiende la intención."""
    def can_handle(self, handler_input):
        return is_intent_name("AMAZON.FallbackIntent")(handler_input)

    def handle(handler_input):
        speak_output = "Lo siento, no entendí eso. " + REPROMPT_MENU
        return handler_input.response_builder.speak(speak_output).ask(REPROMPT_MENU).response

class SessionEndedRequestHandler(AbstractRequestHandler):
    """Maneja cuando la sesión termina por cualquier razón."""
    def can_handle(self, handler_input):
        return is_request_type("SessionEndedRequest")(handler_input)

    def handle(self, handler_input):
        return handler_input.response_builder.response

class RetryConfirmationIntentHandler(AbstractRequestHandler):
    """Maneja el Sí/No después de un evento no encontrado (Cancelar/Modificar)."""
    def can_handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        return is_intent_name("ConfirmOrDenyIntent")(handler_input) and \
               attributes.get(DIALOG_STATE) == 'AWAITING_RETRY_CONFIRMATION'

    def handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        confirmation = handler_input.request_envelope.request.intent.slots.get('Confirmation').value
        last_action = attributes.pop('last_action', None) # Limpiar acción guardada

        if confirmation == 'si':
            # Intentar de nuevo: regresa al inicio del flujo
            if last_action == 'CANCEL':
                speak_output = "Claro. Para comenzar ¿cuál es el nombre del evento que deseas cancelar?"
                attributes[DIALOG_STATE] = STATE_CANCEL_EVENT_NAME
            elif last_action == 'MODIFY':
                speak_output = "Claro. Para comenzar ¿cuál es el nombre del evento que deseas modificar?"
                attributes[DIALOG_STATE] = STATE_MODIFY_EVENT_NAME
            else:
                speak_output = PROMPT_FINAL_MENU # Si algo falla, regresa al menú
                attributes[DIALOG_STATE] = STATE_MENU_SELECTION
        else: # NO o Parar
            speak_output = PROMPT_FINAL_MENU
            attributes[DIALOG_STATE] = STATE_MENU_SELECTION

        handler_input.attributes_manager.set_session_attributes(attributes)
        return handler_input.response_builder.speak(speak_output).ask(REPROMPT_MENU).response
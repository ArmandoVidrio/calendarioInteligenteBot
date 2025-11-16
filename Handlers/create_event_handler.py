# Helper para limpiar atributos de sesión de creación
def _clear_creation_attributes(attributes):
    attributes.pop('event_name', None)
    attributes.pop('event_date', None)
    return attributes

# 1. Obtener Nombre
class CreateEventNameIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        return (is_intent_name("CreateEventIntent")(handler_input) and 
                attributes.get(DIALOG_STATE) == STATE_CREATE_EVENT_NAME)

    def handle(self, handler_input):
        event_name = handler_input.request_envelope.request.intent.slots.get('EventName').value
        attributes = handler_input.attributes_manager.get_session_attributes()
        
        attributes['event_name'] = event_name
        attributes[DIALOG_STATE] = STATE_CREATE_EVENT_DATE
        
        speak_output = ASK_EVENT_DATE.format(event_name)
        handler_input.attributes_manager.set_session_attributes(attributes)

        return handler_input.response_builder.speak(speak_output).ask(speak_output).response

# 2. Obtener Fecha
class SpecifyDateIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        return (is_intent_name("SpecifyDateIntent")(handler_input) and 
                attributes.get(DIALOG_STATE) == STATE_CREATE_EVENT_DATE)

    def handle(self, handler_input):
        event_date = handler_input.request_envelope.request.intent.slots.get('EventDate').value # Formato YYYY-MM-DD
        attributes = handler_input.attributes_manager.get_session_attributes()
        
        attributes['event_date'] = event_date
        attributes[DIALOG_STATE] = STATE_CREATE_EVENT_TIME
        
        speak_output = ASK_EVENT_TIME.format(event_date)
        handler_input.attributes_manager.set_session_attributes(attributes)

        return handler_input.response_builder.speak(speak_output).ask(speak_output).response

# 3. Obtener Hora y Confirmar Creación
class SpecifyTimeIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        attributes = handler_input.attributes_manager.get_session_attributes()
        return (is_intent_name("SpecifyTimeIntent")(handler_input) and 
                attributes.get(DIALOG_STATE) == STATE_CREATE_EVENT_TIME)

    async def handle(self, handler_input):
        event_time = handler_input.request_envelope.request.intent.slots.get('EventTime').value # Formato HH:MM
        attributes = handler_input.attributes_manager.get_session_attributes()
        outlook_service = OutlookService(handler_input)
        
        event_name = attributes.get('event_name')
        event_date = attributes.get('event_date')
        
        speak_output = ""
        try:
            await outlook_service.create_event(event_name, event_date, event_time)
            
            speak_output = f"¡Perfecto! Creé el evento {event_name} el {event_date}, a las {event_time}. {PROMPT_FINAL_MENU}"

        except Exception as e:
            if str(e) == 'AUTH_REQUIRED':
                speak_output = AUTH_REQUIRED_ERROR
                return handler_input.response_builder.speak(speak_output).set_card(LinkAccountCard()).response
            else:
                speak_output = API_GENERIC_ERROR

        # Limpiar atributos y regresar al menú
        attributes = _clear_creation_attributes(attributes)
        attributes[DIALOG_STATE] = STATE_MENU_SELECTION
        handler_input.attributes_manager.set_session_attributes(attributes)

        return handlerInput.response_builder.speak(speak_output).ask(REPROMPT_MENU).response
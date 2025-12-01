class MessageHandler:
    '''
    Class with the objective to receive a message and route it to an intention
    '''
    def __init__(self):
        pass
    
    def handle(self, message: str) -> str:
        #TODO: Modify this logic, we should create the intention detector to avoid spaguetti code
        message = message.lower()
        if ("agrega" in message or "agenda" in message) and "calendario inteligente" in message:
            #TODO: Implement service logic
            return "Evento creado"
# services/persistence_service.py
class PersistenceService:
    """Maneja la lógica de guardar y cargar atributos persistentes (usando DynamoDB)."""
    def __init__(self, handler_input):
        # El handler_input ya tiene el attributes_manager configurado con DynamoDB
        self.attributes_manager = handler_input.attributes_manager

    async def get_attributes(self):
        # get_persistent_attributes() lee de DynamoDB
        return await self.attributes_manager.get_persistent_attributes() or {}

    async def save_attributes(self, attributes):
        # set_persistent_attributes() y save_persistent_attributes() escriben en DynamoDB
        self.attributes_manager.set_persistent_attributes(attributes)
        await self.attributes_manager.save_persistent_attributes()

    # --- Métodos Específicos para Outlook OAuth ---
    async def save_refresh_token(self, refresh_token):
        attributes = await self.get_attributes()
        attributes['refresh_token'] = refresh_token
        await self.save_attributes(attributes)

    async def get_refresh_token(self):
        attributes = await self.get_attributes()
        return attributes.get('refresh_token')
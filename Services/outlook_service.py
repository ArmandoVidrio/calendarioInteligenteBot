# services/outlook_service.py
import requests
import os
import datetime
from urllib.parse import urlencode

# Las credenciales de Outlook deben estar en las variables de entorno de la Lambda
MS_GRAPH_URL = 'https://graph.microsoft.com/v1.0/me/calendar'
CLIENT_ID = os.environ.get('MS_CLIENT_ID')
CLIENT_SECRET = os.environ.get('MS_CLIENT_SECRET')
TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

# Importamos el PersistenceService al final para evitar dependencia circular
PersistenceService = __import__('services.persistence_service', fromlist=['PersistenceService']).PersistenceService

class OutlookService:
    """Clase responsable de todas las interacciones con Microsoft Graph."""
    def __init__(self, handler_input):
        self.handler_input = handler_input
        self.persistence_service = PersistenceService(handler_input)
        self.default_timezone = "America/Mexico_City" # Ajusta si necesitas TimeZone dinámica

    def _get_access_token_from_system(self):
        """Intenta obtener el token de acceso de la solicitud de Alexa."""
        return self.handler_input.request_envelope.context.System.user.access_token

    async def get_access_token(self):
        """Obtiene un token de acceso válido (o lo refresca si es necesario)."""
        access_token = self._get_access_token_from_system()
        if access_token:
            return access_token

        refresh_token = await self.persistence_service.get_refresh_token()

        if refresh_token:
            try:
                data = {
                    'client_id': CLIENT_ID,
                    'client_secret': CLIENT_SECRET,
                    'grant_type': 'refresh_token',
                    'refresh_token': refresh_token
                }
                response = requests.post(TOKEN_URL, data=data)
                response.raise_for_status()
                token_data = response.json()
                
                if 'refresh_token' in token_data:
                    await self.persistence_service.save_refresh_token(token_data['refresh_token'])
                    
                return token_data.get('access_token')

            except requests.exceptions.RequestException as e:
                print(f"ERROR AL REFRESCAR TOKEN: {e}")
                return None
        
        return None

    # --- Métodos de CRUD de Calendario ---

    async def create_event(self, name, date, time):
        """Crea un evento en Outlook Calendar."""
        access_token = await self.get_access_token()
        if not access_token:
            raise Exception('AUTH_REQUIRED')

        # Asume evento de 1 hora
        start_dt = datetime.datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + datetime.timedelta(hours=1)
        
        headers = {'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}
        payload = {
            "subject": name,
            "start": {"dateTime": start_dt.isoformat(), "timeZone": self.default_timezone},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": self.default_timezone},
        }

        try:
            response = requests.post(f'{MS_GRAPH_URL}/events', headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"ERROR EN CREATE_EVENT: {response.text if response is not None else e}")
            raise Exception('API_ERROR')

    async def get_events_by_date(self, date):
        """Consulta eventos para una fecha específica (hoy para los recordatorios del día)."""
        access_token = await self.get_access_token()
        if not access_token:
            raise Exception('AUTH_REQUIRED')

        start_of_day = f"{date}T00:00:00"
        end_of_day = f"{date}T23:59:59"
        
        # Uso de calendarview para eventos recurrentes
        url = f'{MS_GRAPH_URL}/calendarview?startDateTime={start_of_day}&endDateTime={end_of_day}'

        try:
            response = requests.get(url, headers={'Authorization': f'Bearer {access_token}'})
            response.raise_for_status()
            return response.json().get('value', [])
        except requests.exceptions.RequestException as e:
            print(f"ERROR EN GET_EVENTS_BY_DATE: {response.text if response is not None else e}")
            raise Exception('API_ERROR')

    async def find_event(self, name):
        """Busca un evento por nombre."""
        access_token = await self.get_access_token()
        if not access_token:
            raise Exception('AUTH_REQUIRED')

        # Uso de $filter para encontrar eventos cuyo asunto contenga el nombre
        # Se buscan solo eventos futuros
        today = datetime.date.today().isoformat()
        
        # Nota: Outlook Graph $filter en strings es limitado. Se usa una consulta amplia.
        url = f'{MS_GRAPH_URL}/events?$filter=start/dateTime ge \'{today}T00:00:00\' and contains(subject, \'{name}\')'

        try:
            response = requests.get(url, headers={'Authorization': f'Bearer {access_token}'})
            response.raise_for_status()
            events = response.json().get('value', [])
            
            # Devolver el primer evento coincidente que no esté cancelado
            for event in events:
                if event.get('isCancelled') is False:
                    return event
            return None

        except requests.exceptions.RequestException as e:
            print(f"ERROR EN FIND_EVENT: {response.text if response is not None else e}")
            raise Exception('API_ERROR')

    async def update_event(self, event_id, update_data):
        """Modifica un evento existente."""
        access_token = await self.get_access_token()
        if not access_token:
            raise Exception('AUTH_REQUIRED')

        headers = {'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}
        
        try:
            response = requests.patch(f'{MS_GRAPH_URL}/events/{event_id}', headers=headers, json=update_data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"ERROR EN UPDATE_EVENT: {response.text if response is not None else e}")
            raise Exception('API_ERROR')

    async def delete_event(self, event_id):
        """Cancela/elimina un evento por ID."""
        access_token = await self.get_access_token()
        if not access_token:
            raise Exception('AUTH_REQUIRED')

        try:
            response = requests.delete(f'{MS_GRAPH_URL}/events/{event_id}', headers={'Authorization': f'Bearer {access_token}'})
            response.raise_for_status()
            # Si el código es 204 No Content, la eliminación fue exitosa
            return True
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                 return False # Evento no encontrado
            print(f"ERROR EN DELETE_EVENT: {e.response.text}")
            raise Exception('API_ERROR')
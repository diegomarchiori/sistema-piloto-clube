import logging
from typing import Optional, Dict, List
from datetime import datetime, timezone, time, timedelta
import pytz 

from fastapi import FastAPI, Depends, HTTPException, Header
from google.oauth2 import id_token
from google.auth.transport import requests
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from fastapi.middleware.cors import CORSMiddleware

# Ajustes nos imports
from src.auth import get_service_account_credentials
from src.models import (
    CalendarListResponse, EventCreateRequest, EventUpdateRequest, ActionResponse,
    FindEventsApiResponse, CalendarListEntry, AvailabilityResponse, CreateEventResponse
)
# Em src/server.py, nas importações de calendar_actions
from src.calendar_actions import (
    create_event, find_events, update_event, delete_event, get_availability, delete_recurring_event # <- Adicione
)
from src.config import settings

_calendar_timezone_cache = {}
def get_calendar_timezone(service, calendar_id: str) -> str:
    """Busca e armazena em cache o fuso horário de um calendário."""
    if calendar_id in _calendar_timezone_cache:
        return _calendar_timezone_cache[calendar_id]
    try:
        calendar = service.calendars().get(calendarId=calendar_id).execute()
        tz = calendar.get('timeZone', 'UTC')
        _calendar_timezone_cache[calendar_id] = tz
        return tz
    except HttpError:
        # Retorna UTC como padrão em caso de erro, para evitar que a aplicação quebre
        return 'UTC'
    
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__) 
app = FastAPI(title="Google Calendar API", version="1.0.0")
origins = ["http://localhost:5500", "http://127.0.0.1:5500"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

async def get_current_user(authorization: str = Header(None)) -> Dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Esquema de autorização inválido.")
    token = authorization.split("Bearer ")[1]
    try:
        gcp_client_id = settings.get('gcp_client_id')
        admin_users_list = settings.get('permissions', {}).get('admin_users', [])
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), gcp_client_id)
        user_email = idinfo.get('email')
        idinfo['isAdmin'] = user_email in admin_users_list
        logging.info(f"Requisição recebida do usuário: {user_email} (Admin: {idinfo['isAdmin']})")
        return idinfo
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Token de ID inválido: {e}")
def get_backend_credentials():
    return get_service_account_credentials()

@app.get("/actions/list_calendars", response_model=CalendarListResponse, tags=["Calendars"])
def api_list_calendars(user_info: dict = Depends(get_current_user)):
    """
    Lista as quadras. Se o usuário for admin, retorna todos os nomes simples.
    Se não for admin, retorna apenas os nomes simples das quadras às quais o usuário tem acesso.
    """
    # Pega o mapa completo de quadras do arquivo de configuração
    all_quadras_map = settings.get('quadras', {}) # Ex: {'Voleibol A': 'c_123@google.com'}

    # --- INÍCIO DA NOVA LÓGICA DE PERMISSÃO ---

    # 1. VERIFICA SE O USUÁRIO É ADMIN
    if user_info.get('isAdmin'):
        logger.info(f"Admin '{user_info.get('email')}' acessando. Retornando todos os nomes de quadras.")
        accessible_calendars = []
        # Para admins, retorna a lista completa de "apelidos"
        for simple_name in sorted(all_quadras_map.keys()):
            accessible_calendars.append(CalendarListEntry(id=simple_name, summary=simple_name, timeZone='America/Sao_Paulo', accessRole='writer'))
        return CalendarListResponse(items=accessible_calendars)
    
    # 2. SE NÃO FOR ADMIN, BUSCA E TRADUZ AS PERMISSÕES
    else:
        logger.info(f"Usuário comum '{user_info.get('email')}' acessando. Verificando permissões de calendário...")
        try:
            # Pega credenciais personificando o usuário logado
            user_credentials = get_service_account_credentials(user_info['email'])
            service = build('calendar', 'v3', credentials=user_credentials)

            # Busca a lista de calendários do usuário na API do Google
            user_calendar_list = service.calendarList().list().execute()
            user_calendars_from_google = user_calendar_list.get('items', [])

            # Pega apenas os IDs reais dos calendários aos quais o usuário tem acesso
            user_accessible_ids = {cal.get('id') for cal in user_calendars_from_google}
            
            # Cria um mapa reverso para encontrar o nome simples a partir do ID real
            id_to_name_map = {v: k for k, v in all_quadras_map.items()}
            
            accessible_simple_names = []
            # Itera sobre os IDs que o usuário tem acesso
            for calendar_id in user_accessible_ids:
                # Se o ID real estiver no nosso mapa reverso...
                if calendar_id in id_to_name_map:
                    # ...adiciona o "apelido" correspondente à lista final
                    accessible_simple_names.append(id_to_name_map[calendar_id])

            # Monta a resposta final para o frontend usando os "apelidos" filtrados
            final_calendar_list = [
                CalendarListEntry(id=name, summary=name, timeZone='America/Sao_Paulo', accessRole='writer')
                for name in sorted(accessible_simple_names)
            ]
            
            logger.info(f"Usuário tem acesso a {len(final_calendar_list)} quadras. Retornando lista de nomes filtrada.")
            return CalendarListResponse(items=final_calendar_list)

        except Exception as e:
            logger.error(f"Erro ao buscar calendários para o usuário {user_info.get('email')}: {e}")
            raise HTTPException(status_code=500, detail="Não foi possível verificar as permissões de calendário do usuário.")
        
def check_permission_and_get_event(event_id: str, calendar_id: str, user_info: dict, credentials):
    if user_info.get('isAdmin'):
        return
    try:
        service = build('calendar', 'v3', credentials=credentials)
        event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
        requester_email = event.get('extendedProperties', {}).get('private', {}).get('requesterEmail')
        if requester_email and requester_email == user_info.get('email'):
            return
    except HttpError as e:
        if e.resp.status == 404:
            raise HTTPException(status_code=404, detail="Evento não encontrado.")
        logging.error(f"Erro de API ao verificar permissão do evento: {e}")
        raise HTTPException(status_code=500, detail="Erro ao verificar permissão do evento.")
    raise HTTPException(status_code=403, detail="Permissão negada.")

# Em src/server.py, SUBSTITUA a função api_find_events inteira por esta:

@app.get("/actions/find_events", response_model=FindEventsApiResponse, tags=["Events"])
def api_find_events(
    calendar_id: str, 
    user_info: dict = Depends(get_current_user), 
    page_token: Optional[str] = None, 
    time_min_str: Optional[str] = None, 
    time_max_str: Optional[str] = None
):
    backend_credentials = get_backend_credentials()
    real_calendar_id = settings.get('quadras', {}).get(calendar_id)
    if not real_calendar_id:
        raise HTTPException(status_code=400, detail=f"Nome de quadra inválido: {calendar_id}")

    # --- LÓGICA DE DATA/HORA SIMPLIFICADA E CORRIGIDA ---
    final_time_min, final_time_max = None, None
    
    # Se uma data de início for fornecida, converte para o fuso horário correto
    if time_min_str:
        try:
            service = build('calendar', 'v3', credentials=backend_credentials)
            calendar_tz = pytz.timezone(get_calendar_timezone(service, real_calendar_id))
            dt_min_naive = datetime.strptime(time_min_str, '%Y-%m-%d')
            dt_min_aware = calendar_tz.localize(dt_min_naive)
            final_time_min = dt_min_aware.isoformat()
        except Exception:
            raise HTTPException(status_code=400, detail="Formato de data de início inválido. Use AAAA-MM-DD.")
    elif not page_token:
        # Define a data de início como "agora" apenas se for a primeira busca e não houver filtro
        final_time_min = datetime.now(timezone.utc).isoformat()

    # Se uma data de fim for fornecida, converte para o fuso horário correto
    if time_max_str:
        try:
            service = build('calendar', 'v3', credentials=backend_credentials)
            calendar_tz = pytz.timezone(get_calendar_timezone(service, real_calendar_id))
            dt_max_naive = datetime.strptime(time_max_str, '%Y-%m-%d')
            # Pega o dia inteiro, até as 23:59:59
            next_day = datetime.combine(dt_max_naive.date(), time.max)
            dt_max_aware = calendar_tz.localize(next_day)
            final_time_max = dt_max_aware.isoformat()
        except Exception:
            raise HTTPException(status_code=400, detail="Formato de data de fim inválido. Use AAAA-MM-DD.")
    
    # --- FIM DA LÓGICA CORRIGIDA ---

    events_response = find_events(
        credentials=backend_credentials,
        calendar_id=real_calendar_id,
        time_min=final_time_min,
        time_max=final_time_max,
        page_token=page_token
    )
    
    return FindEventsApiResponse(user_email=user_info['email'], isAdmin=user_info['isAdmin'], events=events_response)

@app.post("/actions/create_event", response_model=CreateEventResponse, tags=["Events"])
def api_create_event(body: dict, user_info: dict = Depends(get_current_user)):
    credentials = get_backend_credentials()
    event_data = EventCreateRequest(**body.get('event_data', {}))
    # ALTERADO: Traduz nome simples para ID real
    simple_calendar_name = body.get('calendar_id')
    real_calendar_id = settings.get('quadras', {}).get(simple_calendar_name)
    if not real_calendar_id:
        raise HTTPException(status_code=400, detail=f"Nome de quadra inválido: {simple_calendar_name}")
    
    # ALTERADO: Passa o objeto 'settings' para a função de ação
    return create_event(credentials, event_data, real_calendar_id, user_info, settings)

@app.patch("/actions/update_event/{event_id}", response_model=ActionResponse, tags=["Events"])
def api_update_event(event_id: str, calendar_id: str, update_data: EventUpdateRequest, user_info: dict = Depends(get_current_user)):
    backend_credentials = get_backend_credentials()
    real_calendar_id = settings.get('quadras', {}).get(calendar_id)
    if not real_calendar_id:
        raise HTTPException(status_code=400, detail=f"Nome de quadra inválido: {calendar_id}")

    check_permission_and_get_event(event_id, real_calendar_id, user_info, backend_credentials)

    return update_event(
        credentials=backend_credentials, 
        event_id=event_id, 
        update_data=update_data, 
        calendar_id=real_calendar_id, 
        user_info=user_info,
        settings=settings
    )

@app.delete("/actions/delete_event/{event_id}", response_model=ActionResponse, tags=["Events"])
def api_delete_event(event_id: str, calendar_id: str, user_info: dict = Depends(get_current_user)):
    backend_credentials = get_backend_credentials()
    # ALTERADO: Traduz nome simples para ID real
    real_calendar_id = settings.get('quadras', {}).get(calendar_id)
    if not real_calendar_id:
        raise HTTPException(status_code=400, detail=f"Nome de quadra inválido: {calendar_id}")
        
    check_permission_and_get_event(event_id, real_calendar_id, user_info, backend_credentials)
    
    # ALTERADO: Passa o objeto 'settings' para a função de ação
    return delete_event(backend_credentials, event_id, real_calendar_id, settings)

# Em src/server.py, adicione este novo endpoint ao final do arquivo

@app.get("/actions/find_availability", response_model=AvailabilityResponse, tags=["Availability"])
def api_find_availability(
    calendar_id: str, 
    date_str: str, 
    user_info: dict = Depends(get_current_user)
):
    """
    Encontra e retorna todos os intervalos de tempo OCUPADOS para uma quadra em um dia específico.
    """
    backend_credentials = get_backend_credentials()

    # 1. Traduz o nome simples da quadra para seu ID real
    real_calendar_id = settings.get('quadras', {}).get(calendar_id)
    if not real_calendar_id:
        raise HTTPException(status_code=404, detail=f"Nome de quadra inválido: {calendar_id}")

    # 2. Cria a janela de tempo (o dia inteiro) com o fuso horário correto
    service = build('calendar', 'v3', credentials=backend_credentials)
    try:
        calendar_tz = pytz.timezone(get_calendar_timezone(service, real_calendar_id))
        target_day = datetime.strptime(date_str, '%Y-%m-%d').date()

        # Define o início (00:00) e o fim (23:59:59) do dia, no fuso horário da agenda
        time_min = calendar_tz.localize(datetime.combine(target_day, time.min))
        time_max = calendar_tz.localize(datetime.combine(target_day, time.max))

    except pytz.UnknownTimeZoneError:
        raise HTTPException(status_code=500, detail="Fuso horário desconhecido para o calendário.")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de data inválido. Use AAAA-MM-DD.")

    # 3. Chama a função de lógica para buscar os horários
    busy_slots = get_availability(
        credentials=backend_credentials,
        calendar_id=real_calendar_id,
        time_min=time_min,
        time_max=time_max
    )

    return AvailabilityResponse(busy=busy_slots)

# Em src/server.py, adicione este novo endpoint

@app.delete("/actions/delete_recurring_event/{event_id}", response_model=ActionResponse, tags=["Events"])
def api_delete_recurring_event(event_id: str, calendar_id: str, delete_scope: str, user_info: dict = Depends(get_current_user)):
    backend_credentials = get_backend_credentials()
    real_calendar_id = settings.get('quadras', {}).get(calendar_id)
    if not real_calendar_id:
        raise HTTPException(status_code=400, detail=f"Nome de quadra inválido: {calendar_id}")

    check_permission_and_get_event(event_id, real_calendar_id, user_info, backend_credentials)
    
    return delete_recurring_event(
        credentials=backend_credentials,
        event_id=event_id,
        calendar_id=real_calendar_id,
        delete_scope=delete_scope,
        settings=settings
    )
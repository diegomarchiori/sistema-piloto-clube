from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, date

# Modelos para Datas e Horários
class EventDateTime(BaseModel):
    """Representa a data/hora de início ou fim de um evento."""
    date: Optional[date] = None
    date_time: Optional[datetime] = Field(None, alias='dateTime')
    time_zone: Optional[str] = Field(None, alias='timeZone')

    class Config:
        populate_by_name = True

# Modelos para Participantes
class EventAttendee(BaseModel):
    """Representa um participante de um evento."""
    email: str
    display_name: Optional[str] = Field(None, alias='displayName')
    organizer: Optional[bool] = None
    self: Optional[bool] = None
    resource: Optional[bool] = None
    optional: Optional[bool] = None
    response_status: str = Field(..., alias='responseStatus')
    comment: Optional[str] = None

    class Config:
        populate_by_name = True

class GoogleCalendarEventOrganizer(BaseModel):
    """Representa o organizador de um evento."""
    email: str
    display_name: Optional[str] = Field(None, alias='displayName')
    self: Optional[bool] = None

    class Config:
        populate_by_name = True

# Modelo para Lembretes
class ReminderOverride(BaseModel):
    """Define um lembrete específico."""
    method: str
    minutes: int

class EventReminders(BaseModel):
    """Define os lembretes para um evento."""
    use_default: bool = Field(..., alias='useDefault')
    overrides: Optional[List[ReminderOverride]] = None

    class Config:
        populate_by_name = True

class GoogleCalendarEventCreator(BaseModel):
    """Representa o criador de um evento."""
    email: str
    display_name: Optional[str] = Field(None, alias='displayName')
    self: Optional[bool] = None

    class Config:
        populate_by_name = True

# Modelo Principal do Evento
# Em src/models.py

class GoogleCalendarEvent(BaseModel):
    """Representa um único evento do Google Calendar."""
    id: str
    status: Optional[str] = None
    html_link: Optional[str] = Field(None, alias='htmlLink')
    created: datetime
    updated: datetime
    summary: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    creator: Optional[GoogleCalendarEventCreator] = None
    organizer: GoogleCalendarEventOrganizer
    start: EventDateTime
    end: EventDateTime
    attendees: Optional[List[EventAttendee]] = None
    recurrence: Optional[List[str]] = None
    recurring_event_id: Optional[str] = Field(None, alias='recurringEventId')
    reminders: Optional[EventReminders] = None
    
    # ▼▼▼ ESTA É A LINHA QUE FOI ADICIONADA ▼▼▼
    extended_properties: Optional[Dict[str, Dict[str, str]]] = Field(None, alias='extendedProperties')

    class Config:
        populate_by_name = True
        
# Modelo para a Resposta da Lista de Eventos
class EventsResponse(BaseModel):
    """Representa a resposta da API para uma lista de eventos."""
    items: List[GoogleCalendarEvent]
    nextPageToken: Optional[str] = None # <-- Linha corrigida
    summary: Optional[str] = None

    class Config:
        populate_by_name = True

# SUBSTITUA a classe acima por esta versão completa e correta:
class EventCreateRequest(BaseModel):
    """Modelo para os dados necessários para criar um evento."""
    summary: str
    start: EventDateTime
    end: EventDateTime
    description: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[List[str]] = None
    reminders: Optional[EventReminders] = None
    
    # CAMPOS QUE ESTAVAM FALTANDO:
    frequency: Optional[str] = None
    recurrence_end_date: Optional[str] = None
    recurrence_days: Optional[List[str]] = None

class EventUpdateRequest(BaseModel):
    """Modelo para os dados que podem ser atualizados em um evento."""
    summary: Optional[str] = None
    start: Optional[EventDateTime] = None
    end: Optional[EventDateTime] = None
    description: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[List[EventAttendee]] = None

# Modelos para a Lista de Calendários
class CalendarListEntry(BaseModel):
    """Representa uma única entrada na lista de calendários do usuário."""
    id: str
    summary: str
    description: Optional[str] = None
    time_zone: str = Field(..., alias='timeZone')
    access_role: Optional[str] = Field(None, alias='accessRole')

    class Config:
        populate_by_name = True

class CalendarListResponse(BaseModel):
    """Representa a resposta da API para a lista de calendários."""
    items: List[CalendarListEntry]
    next_page_token: Optional[str] = Field(None, alias='nextPageToken')

    class Config:
        populate_by_name = True

# ==============================================================================
# ▼▼▼ NOVOS MODELOS ADICIONADOS ▼▼▼
# ==============================================================================

class ActionResponse(BaseModel):
    """Resposta padronizada para ações de criação, atualização e exclusão."""
    message: str
    event: Optional[GoogleCalendarEvent] = None

class FindEventsApiResponse(BaseModel):
    """Resposta para a busca de eventos, incluindo o email do usuário logado."""
    user_email: str
    isAdmin: bool
    events: EventsResponse

    # Em src/models.py, adicione estas classes no final do arquivo

class BusyInterval(BaseModel):
    """Representa um único intervalo de tempo ocupado."""
    start: datetime
    end: datetime

class AvailabilityResponse(BaseModel):
    """Representa a resposta da API de disponibilidade."""
    busy: List[BusyInterval]

    #------------------------------------------------------------------
# ▼▼▼ COLE ESTE BLOCO NO FINAL DO SEU ARQUIVO src/models.py ▼▼▼
#------------------------------------------------------------------

class SkippedEventInfo(BaseModel):
    """Informações sobre um evento que foi pulado por conflito."""
    start: str
    end: str
    reason: str

# Em src/models.py, SUBSTITUA CreateEventResponse por este:
class CreateEventResponse(ActionResponse):
    """Resposta customizada para a criação de eventos, incluindo os pulados."""
    created_count: int
    skipped_count: int
    skipped_events: List[SkippedEventInfo] = []
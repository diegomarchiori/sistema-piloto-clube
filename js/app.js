// ==============================================================================
// ESCOPO GLOBAL - Funções que o Google precisa "enxergar"
// ==============================================================================

let idToken = null; // Guarda o "crachá" de identidade do usuário após o login
const GOOGLE_CLIENT_ID = "391723919846-rk738n1hb9n8niba6ijvu4s50t3poblt.apps.googleusercontent.com";

/**
 * Ponto de Entrada da Aplicação.
 * Esta função é chamada pelo Google após o usuário fazer o login com sucesso.
 */
function handleCredentialResponse(response) {
    console.log("Login com Google bem-sucedido. Token recebido.");
    idToken = response.credential;

    // Decodifica o token para exibir o nome do usuário
    try {
        const userInfoPayload = JSON.parse(atob(idToken.split('.')[1]));
        const userInfoElement = document.getElementById('user-info');
        if (userInfoElement) {
            userInfoElement.textContent = `Logado como: ${userInfoPayload.name}`;
        }
    } catch (e) {
        console.error("Erro ao decodificar o token:", e);
    }
    
    // Esconde a tela de login e mostra a aplicação principal
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('main-app').classList.remove('hidden');

    // Chama a função que inicializa toda a lógica da aplicação
    initializeAppLogic();
}

/**
 * Função que é chamada quando a página inteira carrega.
 * Ela inicializa o serviço de login do Google de forma programática.
 */
window.onload = function () {
  console.log("Página carregada. Inicializando Google Sign-In...");
  if (typeof google === 'undefined' || !google.accounts) {
      console.error("Biblioteca Google Identity Services (GSI) não carregou a tempo.");
      alert("Erro ao carregar a biblioteca de login do Google. Por favor, recarregue a página.");
      return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(
    document.getElementById("google-signin-button"),
    { theme: "outline", size: "large", text: "signin_with", logo_alignment: "left" } 
  );
  google.accounts.id.prompt(); 
}

/**
 * Função principal que configura e anexa todos os eventos da aplicação.
 * É chamada uma única vez, após o login bem-sucedido.
 */
function initializeAppLogic() {
    console.log("Inicializando a lógica da aplicação...");

    const API_BASE_URL = 'http://agendamento.ecp.org.br:8001';
    
    const elements = {
        calendarSelect: document.getElementById('calendar-select'),
        findEventsBtn: document.getElementById('find-events-btn'),
        clearFiltersBtn: document.getElementById('clear-filters-btn'),
        filterStartDate: document.getElementById('filter-start-date'),
        filterEndDate: document.getElementById('filter-end-date'),
        eventsListContainer: document.getElementById('events-list-container'),
        eventsPlaceholder: document.getElementById('events-placeholder'),
        loadMoreContainer: document.getElementById('load-more-container'),
        loadMoreBtn: document.getElementById('load-more-btn'),
        loader: document.getElementById('loader'),
        loaderText: document.getElementById('loader-text'),
        toastContainer: document.getElementById('toast-container'),
        createSection: document.getElementById('create-section'),
        toggleFormBtn: document.getElementById('toggle-form-btn'),
        createEventForm: document.getElementById('create-event-form'),
        signOutBtn: document.getElementById('sign-out-btn'),
        selectedCourtDisplay: document.getElementById('selected-court-display'),
        selectedCourtName: document.getElementById('selected-court-name'),
        confirmModal: document.getElementById('confirm-modal'),
        confirmModalText: document.getElementById('confirm-modal-text'),
        confirmModalConfirmBtn: document.getElementById('confirm-modal-confirm-btn'),
        confirmModalCancelBtn: document.getElementById('confirm-modal-cancel-btn'),
        rescheduleModal: document.getElementById('reschedule-modal'),
        rescheduleForm: document.getElementById('reschedule-form'),
        rescheduleEventTitle: document.getElementById('reschedule-event-title'),
        rescheduleStartTimeInput: document.getElementById('reschedule-start-time'),
        rescheduleEndTimeInput: document.getElementById('reschedule-end-time'),
        rescheduleModalCancelBtn: document.getElementById('reschedule-modal-cancel-btn'),
        findAvailabilityBtn: document.getElementById('find-availability-btn'),
        availabilityResultsContainer: document.getElementById('availability-results-container'),
        availabilityHeader: document.getElementById('availability-header'),
        availabilityListWrapper: document.getElementById('availability-list-wrapper'),
        availabilityPlaceholder: document.getElementById('availability-placeholder'),
        recurrenceFrequency: document.getElementById('recurrence-frequency'),
        recurrenceWeeklyOptions: document.getElementById('recurrence-weekly-options'),
        recurrenceEndDateContainer: document.getElementById('recurrence-end-date-container'),
        conflictReportModal: document.getElementById('conflict-report-modal'),
        conflictList: document.getElementById('conflict-list'),
        conflictModalCloseBtn: document.getElementById('conflict-modal-close-btn'),
        deleteOptionsModal: document.getElementById('delete-options-modal'),
        deleteThisEventBtn: document.getElementById('delete-this-event-btn'),
        deleteFutureEventsBtn: document.getElementById('delete-future-events-btn'),
        deleteOptionsCancelBtn: document.getElementById('delete-options-cancel-btn'),
        deleteAllEventsBtn: document.getElementById('delete-all-events-btn'),
    };
    
    const state = {
        currentEvents: [],
        selectedCalendarId: null,
        eventToModify: null,
        nextPageToken: null,
        currentUserEmail: null,
        isAdmin: false,
        searchTimeMin: null,
        searchTimeMax: null,
    };

    const api = {
        async request(endpoint, options = {}) {
            if (!idToken) {
                showToast('Erro de autenticação. Por favor, faça o login novamente.', 'error');
                throw new Error('Usuário não autenticado.');
            }
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
                ...options.headers
            };
            try {
                const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers, ...options });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                    throw new Error(errorData.detail || 'Ocorreu um erro na comunicação com o servidor.');
                }
                return response.json();
            } catch (error) {
                hideLoader();
                throw error;
            }
        },
        listCalendars: () => api.request('/actions/list_calendars'),
        findEvents: (calendarId, { pageToken = null, timeMin = null, timeMax = null } = {}) => {
            let endpoint = `/actions/find_events?calendar_id=${calendarId}`;
            if (pageToken) endpoint += `&page_token=${pageToken}`;
            if (timeMin) endpoint += `&time_min_str=${timeMin}`;
            if (timeMax) endpoint += `&time_max_str=${timeMax}`;
            return api.request(endpoint);
        },
        createEvent: (calendarId, eventData) => api.request('/actions/create_event', {
            method: 'POST', body: JSON.stringify({ calendar_id: calendarId, event_data: eventData }),
        }),
        deleteEvent: (eventId, calendarId) => api.request(`/actions/delete_event/${eventId}?calendar_id=${calendarId}`, {
            method: 'DELETE',
        }),
        updateEvent: (eventId, calendarId, updateData) => api.request(`/actions/update_event/${eventId}?calendar_id=${calendarId}`, {
        method: 'PATCH', body: JSON.stringify(updateData),
        }),
        deleteRecurringEvent: (eventId, calendarId, deleteScope) => api.request(`/actions/delete_recurring_event/${eventId}?calendar_id=${calendarId}&delete_scope=${deleteScope}`, {
            method: 'DELETE',
        }),
        findAvailability: (calendarId, dateStr) => api.request(`/actions/find_availability?calendar_id=${calendarId}&date_str=${dateStr}`),
    };

    const showLoader = (message = 'Processando...') => {
        if(elements.loaderText) elements.loaderText.textContent = message;
        if(elements.loader) elements.loader.classList.remove('hidden');
    };
    const hideLoader = () => {
        if(elements.loader) elements.loader.classList.add('hidden');
    };
    // Em js/app.js, adicione esta nova função

    const updateLoadMoreButtonVisibility = () => {
        if (state.nextPageToken) {
            elements.loadMoreContainer.classList.remove('hidden');
        } else {
            elements.loadMoreContainer.classList.add('hidden');
        }
    };
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        if (elements.toastContainer) elements.toastContainer.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 6000);
    };

    const renderCalendars = (calendars) => {
        elements.calendarSelect.innerHTML = '<option value="" disabled selected>Selecione uma quadra</option>';
        calendars.forEach(calendar => {
            const option = document.createElement('option');
            option.value = calendar.id;
            option.textContent = calendar.summary;
            elements.calendarSelect.appendChild(option);
        });
    };

    const formatDateTime = (isoString) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const renderEvents = (events, append = false) => {
        if (!append) elements.eventsListContainer.innerHTML = '';
        
        const placeholder = document.getElementById('events-placeholder');
        if (placeholder) placeholder.remove();
        
        if (events.length === 0 && !append) {
            const hasFilters = elements.filterStartDate.value || elements.filterEndDate.value;
            elements.eventsListContainer.innerHTML = `<p id="events-placeholder">${hasFilters ? 'Nenhum agendamento encontrado para os filtros aplicados.' : 'Nenhum agendamento futuro para esta quadra.'}</p>`;
            return;
        }

        let lastRenderedDay = append ? (elements.eventsListContainer.querySelector('.date-header:last-of-type')?.dataset.day || null) : null;
        
        events.forEach(event => {
            const eventDate = new Date(event.start.dateTime);
            const eventDay = eventDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
            if (eventDay !== lastRenderedDay) {
                const dateHeader = document.createElement('h3');
                dateHeader.className = 'date-header';
                dateHeader.textContent = eventDay;
                dateHeader.dataset.day = eventDay;
                elements.eventsListContainer.appendChild(dateHeader);
                lastRenderedDay = eventDay;
            }

            const eventItem = document.createElement('div');
            eventItem.className = 'event-item';
            const isBlocked = event.summary && event.summary.toLowerCase().includes('bloqueado');
            
            const requesterEmail = event.extendedProperties?.private?.requesterEmail;
            const canManage = !isBlocked && (state.isAdmin || (requesterEmail && requesterEmail === state.currentUserEmail));
            
            if (isBlocked) eventItem.classList.add('event-item-blocked');
            
            const description = event.description ? `<p class="event-description">${event.description.replace(/\n/g, '<br>')}</p>` : '';
            const isRecurring = !!event.extendedProperties?.private?.seriesId;
            const rescheduleDisabledAttribute = !canManage || isRecurring ? `disabled title="${isRecurring ? 'Não é possível reagendar eventos de uma série.' : 'Você não tem permissão.'}"` : '';
            const cancelDisabledAttribute = !canManage ? 'disabled title="Você não tem permissão para alterar este evento."' : '';
            
            eventItem.innerHTML = `
                <div class="event-details">
                    <h4>${event.summary || '(Sem Título)'}</h4>
                    <p><strong>Início:</strong> ${formatDateTime(event.start?.dateTime)}</p>
                    <p><strong>Fim:</strong> ${formatDateTime(event.end?.dateTime)}</p>
                    ${description}
                </div>
                ${!isBlocked ? `
                <div class="event-actions">
                    <button class="btn btn-secondary btn-reschedule" data-event-id="${event.id}" ${rescheduleDisabledAttribute}>Reagendar</button>
                    <button class="btn btn-danger btn-cancel" data-event-id="${event.id}" ${cancelDisabledAttribute}>Cancelar</button>
                </div>` : ''}
            `;
            elements.eventsListContainer.appendChild(eventItem);
        });
    };
    
    const handleFindEvents = async () => {
        hideAvailabilityResults();
        state.selectedCalendarId = elements.calendarSelect.value;
        if (!state.selectedCalendarId) {
            return showToast('Por favor, selecione uma quadra.', 'error');
        }
        showLoader('Buscando eventos...');
        try {
            const timeMin = elements.filterStartDate.value;
            const timeMax = elements.filterEndDate.value;
            state.searchTimeMin = timeMin;
            state.searchTimeMax = timeMax;
            const response = await api.findEvents(state.selectedCalendarId, { timeMin, timeMax });
            
            state.currentUserEmail = response.user_email;
            state.isAdmin = response.isAdmin;
            state.currentEvents = response.events.items || [];
            state.nextPageToken = response.events.nextPageToken || null;

            const selectedOption = elements.calendarSelect.options[elements.calendarSelect.selectedIndex];
            elements.selectedCourtName.textContent = selectedOption.text;
            elements.selectedCourtDisplay.classList.remove('hidden');

            renderEvents(state.currentEvents, false);

            // Lógica de visibilidade corrigida para a busca inicial
            if (state.nextPageToken) {
                elements.loadMoreContainer.classList.remove('hidden');
            } else {
                elements.loadMoreContainer.classList.add('hidden');
            }
        } catch (error) {
            elements.selectedCourtDisplay.classList.add('hidden');
            showToast(`Erro ao buscar eventos: ${error.message}`, 'error');
            renderEvents([], false);
        } finally {
            hideLoader();
        }
    };

    // Em js/app.js, substitua a função handleLoadMore inteira
    // Substitua a função handleLoadMore inteira por esta:

    const handleLoadMore = async () => {
        if (!state.nextPageToken) {
            // Se não há token, não faz nada e esconde o botão por segurança.
            elements.loadMoreContainer.classList.add('hidden');
            return;
        }

        elements.loadMoreBtn.disabled = true;
        elements.loadMoreBtn.textContent = 'Carregando...';

        // Substitua pelo bloco corrigido
        try {
            const timeMin = state.searchTimeMin;
            const timeMax = state.searchTimeMax;
            const response = await api.findEvents(state.selectedCalendarId, { pageToken: state.nextPageToken, timeMin, timeMax });
            const newEvents = response.events.items || [];
            state.currentEvents.push(...newEvents); // Adiciona os novos eventos à lista
            state.nextPageToken = response.events.nextPageToken || null; 
            
            renderEvents(state.currentEvents, false);

            // Atualiza a visibilidade do botão APÓS a nova busca
            if (state.nextPageToken) {
                elements.loadMoreContainer.classList.remove('hidden');
            } else {
                elements.loadMoreContainer.classList.add('hidden');
            }

        } catch (error) {
            showToast(`Erro ao carregar mais eventos: ${error.message}`, 'error');
            elements.loadMoreContainer.classList.add('hidden'); // Esconde em caso de erro
        } finally {
            elements.loadMoreBtn.disabled = false;
            elements.loadMoreBtn.textContent = 'Carregar Mais';
        }
    };

    // Em js/app.js, SUBSTITUA a função processAvailabilityTimeline por esta versão final:

/**
 * [VERSÃO DEFINITIVA E CORRIGIDA]
 * Calcula os blocos de disponibilidade usando um algoritmo de "ponteiro" que caminha pela linha do tempo.
 * Esta abordagem é mais simples e robusta contra erros de fuso horário.
 */
    const processAvailabilityTimeline = (busySlots, dayStr) => {
        const timeline = [];

        // Converte os horários ocupados para objetos Date e os ordena
        const busyTimes = busySlots.map(slot => ({
            start: new Date(slot.start),
            end: new Date(slot.end)
        })).sort((a, b) => a.start - b.start);

        // Define o início e o fim do dia de trabalho
        const workDayStart = new Date(dayStr + 'T00:00:00');
        const workDayEnd = new Date(dayStr + 'T23:59:59');  

        // "Ponteiro" que marca o início do próximo bloco a ser analisado
        let currentTime = workDayStart;

        // Itera sobre cada bloco ocupado
        for (const busyBlock of busyTimes) {
            // Se há um espaço livre entre o nosso ponteiro e o início do próximo bloco ocupado...
            if (currentTime < busyBlock.start) {
                timeline.push({ type: 'free', start: currentTime, end: busyBlock.start });
            }

            // Adiciona o bloco ocupado
            // Garante que o bloco ocupado não ultrapasse os limites do dia de trabalho
            const busyStart = currentTime > busyBlock.start ? currentTime : busyBlock.start;
            const busyEnd = workDayEnd < busyBlock.end ? workDayEnd : busyBlock.end;
            if (busyStart < busyEnd) { // Só adiciona se for um intervalo válido
                timeline.push({ type: 'busy', start: busyStart, end: busyEnd });
            }
        
            // Atualiza o ponteiro para o final do bloco ocupado que acabamos de processar
            if (busyBlock.end > currentTime) {
                currentTime = busyBlock.end;
            }
        }

        // Se o ponteiro ainda não chegou ao final do dia de trabalho, o resto do tempo está livre
        if (currentTime < workDayEnd) {
            timeline.push({ type: 'free', start: currentTime, end: workDayEnd });
        }

        // Formata a saída para a função de renderização
        const formatTime = (date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return timeline.map(block => ({
            type: block.type,
            start: formatTime(block.start),
            end: formatTime(block.end)
        }));
    };

    
    const renderAvailabilityBlocks = (timeline, dateStr) => {
        const formattedDate = new Date(dateStr + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        elements.availabilityHeader.textContent = `Disponibilidade para ${formattedDate}`;
        elements.availabilityListWrapper.innerHTML = '';
        elements.availabilityPlaceholder.textContent = '';

        if (timeline.length === 0) {
            elements.availabilityPlaceholder.textContent = `O dia inteiro (das 08:00 às 22:00) está livre.`;
        } else {
            timeline.forEach(block => {
                const blockDiv = document.createElement('div');
                // Adiciona a classe correta para o estilo visual (fundo verde/vermelho)
                blockDiv.className = `availability-block slot-${block.type}`;
                
                // Adiciona o texto "Livre" ou "Ocupado" para clareza
                const statusText = block.type === 'free' ? '(Livre)' : '(Ocupado)';
                blockDiv.textContent = `${block.start} - ${block.end} ${statusText}`;
                
                elements.availabilityListWrapper.appendChild(blockDiv);
            });
        }
        elements.availabilityResultsContainer.classList.remove('hidden');
    };
    const handleFindAvailability = async () => {
        const calendarId = elements.calendarSelect.value;
        const dateStr = elements.filterStartDate.value;

        if (!calendarId) return showToast('Por favor, selecione uma quadra.', 'error');
        if (!dateStr) return showToast('Por favor, selecione uma data no campo "Mostrar a partir de:".', 'error');

        showLoader('Verificando disponibilidade...');
        hideAvailabilityResults(); // Garante que a área esteja limpa
        
        try {
            const response = await api.findAvailability(calendarId, dateStr);
            // Usa as novas funções para processar e renderizar
            const timeline = processAvailabilityTimeline(response.busy, dateStr);
            renderAvailabilityBlocks(timeline, dateStr);
        } catch (error) {
            showToast(`Erro ao buscar disponibilidade: ${error.message}`, 'error');
            hideAvailabilityResults(); // Oculta a área em caso de erro
        } finally {
            hideLoader();
        }
    };

    const handleClearFilters = () => {
        elements.filterStartDate.value = '';
        elements.filterEndDate.value = '';
    // O correto é limpar o container de eventos e esconder os elementos relevantes
        elements.eventsListContainer.innerHTML = '<p id="events-placeholder">Selecione uma quadra e clique em "Buscar Eventos".</p>';
        elements.selectedCourtDisplay.classList.add('hidden');
        elements.loadMoreContainer.classList.add('hidden');
        hideAvailabilityResults();
    };

    // SUBSTITUA sua função handleCreateEvent inteira por esta versão completa e correta:

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        const formData = new FormData(elements.createEventForm);
        const startTime = new Date(formData.get('start'));
        const endTime = new Date(formData.get('end'));
        
        if (!formData.get('start') || !formData.get('end') || !formData.get('summary')) {
            return showToast('Título, Início e Fim são obrigatórios.', 'error');
        }
        if (endTime <= startTime) {
            return showToast('Erro: A data de Fim deve ser posterior à data de Início.', 'error');
        }
        if (!state.selectedCalendarId) {
            return showToast('Selecione uma quadra antes de agendar.', 'error');
        }
        
        const eventData = {
            summary: formData.get('summary'),
            description: formData.get('description'),
            start: { dateTime: startTime.toISOString() },
            end: { dateTime: endTime.toISOString() },
        };

        // ▼▼▼ ESTE É O BLOCO DE LÓGICA INTEIRO QUE ESTAVA FALTANDO ▼▼▼
        const frequency = elements.recurrenceFrequency.value;
        if (frequency !== 'none') {
            eventData.frequency = frequency; // Adiciona a frequência ao objeto

            const recurrenceEndDate = document.getElementById('recurrence-end-date').value;
            if (!recurrenceEndDate) {
                // Esconde o loader caso a validação falhe
                hideLoader(); 
                return showToast('Para eventos recorrentes, a data final é obrigatória.', 'error');
            }
            eventData.recurrence_end_date = recurrenceEndDate;

            if (frequency === 'weekly') {
                const checkedDays = Array.from(document.querySelectorAll('input[name="recurrence-day"]:checked'))
                                        .map(cb => cb.value);
                if (checkedDays.length === 0) {
                    // Esconde o loader caso a validação falhe
                    hideLoader(); 
                    return showToast('Para eventos semanais, selecione pelo menos um dia da semana.', 'error');
                }
                eventData.recurrence_days = checkedDays;
            }
        }
        // ▲▲▲ FIM DO BLOCO DE LÓGICA FALTANTE ▲▲▲

        showLoader('Processando agendamento...');
        try {
            const response = await api.createEvent(state.selectedCalendarId, eventData);
            hideLoader();

            // Nova lógica para decidir a cor do aviso
            if (response.created_count === 0 && response.skipped_count > 0) {
                showToast(response.message, 'error'); // Mostra em vermelho se nada foi criado
            } else {
                showToast(response.message, 'success'); // Mostra em verde nos outros casos
            }

            if (response.skipped_events && response.skipped_events.length > 0) {
                showConflictReport(response.skipped_events);
            }

            elements.createEventForm.reset();
            elements.recurrenceFrequency.dispatchEvent(new Event('change'));
            handleFindEvents();

        } catch (error) {
            hideLoader();
            showToast(`Erro ao agendar evento: ${error.message}`, 'error');
        }
    };

    // Em js/app.js
    const showConflictReport = (skipped_events) => {
        elements.conflictList.innerHTML = ''; // Limpa a lista antiga

        skipped_events.forEach(skipped => {
            const startDate = new Date(skipped.start);
            const formattedDate = startDate.toLocaleDateString('pt-BR');
            const formattedTime = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const listItem = document.createElement('li');
            listItem.innerHTML = `<strong>${formattedDate} às ${formattedTime}</strong>: Conflito com "${skipped.reason}"`;
            elements.conflictList.appendChild(listItem);
        });

        elements.conflictReportModal.classList.remove('hidden');
    };
    
    // Em js/app.js, SUBSTITUA a sua função handleEventActionClick inteira por esta:

    const handleEventActionClick = (e) => {
        const target = e.target.closest('.btn');
        if (!target || target.disabled) return;

        const eventId = target.dataset.eventId;
        if (!eventId) return;

        // 1. Primeiro, encontramos o objeto completo do evento na nossa lista de estado.
        const event = state.currentEvents.find(ev => ev.id === eventId);
        if (!event) {
            showToast('Erro: Evento não encontrado na lista atual.', 'error');
            return;
        }

        // 2. Definimos o evento a ser modificado no estado GLOBAL.
        state.eventToModify = { id: eventId, calendarId: state.selectedCalendarId };

        const isRecurring = !!event.extendedProperties?.private?.seriesId;

        // 3. Agora, decidimos o que fazer com base no botão clicado.
        if (target.classList.contains('btn-cancel')) {
            if (isRecurring) {
                // Se for recorrente, mostra o modal de opções de exclusão.
                elements.deleteOptionsModal.classList.remove('hidden');
            } else {
                // Se for um evento único, mostra o modal de confirmação simples.
                elements.confirmModalText.textContent = 'Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.';
                elements.confirmModal.classList.remove('hidden');
            }
        } 
        else if (target.classList.contains('btn-reschedule')) {
            // A lógica de reagendamento agora funcionará corretamente para eventos únicos.
            // O botão já estará desabilitado para eventos recorrentes.
            elements.rescheduleEventTitle.textContent = event.summary;
            if (event.start?.dateTime) elements.rescheduleStartTimeInput.value = event.start.dateTime.slice(0, 16);
            if (event.end?.dateTime) elements.rescheduleEndTimeInput.value = event.end.dateTime.slice(0, 16);
            elements.rescheduleModal.classList.remove('hidden');
        }
    };
    
    const handleConfirmDelete = async () => {
        if (!state.eventToModify) return;
        showLoader('Excluindo agendamento...');
        try {
            const response = await api.deleteEvent(state.eventToModify.id, state.eventToModify.calendarId);
            hideLoader();
            showToast(response.message, 'success');
            handleFindEvents();
        } catch (error) {
            hideLoader();
            showToast(`Erro ao cancelar agendamento: ${error.message}`, 'error');
        } finally {
            state.eventToModify = null;
            elements.confirmModal.classList.add('hidden');
        }
    };
    
const handleRescheduleEvent = async (e) => {
        e.preventDefault();
        if (!state.eventToModify) return;

        const startTime = new Date(elements.rescheduleStartTimeInput.value);
        const endTime = new Date(elements.rescheduleEndTimeInput.value);

        if (endTime <= startTime) {
            return showToast('Erro: A nova data de Fim deve ser posterior à de Início.', 'error');
        }

        // Prepara os dados para a API.
        // O backend agora espera um objeto EventUpdateRequest completo.
        const updateData = {
            start: { dateTime: startTime.toISOString() },
            end: { dateTime: endTime.toISOString() },
            // Vamos manter o summary e description originais, pois o formulário não os altera
            summary: elements.rescheduleEventTitle.textContent 
        };

        showLoader('Reagendando evento e atualizando bloqueios...');
        try {
            // A chamada para a API continua a mesma
            const response = await api.updateEvent(state.eventToModify.id, state.eventToModify.calendarId, updateData);
            hideLoader();
            showToast(response.message, 'success');
            handleFindEvents(); // Atualiza a lista para refletir a mudança
        } catch (error) {
            hideLoader();
            showToast(`Erro ao reagendar evento: ${error.message}`, 'error');
        } finally {
            state.eventToModify = null;
            elements.rescheduleModal.classList.add('hidden');
        }
    };

    // Adiciona todos os listeners de eventos da aplicação
    elements.signOutBtn.addEventListener('click', () => {
        idToken = null;
        google.accounts.id.disableAutoSelect();
        window.location.reload();
    });
    elements.findEventsBtn.addEventListener('click', handleFindEvents);
    elements.clearFiltersBtn.addEventListener('click', handleClearFilters);
    elements.loadMoreBtn.addEventListener('click', handleLoadMore);
    elements.createEventForm.addEventListener('submit', handleCreateEvent);
    elements.eventsListContainer.addEventListener('click', handleEventActionClick);
    elements.calendarSelect.addEventListener('change', () => {
        elements.eventsListContainer.innerHTML = `<p id="events-placeholder">Clique em "Buscar Eventos" para ver os agendamentos da nova quadra.</p>`;
        elements.loadMoreContainer.classList.add('hidden');
        elements.selectedCourtDisplay.classList.add('hidden'); 
        state.nextPageToken = null;
        hideAvailabilityResults();
    });
    elements.confirmModalCancelBtn.addEventListener('click', () => {
        state.eventToModify = null;
        elements.confirmModal.classList.add('hidden');
    });
    elements.conflictModalCloseBtn.addEventListener('click', () => {
        elements.conflictReportModal.classList.add('hidden');
    });
    elements.confirmModalConfirmBtn.addEventListener('click', handleConfirmDelete);
    elements.rescheduleModalCancelBtn.addEventListener('click', () => {
        state.eventToModify = null;
        elements.rescheduleModal.classList.add('hidden');
    });
    elements.rescheduleForm.addEventListener('submit', handleRescheduleEvent);
    elements.findAvailabilityBtn.addEventListener('click', handleFindAvailability);
    elements.toggleFormBtn.addEventListener('click', () => {
        elements.createEventForm.classList.toggle('hidden');
        const isHidden = elements.createEventForm.classList.contains('hidden');
        elements.toggleFormBtn.textContent = isHidden ? 'Mostrar Formulário' : 'Ocultar Formulário';
    });

    // Carregamento inicial das quadras
    showLoader('Carregando quadras...');
    api.listCalendars().then(response => {
        renderCalendars(response.items || []);
    }).catch(error => {
        if (error.message !== 'Usuário não autenticado.') {
            showToast(`Erro fatal ao carregar as quadras: ${error.message}`, 'error');
        } else {
            console.log("Aguardando login do usuário...");
        }
        elements.calendarSelect.innerHTML = '<option value="" disabled selected>Erro ao carregar</option>';
    }).finally(() => {
        hideLoader();
    });

    // Em js/app.js, adicione esta nova função

    const hideAvailabilityResults = () => {
        if (elements.availabilityResultsContainer) {
            elements.availabilityResultsContainer.classList.add('hidden');
            elements.availabilityListWrapper.innerHTML = '';
            elements.availabilityPlaceholder.textContent = '';
        }
    };

    elements.recurrenceFrequency.addEventListener('change', (e) => {
        const frequency = e.target.value;

        // Mostra ou esconde as opções de dias da semana
        if (frequency === 'weekly') {
            elements.recurrenceWeeklyOptions.classList.remove('hidden');
        } else {
            elements.recurrenceWeeklyOptions.classList.add('hidden');
        }

        // Mostra ou esconde a opção de data final
        if (frequency === 'none') {
            elements.recurrenceEndDateContainer.classList.add('hidden');
        } else {
            elements.recurrenceEndDateContainer.classList.remove('hidden');
        }
    });

    // Em js/app.js, adicione estes listeners no final da initializeAppLogic

    elements.deleteOptionsCancelBtn.addEventListener('click', () => {
        elements.deleteOptionsModal.classList.add('hidden');
    });

    const handleDeleteRecurring = async (deleteScope) => {
        if (!state.eventToModify) return;
        
        showLoader('Excluindo agendamento(s)...');
        elements.deleteOptionsModal.classList.add('hidden');

        try {
            const response = await api.deleteRecurringEvent(state.eventToModify.id, state.eventToModify.calendarId, deleteScope);
            hideLoader();
            showToast(response.message, 'success');
            handleFindEvents();
        } catch (error) {
            hideLoader();
            showToast(`Erro ao excluir: ${error.message}`, 'error');
        } finally {
            state.eventToModify = null;
        }
    };

    elements.deleteThisEventBtn.addEventListener('click', () => handleDeleteRecurring('this_event'));
    elements.deleteFutureEventsBtn.addEventListener('click', () => handleDeleteRecurring('future_events'));
    elements.deleteAllEventsBtn.addEventListener('click', () => handleDeleteRecurring('all_events'));
}
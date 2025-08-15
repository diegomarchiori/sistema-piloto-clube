# Em src/auth.py - VERSÃO MODIFICADA E CORRETA
import os
import logging
from google.oauth2 import service_account
from google.auth.exceptions import DefaultCredentialsError
from .config import settings # Importar as configurações do seu projeto
from typing import Optional

KEY_FILE_PATH = 'service-account-key.json'
SCOPES = ['https://www.googleapis.com/auth/calendar']

logger = logging.getLogger(__name__)

def get_service_account_credentials(user_to_impersonate: Optional[str] = None):
    """
    Carrega as credenciais da Conta de Serviço e as prepara para
    personificar um usuário.
    - Se 'user_to_impersonate' for fornecido, usa esse email.
    - Caso contrário, usa o email padrão do config.yaml.
    """
    if not os.path.exists(KEY_FILE_PATH):
        logger.error(f"Arquivo de chave da Conta de Serviço não encontrado: '{KEY_FILE_PATH}'")
        raise FileNotFoundError(f"O arquivo de chave '{KEY_FILE_PATH}' é necessário.")

    # --- INÍCIO DA ALTERAÇÃO ---
    # Se um e-mail não for passado diretamente para a função,
    # pegamos o e-mail do admin padrão do arquivo de configuração.
    if not user_to_impersonate:
        user_to_impersonate = settings.get('impersonation_user_email')
    # --- FIM DA ALTERAÇÃO ---

    if not user_to_impersonate:
        logger.error("A chave 'impersonation_user_email' não foi encontrada no config.yaml e nenhum usuário foi fornecido.")
        raise ValueError("Email para personificação não configurado.")

    try:
        # Carrega as credenciais base do arquivo JSON
        base_creds = service_account.Credentials.from_service_account_file(
            KEY_FILE_PATH, scopes=SCOPES
        )
        
        # Cria um novo objeto de credenciais que irá personificar o usuário especificado.
        creds_with_subject = base_creds.with_subject(user_to_impersonate)
        
        logger.info(f"Credenciais da Conta de Serviço carregadas com sucesso e configuradas para personificar '{user_to_impersonate}'.")
        return creds_with_subject
        
    except Exception as e:
        logger.error(f"Falha ao carregar ou personificar as credenciais da Conta de Serviço: {e}", exc_info=True)
        raise DefaultCredentialsError(f"Erro ao processar o arquivo de chave ou configurar a personificação: {e}")
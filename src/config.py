# src/config.py
import yaml
import logging

logger = logging.getLogger(__name__)

def load_config():
    try:
        with open('config.yaml', 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        logger.info("Arquivo 'config.yaml' carregado com sucesso.")
        return config
    except FileNotFoundError:
        logger.error("ERRO CRÍTICO: Arquivo 'config.yaml' não foi encontrado na raiz do projeto.")
        return {} # Retorna um dict vazio para evitar que a aplicação quebre
    except Exception as e:
        logger.error(f"Erro ao carregar ou processar 'config.yaml': {e}")
        return {}

# Carrega as configurações uma vez para serem usadas em toda a aplicação
settings = load_config()
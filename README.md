# Sistema de Agendamento de Quadras - Clube

Sistema web para agendamento de quadras esportivas integrado com Google Calendar.

## 🚀 Funcionalidades

- Autenticação via Google OAuth
- Integração com Google Calendar
- Interface web responsiva
- Agendamento de horários para quadras
- Visualização de disponibilidade

## 📋 Pré-requisitos

- Python 3.8+
- Conta Google com acesso ao Google Calendar API
- Service Account do Google Cloud Platform

## 🔧 Instalação

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd sistema-piloto-clube
```

### 2. Crie um ambiente virtual
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# ou
source venv/bin/activate  # Linux/Mac
```

### 3. Instale as dependências
```bash
pip install -r requirements.txt
```

### 4. Configuração

#### 4.1 Google Cloud Platform
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a Google Calendar API
4. Crie credenciais:
   - **Service Account**: Para acesso ao calendário
   - **OAuth 2.0**: Para autenticação de usuários

#### 4.2 Arquivos de Configuração

Crie os seguintes arquivos (não incluídos no repositório por segurança):

**`.env`**
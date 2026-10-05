"""Sincroniza escalas no servidor. Multas são decididas exclusivamente pelo banco."""
import json
import os
from pathlib import Path
import requests


def main():
    base = Path(__file__).resolve().parent
    url = os.environ['SUPABASE_URL'].rstrip('/')
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    headers = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
    escalas = json.loads((base / 'escalas.json').read_text(encoding='utf-8'))
    response = requests.post(url + '/rest/v1/rpc/faxina_sincronizar_escalas',
                             headers=headers, json={'p_escalas': escalas}, timeout=30)
    response.raise_for_status()
    print('Escalas sincronizadas. Multas são processadas pelo cron do Supabase.')


if __name__ == '__main__':
    main()

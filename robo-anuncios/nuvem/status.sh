#!/usr/bin/env bash
# Mostra a situação do robô de anúncios na nuvem.
API=http://localhost:2785/api
KEY=$(cat /opt/robo-anuncios/OpenWA/data/.api-key 2>/dev/null)
echo "OpenWA:  $(systemctl is-active openwa)   |   Robô: $(systemctl is-active robo-anuncios)"
curl -fsS -H "X-API-Key: $KEY" $API/sessions 2>/dev/null | jq -r '.[] | "Sessão \(.name): \(.status)  número: \(.phone // "-")"' || echo "OpenWA ainda não respondeu."
echo "Robô diz: $(curl -fsS http://localhost:3999/ 2>/dev/null || echo 'ainda ligando')"
echo "--- últimas linhas do robô ---"
tail -n 8 /opt/robo-anuncios/robo-log.txt 2>/dev/null
free -h | head -2

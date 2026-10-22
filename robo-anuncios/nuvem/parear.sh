#!/usr/bin/env bash
# Conecta o CHIP DOS ANÚNCIOS no OpenWA da nuvem usando CÓDIGO DE 8 LETRAS (sem QR Code).
# Uso: sudo /opt/robo-anuncios/parear.sh 5511XXXXXXXXX   (número do chip dos anúncios, com 55 e DDD)
set -euo pipefail
NUM="${1:-}"; NUM="${NUM//[^0-9]/}"
PESSOAL=5511988782027
[ -n "$NUM" ] || { echo "Informe o número do CHIP DOS ANÚNCIOS. Ex.: sudo $0 5511912345678"; exit 1; }
[ "${NUM: -8}" != "${PESSOAL: -8}" ] || { echo "PARE: esse é o seu número PESSOAL. Use o número do chip dos anúncios."; exit 1; }
API=http://localhost:2785/api
KEY=$(cat /opt/robo-anuncios/OpenWA/data/.api-key)
H=(-H "X-API-Key: $KEY" -H "Content-Type: application/json")
echo "Esperando o OpenWA responder..."
for i in $(seq 1 60); do curl -fsS $API/health >/dev/null 2>&1 && break; sleep 5; done
SID=$(curl -fsS "${H[@]}" $API/sessions | jq -r '.[] | select(.name=="atendimento-anuncios") | .id')
if [ -z "$SID" ]; then
  SID=$(curl -fsS "${H[@]}" -X POST $API/sessions -d '{"name":"atendimento-anuncios"}' | jq -r .id)
fi
curl -fsS "${H[@]}" -X POST $API/sessions/$SID/start >/dev/null || true
for i in $(seq 1 24); do
  ST=$(curl -fsS "${H[@]}" $API/sessions/$SID | jq -r .status)
  [ "$ST" = qr_ready ] && break
  [ "$ST" = ready ] && { echo "Já está conectado."; exit 0; }
  sleep 5
done
COD=$(curl -fsS "${H[@]}" -X POST $API/sessions/$SID/pairing-code -d "{\"phoneNumber\":\"$NUM\"}" | jq -r .pairingCode)
echo
echo "=============================================="
echo "   CÓDIGO PARA O WHATSAPP:   $COD"
echo "=============================================="
echo "No celular do CHIP DOS ANÚNCIOS: WhatsApp → ⋮ → Aparelhos conectados → Conectar aparelho"
echo "→ 'Conectar com número de telefone' → digite o código acima."
echo "Depois rode:  sudo /opt/robo-anuncios/status.sh"

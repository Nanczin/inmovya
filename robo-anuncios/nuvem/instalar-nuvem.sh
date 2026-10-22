#!/usr/bin/env bash
# Robô de anúncios — instalação na NUVEM (reserva), para Google Cloud e2-micro (Debian 12, 1 GB de RAM).
# Uso (no terminal SSH do servidor):
#   curl -fsSL https://raw.githubusercontent.com/Nanczin/inmovya/main/robo-anuncios/nuvem/instalar-nuvem.sh | sudo bash
# Pode rodar de novo sem problema: o que já existe é mantido (nada é apagado).
set -euo pipefail

BASE=/opt/robo-anuncios
OPENWA=$BASE/OpenWA
OPENWA_TAG=v0.25.0          # mesma versão do PC
RAW=https://raw.githubusercontent.com/Nanczin/inmovya/main/robo-anuncios
USUARIO=robo

passo() { echo; echo "=== $* ==="; }

[ "$(id -u)" = 0 ] || { echo "Rode com sudo."; exit 1; }

passo "1/7 Memória extra (swap de 2 GB) — o servidor grátis tem só 1 GB"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h | head -3

passo "2/7 Programas básicos e Node.js 22"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates jq >/dev/null
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v

passo "3/7 Usuário e pasta do robô"
id $USUARIO >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin $USUARIO
mkdir -p $BASE && chown $USUARIO:$USUARIO $BASE

passo "4/7 Baixando o OpenWA ($OPENWA_TAG)"
if [ ! -f $OPENWA/package.json ]; then
  sudo -u $USUARIO git clone -q --depth 1 --branch $OPENWA_TAG https://github.com/rmyndharis/OpenWA.git $OPENWA
fi
# O painel (dashboard) não é usado na nuvem: guardado fora para não gastar memória/disco na instalação.
if [ -d $OPENWA/dashboard ]; then mv $OPENWA/dashboard $BASE/dashboard-nao-usado; fi

passo "5/7 Instalando e compilando o OpenWA (pode levar 15–30 min no servidor grátis)"
cd $OPENWA
if [ ! -f $OPENWA/dist/main.js ]; then
  sudo -u $USUARIO env PUPPETEER_SKIP_DOWNLOAD=true NODE_OPTIONS=--max-old-space-size=1536 npm ci --no-audit --no-fund
  sudo -u $USUARIO env NODE_OPTIONS=--max-old-space-size=1536 npm run build
fi
ls -la dist/main.js

passo "6/7 Robô (robo.js) e configuração"
sudo -u $USUARIO curl -fsSL $RAW/robo.js -o $BASE/robo.js
if [ ! -f $BASE/config.json ]; then
  sudo -u $USUARIO curl -fsSL $RAW/config.exemplo.json -o $BASE/config.exemplo.json
  SENHA="${ROBO_TOKEN:-}"
  if [ -z "$SENHA" ]; then
    read -r -s -p "Cole a SENHA DO ROBÔ (roboToken do config.json do PC) e aperte Enter: " SENHA < /dev/tty; echo
  fi
  sudo -u $USUARIO env SENHA="$SENHA" node -e '
    const fs=require("fs"); const c=JSON.parse(fs.readFileSync("/opt/robo-anuncios/config.exemplo.json","utf8").replace(/^﻿/,""));
    c.quem="nuvem"; c.roboToken=process.env.SENHA; c.testeSomenteNumeros=c.testeSomenteNumeros||[];
    fs.writeFileSync("/opt/robo-anuncios/config.json", JSON.stringify(c,null,2));'
  chmod 600 $BASE/config.json
fi
sudo -u $USUARIO curl -fsSL $RAW/nuvem/parear.sh -o $BASE/parear.sh && chmod +x $BASE/parear.sh
sudo -u $USUARIO curl -fsSL $RAW/nuvem/status.sh -o $BASE/status.sh && chmod +x $BASE/status.sh

passo "7/7 Ligando o OpenWA e o robô (religam sozinhos se o servidor reiniciar)"
cat > /etc/systemd/system/openwa.service <<EOF
[Unit]
Description=OpenWA (WhatsApp) - robo de anuncios
After=network-online.target
Wants=network-online.target

[Service]
User=$USUARIO
WorkingDirectory=$OPENWA
Environment=NODE_ENV=development
Environment=ENGINE_TYPE=baileys
Environment=SEND_PACING_ENABLED=true
Environment=SIMULATE_TYPING=true
Environment=AUTO_START_SESSIONS=true
Environment=SSRF_ALLOWED_HOSTS=localhost,127.0.0.1
Environment=RESOLVE_LID_TO_PHONE=true
Environment=CORS_ORIGINS=http://localhost
Environment=NODE_OPTIONS=--max-old-space-size=512
ExecStart=/usr/bin/node dist/main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/robo-anuncios.service <<EOF
[Unit]
Description=Robo de anuncios (reserva na nuvem)
After=openwa.service
Wants=openwa.service

[Service]
User=$USUARIO
WorkingDirectory=$BASE
ExecStart=/usr/bin/node robo.js
Restart=always
RestartSec=15

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now openwa.service robo-anuncios.service
echo
echo "Pronto. O OpenWA leva 1–3 minutos para ligar."
echo "Próximo passo: conectar o chip dos anúncios com:  sudo $BASE/parear.sh 55DDDNUMERO"
echo "Ver situação a qualquer momento:                    sudo $BASE/status.sh"

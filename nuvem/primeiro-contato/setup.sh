#!/usr/bin/env bash
# Cria o servidor gratuito (Oracle Always Free) e instala o 1º contato na nuvem. Rodar no Cloud Shell da Oracle,
# na pasta onde estão worker.mjs e docker-compose.yml. Pode rodar de novo: reaproveita o que já existe.
set -euo pipefail
T="${OCI_TENANCY:?rode no Cloud Shell da Oracle}"
cd "$(dirname "$0")"
echo "== Inmovya nuvem: região ${OCI_REGION:-?} =="

achar() { oci "$@" --query 'data[0].id' --raw-output 2>/dev/null | grep -v '^null$' || true; }

# ---------- rede (VCN pública com portas 22 e 8081) ----------
VCN=$(achar network vcn list -c "$T" --display-name inmovya-vcn --lifecycle-state AVAILABLE)
if [ -z "$VCN" ]; then
  VCN=$(oci network vcn create -c "$T" --cidr-block 10.0.0.0/16 --display-name inmovya-vcn --dns-label inmovya --wait-for-state AVAILABLE --query data.id --raw-output)
  IGW=$(oci network internet-gateway create -c "$T" --vcn-id "$VCN" --is-enabled true --display-name inmovya-igw --wait-for-state AVAILABLE --query data.id --raw-output)
  RT=$(oci network vcn get --vcn-id "$VCN" --query 'data."default-route-table-id"' --raw-output)
  oci network route-table update --rt-id "$RT" --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW\"}]" --force >/dev/null
  SL=$(oci network vcn get --vcn-id "$VCN" --query 'data."default-security-list-id"' --raw-output)
  oci network security-list update --security-list-id "$SL" --force --ingress-security-rules '[
    {"protocol":"6","source":"0.0.0.0/0","tcpOptions":{"destinationPortRange":{"min":22,"max":22}}},
    {"protocol":"6","source":"0.0.0.0/0","tcpOptions":{"destinationPortRange":{"min":8081,"max":8081}}},
    {"protocol":"1","source":"0.0.0.0/0","icmpOptions":{"type":3,"code":4}}]' >/dev/null
  echo "rede criada"
fi
SUB=$(achar network subnet list -c "$T" --vcn-id "$VCN" --display-name inmovya-sub --lifecycle-state AVAILABLE)
if [ -z "$SUB" ]; then
  SUB=$(oci network subnet create -c "$T" --vcn-id "$VCN" --cidr-block 10.0.0.0/24 --display-name inmovya-sub --dns-label sub --wait-for-state AVAILABLE --query data.id --raw-output)
fi

# ---------- servidor ----------
INST=$(achar compute instance list -c "$T" --display-name inmovya-nuvem --lifecycle-state RUNNING)
if [ -z "$INST" ]; then
  [ -f ~/.ssh/inmovya ] || ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/inmovya -q
  QR=$(openssl rand -hex 10)
  echo "$QR" > ~/.inmovya_qr
  W64=$(gzip -9c worker.mjs | base64 -w0)
  C64=$(gzip -9c docker-compose.yml | base64 -w0)
  cat > user-data.sh <<EOF
#!/bin/bash
set -x
# memória extra (servidor pequeno)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
# libera a porta da página do QR Code no firewall do Ubuntu da Oracle
iptables -I INPUT 6 -p tcp --dport 8081 -j ACCEPT && netfilter-persistent save || true
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/inmovya/data && cd /opt/inmovya
echo "$W64" | base64 -d | gunzip > worker.mjs
echo "$C64" | base64 -d | gunzip > docker-compose.yml
cat > .env <<ENV
EVO_KEY=\$(openssl rand -hex 24)
PG_SENHA=\$(openssl rand -hex 16)
QR_PATH=$QR
ENV
chmod 600 .env
docker compose up -d
EOF
  AD=$(oci iam availability-domain list -c "$T" --query 'data[0].name' --raw-output)
  for FORMA in "VM.Standard.A1.Flex:2:12" "VM.Standard.A1.Flex:1:6" "VM.Standard.E2.1.Micro::"; do
    SHAPE=${FORMA%%:*}; R=${FORMA#*:}; CPU=${R%%:*}; MEM=${R#*:}
    IMG=$(oci compute image list -c "$T" --operating-system "Canonical Ubuntu" --operating-system-version "22.04" --shape "$SHAPE" --sort-by TIMECREATED --sort-order DESC --limit 1 --query 'data[0].id' --raw-output)
    CFG=(); [ -n "$CPU" ] && CFG=(--shape-config "{\"ocpus\":$CPU,\"memoryInGBs\":$MEM}")
    echo "tentando $SHAPE ${CPU:+$CPU CPU / $MEM GB}..."
    if INST=$(oci compute instance launch -c "$T" --availability-domain "$AD" --display-name inmovya-nuvem \
        --shape "$SHAPE" "${CFG[@]}" --image-id "$IMG" --subnet-id "$SUB" --assign-public-ip true \
        --ssh-authorized-keys-file ~/.ssh/inmovya.pub --user-data-file user-data.sh \
        --wait-for-state RUNNING --max-wait-seconds 900 --query data.id --raw-output 2>launch.err); then
      echo "servidor criado: $SHAPE"; break
    else
      echo "  não deu: $(grep -o '"message": "[^"]*"' launch.err | head -1)"; INST=""
    fi
  done
  [ -n "$INST" ] || { echo "ERRO: a Oracle não tem servidor gratuito livre agora. Tente de novo mais tarde."; exit 1; }
fi
IP=$(oci compute instance list-vnics --instance-id "$INST" --query 'data[0]."public-ip"' --raw-output)
QR=$(cat ~/.inmovya_qr 2>/dev/null || echo "?")
echo "$IP" > ~/.inmovya_ip
echo
echo "PRONTO. Em 3 a 5 minutos o servidor termina de instalar."
echo "Página para ligar: http://$IP:8081/$QR"
echo "Ver o que o robô está fazendo: ssh -i ~/.ssh/inmovya ubuntu@$IP 'cd /opt/inmovya && sudo docker compose logs --tail 30 robo'"

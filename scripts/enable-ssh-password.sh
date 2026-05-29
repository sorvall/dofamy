#!/bin/bash
# Запустите НА СЕРВЕРЕ через консоль хостинга (VNC / web terminal), если SSH по паролю не работает.
set -euo pipefail

SSHD="/etc/ssh/sshd_config"
backup="${SSHD}.bak.$(date +%Y%m%d%H%M%S)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root: sudo bash $0"
  exit 1
fi

cp "$SSHD" "$backup"
echo "Backup: $backup"

set_opt() {
  local key="$1" val="$2"
  if grep -qE "^[#[:space:]]*${key}[[:space:]]" "$SSHD"; then
    sed -i "s/^[#[:space:]]*${key}[[:space:]].*/${key} ${val}/" "$SSHD"
  else
    echo "${key} ${val}" >> "$SSHD"
  fi
}

set_opt PasswordAuthentication yes
set_opt KbdInteractiveAuthentication yes
set_opt PubkeyAuthentication yes
set_opt PermitRootLogin yes
set_opt ChallengeResponseAuthentication yes

if command -v systemctl >/dev/null 2>&1; then
  systemctl restart sshd 2>/dev/null || systemctl restart ssh 2>/dev/null
elif command -v service >/dev/null 2>&1; then
  service sshd restart 2>/dev/null || service ssh restart
fi

echo "Готово. Проверьте с Mac: ssh root@IP"
grep -E '^(PasswordAuthentication|PermitRootLogin|KbdInteractiveAuthentication)' "$SSHD" || true

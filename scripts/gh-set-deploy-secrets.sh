#!/usr/bin/env bash
# Задаёт секреты деплоя в GitHub Actions для sorvall/dofamy.
#
# 1. cp .env.deploy.example .env.deploy
# 2. Заполните значения (те же, что в urbanscore, если тот же сервер)
# 3. ./scripts/gh-set-deploy-secrets.sh
#
# Нужен GitHub CLI: brew install gh && gh auth login

set -euo pipefail

REPO="${GITHUB_REPO:-sorvall/dofamy}"
ENV_FILE="${1:-.env.deploy}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Установите GitHub CLI: brew install gh && gh auth login"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Файл $ENV_FILE не найден. Скопируйте .env.deploy.example → .env.deploy"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

for key in SERVER_HOST SERVER_USER SSH_PASSWORD; do
  val="${!key:-}"
  if [ -z "$val" ]; then
    echo "Пустое значение: $key"
    exit 1
  fi
  printf '%s' "$val" | gh secret set "$key" --repo "$REPO"
  echo "OK: $key"
done

if [ -n "${DEPLOY_PATH:-}" ]; then
  printf '%s' "$DEPLOY_PATH" | gh secret set DEPLOY_PATH --repo "$REPO"
  echo "OK: DEPLOY_PATH"
else
  echo "DEPLOY_PATH не задан — в workflow будет /root/dofamy"
fi

if [ -n "${SSH_PORT:-}" ]; then
  printf '%s' "$SSH_PORT" | gh secret set SSH_PORT --repo "$REPO"
  echo "OK: SSH_PORT"
fi

echo "Готово. Секреты обновлены в https://github.com/$REPO/settings/secrets/actions"

#!/usr/bin/env bash
#
# 在香港节点构建增强版 Ollama install.sh
# - 从官方 https://ollama.com/install.sh 拉取最新版
# - 在头部注入客户端本地 Shadowsocks 启动逻辑
# - 在尾部追加清理逻辑
#
# 使用前请先修改下方 CHANGE_ME_* 占位值。

set -euo pipefail

WORK_DIR=/opt/ollama-build
UPSTREAM="$WORK_DIR/install.upstream.sh"
OUT="/var/www/mirror/ollama-install.sh"

mkdir -p "$WORK_DIR"

echo "==> Fetching official install.sh from ollama.com ..."
curl -fsSL https://ollama.com/install.sh -o "$UPSTREAM"

echo "==> Building wrapped install.sh with Shadowsocks bootstrap ..."

cat >"$OUT" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail

# ========= Shadowsocks 客户端配置 =========
# 将你的 ss:// 链接中 @ 前的 base64 段填入下方（不含前缀 ss:// 与后缀 @host:port）
SS_URI_BASE64="CHANGE_ME_SS_URI_BASE64"
SS_SERVER="CHANGE_ME_SS_SERVER"
SS_PORT=CHANGE_ME_SS_PORT
SS_LOCAL_PORT=1080
SS_BIN=""

_method_pwd="$(printf '%s' "$SS_URI_BASE64" | base64 -d 2>/dev/null || true)"
if [ -z "$_method_pwd" ]; then
  exit 1
fi
SS_METHOD="${_method_pwd%%:*}"
SS_PASSWORD="${_method_pwd#*:}"

cleanup() {
  if [ -n "${SS_PID:-}" ] && kill -0 "$SS_PID" 2>/dev/null; then
    kill "$SS_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

detect_ss_client() {
  if command -v ss-local >/dev/null 2>&1; then
    SS_BIN="ss-local"
    return
  fi

  if command -v go-shadowsocks2 >/dev/null 2>&1; then
    SS_BIN="go-shadowsocks2"
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y >/dev/null 2>&1 || true
    sudo apt-get install -y shadowsocks-libev >/dev/null 2>&1 || true
  elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
    PM="$(command -v dnf 2>/dev/null || command -v yum 2>/dev/null || true)"
    if [ -n "$PM" ]; then
      "$PM" -y install epel-release >/dev/null 2>&1 || true
      "$PM" -y install shadowsocks-libev >/dev/null 2>&1 || true
    fi
  fi

  if command -v ss-local >/dev/null 2>&1; then
    SS_BIN="ss-local"
    return
  fi

  if command -v go-shadowsocks2 >/dev/null 2>&1; then
    SS_BIN="go-shadowsocks2"
    return
  fi

  exit 1
}

start_ss() {
  detect_ss_client

  if [ "$SS_BIN" = "ss-local" ]; then
    cat >/tmp/ss-client.json <<EOF_SS
{
  "server": "${SS_SERVER}",
  "server_port": ${SS_PORT},
  "local_address": "127.0.0.1",
  "local_port": ${SS_LOCAL_PORT},
  "password": "${SS_PASSWORD}",
  "method": "${SS_METHOD}",
  "fast_open": true,
  "mode": "tcp_and_udp"
}
EOF_SS
    ss-local -c /tmp/ss-client.json -u >/tmp/ss-local.log 2>&1 &
  else
    go-shadowsocks2 -c "ss://${SS_METHOD}:${SS_PASSWORD}@${SS_SERVER}:${SS_PORT}" \
      -socks "127.0.0.1:${SS_LOCAL_PORT}" >/tmp/ss-local.log 2>&1 &
  fi
  SS_PID=$!

  sleep 2
  if ! kill -0 "$SS_PID" 2>/dev/null; then
    exit 1
  fi

  export https_proxy="socks5h://127.0.0.1:${SS_LOCAL_PORT}"
  export http_proxy="$https_proxy"
  export all_proxy="$https_proxy"
}

start_ss

(
WRAP

cat "$UPSTREAM" >>"$OUT"

cat >>"$OUT" <<'TAIL'
)
cleanup
exit 0
TAIL

chmod +x "$OUT"
echo "build complete: $OUT"



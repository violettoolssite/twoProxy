#!/bin/bash
# 自动获取 Docker Hub 匿名 token 并缓存

TOKEN_FILE="/var/www/mirror/api/.docker-token"
TOKEN_CACHE_TIME=300  # Token 缓存时间（秒），Docker Hub token 通常有效 5 分钟

# 检查缓存的 token 是否仍然有效
if [ -f "$TOKEN_FILE" ]; then
    TOKEN_TIME=$(stat -c %Y "$TOKEN_FILE" 2>/dev/null || echo 0)
    CURRENT_TIME=$(date +%s)
    AGE=$((CURRENT_TIME - TOKEN_TIME))
    
    if [ $AGE -lt $TOKEN_CACHE_TIME ]; then
        # 使用缓存的 token
        cat "$TOKEN_FILE"
        exit 0
    fi
fi

# 获取新的 token
SCOPE="${1:-repository:library/hello-world:pull}"
SERVICE="${2:-registry.docker.io}"

TOKEN=$(curl -s "https://auth.docker.io/token?service=$SERVICE&scope=$SCOPE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -n "$TOKEN" ]; then
    # 缓存 token
    echo "$TOKEN" > "$TOKEN_FILE"
    echo "$TOKEN"
else
    # 如果获取失败，尝试使用缓存的 token（即使过期）
    if [ -f "$TOKEN_FILE" ]; then
        cat "$TOKEN_FILE"
    else
        exit 1
    fi
fi


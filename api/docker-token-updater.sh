#!/bin/bash
# 定期更新 Docker Hub token 的脚本

TOKEN_FILE="/var/www/mirror/api/.docker-token"
UPDATE_INTERVAL=240  # 每 4 分钟更新一次（token 有效期 5 分钟）

while true; do
    # 获取一个通用的匿名 token（用于所有公共镜像）
    TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/hello-world:pull" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
    
    if [ -n "$TOKEN" ]; then
        echo "$TOKEN" > "$TOKEN_FILE"
        echo "$(date): Token updated successfully"
    else
        echo "$(date): Failed to get token"
    fi
    
    sleep $UPDATE_INTERVAL
done


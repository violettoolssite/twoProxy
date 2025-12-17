# YLJD Mirror 加速站

面向国内用户的 GitHub / Docker / 通用文件加速前端与配置示例。  
本仓库只包含 **静态前端页面** 与 **示例配置脚本**，实际部署需要配合 Nginx、Shadowsocks、gh‑proxy 或自建 Python 服务等组件。

## 在线演示

🌐 **访问地址**：[https://mirror.yljdteam.com/](https://mirror.yljdteam.com/)

---

## 功能概览

- **GitHub 模块**
  - 前端搜索 GitHub 仓库（通过后端 `/gh/search/repositories` 代理 GitHub API）。
  - 展示代理后的仓库页面链接 `/github/<owner>/<repo>`。
  - 生成镜像 Clone 地址：`https://YOUR_FRONTEND_DOMAIN/github/<owner>/<repo>.git`。

- **Docker 模块**
  - 提供 `registry-mirrors` 配置 JSON。
  - 提供单次 `docker pull` 示例命令。
  - 示例 Nginx 代理：
    - 反代 **Docker Hub 官方 Registry**。
    - 也给出 **腾讯云内网加速地址** / **阿里云内网加速地址** 的示例反代配置。

- **文件下载 / 脚本 / GitHub Release 模块**
  - 支持任意直链加速：`https://origin.com/path` → `https://YOUR_FRONTEND_DOMAIN/file/https/origin.com/path`。
  - 支持直接粘贴 `curl` / `wget` 安装命令，自动替换为加速地址。
  - GitHub Release 软件包支持二级节点（例如广州）专线加速：
    - 前端将 `https://github.com/...` 改写为 `https://GZ_PROXY_DOMAIN:PORT/github/...`。
  - 示例 Ollama 安装脚本增强：
    - 由香港节点预先拼接「在客户端本地自动启停 Shadowsocks 客户端」的包装逻辑，再接上官方 `install.sh` 内容。

---

## 目录结构

```text
.
├── index.html          # 单页应用入口
├── css/
│   └── style.css       # UI 样式（浅色玻璃风格）
├── js/
│   └── app.js          # 前端逻辑（路由 / GitHub 搜索 / 下载地址生成）
├── scripts/
│   └── build-ollama-install.sh.example
│                       # 示例：服务端拉取官方 ollama install.sh 并注入客户端 SS 逻辑
└── deploy/
    ├── nginx.mirror.conf.example
    │                   # 香港节点 Nginx 示例（前端静态 + /file/https/* 通用代理）
    ├── nginx.github-proxy.conf.example
    │                   # 广州 GitHub Release 专用代理（:9090 /github/*）
    └── nginx.docker-proxy.conf.example
                        # Docker Registry 代理 (:8080 /v2/*)
```

---

## 部署架构（推荐）

> 实际部署建议 **至少两台服务器**：
>
> - 一台 **香港 / 境外节点**：负责前端站点与通用 `/file/https` 代理（本仓库代码所在的机器）。
> - 一台 **广州 / 境内或就近节点**：负责 GitHub Release 软件包与 Docker Registry 反代。
>
> 后续可以在这两台服务器前加上 **Cloudflare / 腾讯 EdgeOne** 等边缘加速服务，为终端用户提供就近接入和 DDoS 防护。

### 1. 香港节点（前端 + 通用代理）

职责：

- 提供静态前端：`index.html + css + js`。
- 提供通用直链代理：`/file/https/<host>/<path>`。
- （可选）专门处理某些脚本，如 `ollama.com/install.sh`。

示例 Nginx 配置见：`deploy/nginx.mirror.conf.example`。

> 注意：`YOUR_FRONTEND_DOMAIN` 请替换为你自己的域名（例如 `mirror.example.com`），确保有合法的 HTTPS 证书。

### 2. 广州节点（GitHub Release 软件包专线）

职责：

- 对外暴露：`https://GZ_PROXY_DOMAIN:9090/github/<owner>/<repo>/...`。
- 内部转发到自建的 gh‑proxy / Python 下载服务（例如 `127.0.0.1:18080`）。
- Python 服务内部再通过 Shadowsocks 出口拉取 GitHub 原始文件。

示例 Nginx 配置见：`deploy/nginx.github-proxy.conf.example`。

前端中，当检测到用户输入的 URL `host === "github.com"` 时，会构造该节点的加速地址：

```js
// js/app.js 中的大致逻辑（需替换为你自己的域名和端口）
return "https://GZ_PROXY_DOMAIN:9090/github" + pathname + (u.search || "");
```

### 3. Docker Registry 代理节点

职责：

- 作为 Docker `registry-mirrors` 源，为 Docker Hub 镜像提供加速。
- Nginx 将 `/v2/*` 请求转发到相应的 Registry：
  - Docker Hub 官方：`https://registry-1.docker.io`
  - 腾讯云镜像服务（内网地址示例）
  - 阿里云容器镜像服务（内网地址示例）

示例 Nginx 配置见：

- **香港节点或广州节点均可部署一套 Registry 代理**，根据你的拓扑选择：
  - `deploy/nginx.docker-proxy.dockerhub.conf`  → 反代 Docker Hub 官方。
  - `deploy/nginx.docker-proxy.tencent.conf`    → 反代腾讯云 TCR 内网地址。
  - `deploy/nginx.docker-proxy.aliyun.conf`     → 反代阿里云 ACR 内网地址。

---

## 一键部署脚本

为方便复现，本仓库提供了两份基础部署脚本（推荐系统为 **Ubuntu 24**）：

- `scripts/deploy_hk.sh`：在 **香港节点** 运行
  - 安装 `nginx`、`certbot`。
  - 同步前端静态文件到 `/var/www/mirror`。
  - 安装 `deploy/nginx.mirror.conf` 到 `/etc/nginx/sites-available/mirror.conf` 并启用。
  - 测试并重载 Nginx。
  - 后续你需要用 `certbot` 为 `YOUR_HK_DOMAIN` 签发证书，并（可选）运行 `scripts/build_ollama_install.sh` 生成增强版 `ollama-install.sh`。

- `scripts/deploy_gz.sh`：在 **广州节点** 运行
  - 安装 `nginx`、`python3`、`pip`、`flask`、`requests`。
  - 安装 `scripts/github_proxy_gz.py` 到 `/opt/github-proxy`。
  - 创建 systemd 服务 `github-proxy.service` 并启动。
  - 安装 `deploy/nginx.github-proxy.conf` 到 `/etc/nginx/sites-available/github-proxy.conf` 并启用。
  - 测试并重载 Nginx。
  - 后续你需要用 `certbot` 为 `YOUR_GZ_DOMAIN` 签发证书，并按需在该服务上配置 HTTP_PROXY/HTTPS_PROXY（例如本机 ss-local）。

> 使用方式（两台服务器都要先拉取本仓库）：
>
> ```bash
> # 香港节点（推荐路径：/opt/twoProxy）
> git clone https://github.com/violettoolssite/twoProxy.git
> cd twoProxy
> sudo bash scripts/deploy_hk.sh
>
> # 广州节点
> git clone https://github.com/violettoolssite/twoProxy.git
> cd twoProxy
> sudo bash scripts/deploy_gz.sh
> ```
>
> **配置域名或 IP：**
>
> - **方式一：使用 sed 自动替换（推荐）**
>
>   ```bash
>   # 获取服务器公网 IP（如果使用 IP 而非域名）
>   GZ_IP=$(curl -s ifconfig.me || curl -s ip.sb || curl -s icanhazip.com)
>   
>   # 替换广州节点配置中的域名占位符为 IP
>   sed -i "s/YOUR_GZ_DOMAIN/$GZ_IP/g" deploy/nginx.github-proxy.conf
>   
>   # 替换香港节点配置中的域名占位符（如果有域名）
>   # sed -i "s/YOUR_HK_DOMAIN/your-hk-domain.com/g" deploy/nginx.mirror.conf
>   ```
>
> - **方式二：手动编辑文件**
>
>   编辑 `deploy/nginx.mirror.conf` 和 `deploy/nginx.github-proxy.conf`，将 `YOUR_HK_DOMAIN` / `YOUR_GZ_DOMAIN` 替换为实际域名或 IP。
>
> **重要：如果广州服务器只有 IP 没有域名**
>
> 1. 使用 sed 替换为 IP 后，编辑 `deploy/nginx.github-proxy.conf`：
>    ```bash
>   sudo nano deploy/nginx.github-proxy.conf
>   ```
>
> 2. 注释掉所有 SSL 相关配置（`ssl_certificate`、`ssl_certificate_key`、`include /etc/letsencrypt/...`、`ssl_dhparam`），并将 `listen 9090 ssl http2;` 改为 `listen 9090;`。
>
> 3. 同时需要修改前端 `js/app.js`，将生成的 GitHub 加速地址从 `https://` 改为 `http://`：
>    ```bash
>   sed -i 's|https://violetteam.cloud:9090|http://'"$GZ_IP"':9090|g' js/app.js
>   ```
>
> 4. 重新运行部署脚本或手动重载 Nginx：
>    ```bash
>   sudo nginx -t && sudo systemctl reload nginx
>   ```

前端 Docker 模块只负责展示配置 JSON 和单次拉取命令，实际请求由 Docker CLI 直连该节点。

---

## Ollama 安装脚本增强（示例）

文件：`scripts/build-ollama-install.sh.example`

用途：

- 在 **服务端** 周期性运行：
  1. 从 `https://ollama.com/install.sh` 拉取最新官方脚本。
  2. 在脚本前部注入：在客户端本地启动 `ss-local` 或 `go-shadowsocks2` 的包装逻辑（基于你的 Shadowsocks 链接）。
  3. 在脚本尾部加上清理逻辑（结束时 kill SS 客户端）。
  4. 生成最终可分发的 `ollama-install.sh` 并由 Nginx 以 `install.sh` 的路径返回。

客户端只需执行：

```bash
curl -fsSL https://YOUR_FRONTEND_DOMAIN/file/https/ollama.com/install.sh | bash
```

脚本内部会：

- 在客户端本地静默安装/启动 Shadowsocks 客户端（若未安装）。
- 设置 `https_proxy/http_proxy/all_proxy` → `socks5h://127.0.0.1:<port>`。
- 在代理环境下执行完整的官方安装逻辑。
- 结束时自动关闭 Shadowsocks 客户端。

> 该示例脚本中包含诸多 **占位符**（如 `SS_URI_BASE64`、`SERVER_DOMAIN` 等），请务必根据你的生产环境修改，并避免在公开仓库中提交真实密码。

---

## 安全与开源建议

- **不要提交真实的 Shadowsocks 链接 / 密码 / Token** 到公开仓库。
  - 本仓库中的所有敏感项应使用占位符（如 `CHANGE_ME_SERVER`, `CHANGE_ME_PASSWORD` 等）。
  - 建议使用环境变量或单独的私有配置文件注入敏感信息。

- 对于 Nginx 配置：
  - 将 `server_name`、证书路径、上游地址等都作为可配置项。
  - 提供 `.example` 文件，实际部署时复制为 `.conf` 并自行修改。

- 若你打算提供一键部署脚本（如 `docker-compose`），也建议为：
  - 前端站点（静态文件容器）
  - 香港 / 广州节点（含 gh‑proxy / Python 服务）
  分别提供独立 `compose` 文件，并在 README 中明确说明角色。

---

## 开发与调试

本仓库为纯前端静态资源，开发时可以直接用任意静态 HTTP 服务器打开：

```bash
cd /path/to/project
python3 -m http.server 8080
```

然后访问：`http://localhost:8080/`  
配合浏览器 DevTools 和你本地/远程的 Nginx 代理节点一起调试。

---

## License

本项目采用 [MIT License](LICENSE) 开源协议发布，你可以自由地使用、修改和分发本项目的代码。




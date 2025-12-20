#!/bin/bash

################################################################################
# 一键迁移脚本 - 完整迁移流程
# 用途: 整合备份、传输、恢复的完整迁移流程
# 使用: bash migrate-all.sh
################################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

log_title() {
    echo -e "${MAGENTA}$1${NC}"
}

# 显示欢迎信息
clear
cat << "EOF"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  __  __ _                       __  __ _                 _   _             
 |  \/  (_)_ __ _ __ ___  _ __  |  \/  (_) __ _ _ __ __ _| |_(_) ___  _ __  
 | |\/| | | '__| '__/ _ \| '__| | |\/| | |/ _` | '__/ _` | __| |/ _ \| '_ \ 
 | |  | | | |  | | | (_) | |    | |  | | | (_| | | | (_| | |_| | (_) | | | |
 |_|  |_|_|_|  |_|  \___/|_|    |_|  |_|_|\__, |_|  \__,_|\__|_|\___/|_| |_|
                                          |___/                              
                   Mirror 加速站 - 服务器迁移向导

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

echo ""
log_info "欢迎使用 Mirror 加速站迁移向导"
echo ""

# 选择迁移模式
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_title "第一步: 选择迁移模式"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1) 香港服务器迁移 (Mirror 主站)"
echo "2) 广州服务器迁移 (VioletTeam)"
echo "3) 双服务器完整迁移"
echo "4) 合并到单服务器"
echo "5) 仅备份 (不迁移)"
echo "6) 仅恢复 (从已有备份)"
echo ""
read -p "请选择 [1-6]: " MODE

case $MODE in
    1)
        SERVER_TYPE="hk"
        MIGRATION_TYPE="single"
        log_info "已选择: 香港服务器迁移"
        ;;
    2)
        SERVER_TYPE="gz"
        MIGRATION_TYPE="single"
        log_info "已选择: 广州服务器迁移"
        ;;
    3)
        SERVER_TYPE="both"
        MIGRATION_TYPE="dual"
        log_info "已选择: 双服务器完整迁移"
        ;;
    4)
        SERVER_TYPE="both"
        MIGRATION_TYPE="combined"
        log_info "已选择: 合并到单服务器"
        ;;
    5)
        OPERATION="backup_only"
        log_info "已选择: 仅备份"
        ;;
    6)
        OPERATION="restore_only"
        log_info "已选择: 仅恢复"
        ;;
    *)
        log_error "无效选择"
        exit 1
        ;;
esac

echo ""

################################################################################
# 仅备份模式
################################################################################
if [ "$OPERATION" = "backup_only" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_title "选择备份服务器类型"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1) 香港服务器 (Mirror)"
    echo "2) 广州服务器 (VioletTeam)"
    echo "3) 两台都备份"
    echo ""
    read -p "请选择 [1-3]: " BACKUP_CHOICE
    
    case $BACKUP_CHOICE in
        1)
            log_step "开始备份香港服务器..."
            bash "$(dirname "$0")/migrate-backup.sh" hk
            ;;
        2)
            log_step "开始备份广州服务器..."
            bash "$(dirname "$0")/migrate-backup.sh" gz
            ;;
        3)
            log_step "开始备份香港服务器..."
            bash "$(dirname "$0")/migrate-backup.sh" hk
            echo ""
            log_step "开始备份广州服务器..."
            bash "$(dirname "$0")/migrate-backup.sh" gz
            ;;
        *)
            log_error "无效选择"
            exit 1
            ;;
    esac
    
    echo ""
    log_info "备份完成！备份文件位于用户主目录"
    exit 0
fi

################################################################################
# 仅恢复模式
################################################################################
if [ "$OPERATION" = "restore_only" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_title "选择恢复服务器类型"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1) 香港服务器 (Mirror)"
    echo "2) 广州服务器 (VioletTeam)"
    echo ""
    read -p "请选择 [1-2]: " RESTORE_CHOICE
    
    case $RESTORE_CHOICE in
        1)
            SERVER_TYPE="hk"
            ;;
        2)
            SERVER_TYPE="gz"
            ;;
        *)
            log_error "无效选择"
            exit 1
            ;;
    esac
    
    echo ""
    read -p "请输入备份目录路径: " BACKUP_DIR
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "备份目录不存在: $BACKUP_DIR"
        exit 1
    fi
    
    log_step "开始恢复 $SERVER_TYPE 服务器..."
    sudo bash "$(dirname "$0")/migrate-restore.sh" "$SERVER_TYPE" "$BACKUP_DIR"
    
    echo ""
    log_step "运行验证脚本..."
    bash "$(dirname "$0")/migrate-verify.sh" "$SERVER_TYPE"
    
    exit 0
fi

################################################################################
# 完整迁移流程
################################################################################

# 收集服务器信息
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_title "第二步: 配置服务器信息"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 旧服务器信息
if [ "$MIGRATION_TYPE" = "single" ] || [ "$MIGRATION_TYPE" = "dual" ]; then
    log_info "旧服务器信息 ($SERVER_TYPE):"
    read -p "旧服务器 IP: " OLD_SERVER_IP
    read -p "SSH 端口 [22]: " OLD_SSH_PORT
    OLD_SSH_PORT=${OLD_SSH_PORT:-22}
    read -p "SSH 用户名 [root]: " OLD_SSH_USER
    OLD_SSH_USER=${OLD_SSH_USER:-root}
    echo ""
    
    # 新服务器信息
    log_info "新服务器信息:"
    read -p "新服务器 IP: " NEW_SERVER_IP
    read -p "SSH 端口 [22]: " NEW_SSH_PORT
    NEW_SSH_PORT=${NEW_SSH_PORT:-22}
    read -p "SSH 用户名 [root]: " NEW_SSH_USER
    NEW_SSH_USER=${NEW_SSH_USER:-root}
    echo ""
fi

# 确认信息
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_title "第三步: 确认迁移信息"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "迁移模式: $MIGRATION_TYPE"
log_info "服务器类型: $SERVER_TYPE"
if [ "$MIGRATION_TYPE" != "combined" ]; then
    log_info "旧服务器: $OLD_SSH_USER@$OLD_SERVER_IP:$OLD_SSH_PORT"
    log_info "新服务器: $NEW_SSH_USER@$NEW_SERVER_IP:$NEW_SSH_PORT"
fi
echo ""
log_warn "迁移过程中请勿中断，确保两台服务器网络稳定"
echo ""
read -p "确认开始迁移? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "迁移已取消"
    exit 0
fi

################################################################################
# 单服务器迁移流程
################################################################################
if [ "$MIGRATION_TYPE" = "single" ]; then
    DATE=$(date +%Y%m%d_%H%M%S)
    BACKUP_ARCHIVE="mirror_backup_${SERVER_TYPE}_${DATE}.tar.gz"
    
    # 步骤 1: 在旧服务器备份
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_step "步骤 1/5: 在旧服务器上创建备份"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    log_info "上传备份脚本到旧服务器..."
    scp -P "$OLD_SSH_PORT" "$(dirname "$0")/migrate-backup.sh" "$OLD_SSH_USER@$OLD_SERVER_IP:/tmp/" || {
        log_error "上传备份脚本失败"
        exit 1
    }
    
    log_info "在旧服务器上执行备份..."
    ssh -p "$OLD_SSH_PORT" "$OLD_SSH_USER@$OLD_SERVER_IP" "bash /tmp/migrate-backup.sh $SERVER_TYPE" || {
        log_error "备份失败"
        exit 1
    }
    
    # 步骤 2: 打包备份文件
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_step "步骤 2/5: 打包备份文件"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    log_info "在旧服务器上打包备份..."
    ssh -p "$OLD_SSH_PORT" "$OLD_SSH_USER@$OLD_SERVER_IP" "cd ~ && tar -czf $BACKUP_ARCHIVE mirror_backup_${SERVER_TYPE}_*/" || {
        log_error "打包备份失败"
        exit 1
    }
    
    # 步骤 3: 传输备份到新服务器
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_step "步骤 3/5: 传输备份到新服务器"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    log_info "从旧服务器下载备份..."
    mkdir -p /tmp/migration_$DATE
    scp -P "$OLD_SSH_PORT" "$OLD_SSH_USER@$OLD_SERVER_IP:~/$BACKUP_ARCHIVE" /tmp/migration_$DATE/ || {
        log_error "下载备份失败"
        exit 1
    }
    
    log_info "上传备份到新服务器..."
    scp -P "$NEW_SSH_PORT" "/tmp/migration_$DATE/$BACKUP_ARCHIVE" "$NEW_SSH_USER@$NEW_SERVER_IP:/tmp/" || {
        log_error "上传备份失败"
        exit 1
    }
    
    # 步骤 4: 在新服务器恢复
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_step "步骤 4/5: 在新服务器上恢复数据"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    log_info "解压备份文件..."
    ssh -p "$NEW_SSH_PORT" "$NEW_SSH_USER@$NEW_SERVER_IP" "cd /tmp && tar -xzf $BACKUP_ARCHIVE" || {
        log_error "解压备份失败"
        exit 1
    }
    
    log_info "上传恢复脚本..."
    scp -P "$NEW_SSH_PORT" "$(dirname "$0")/migrate-restore.sh" "$NEW_SSH_USER@$NEW_SERVER_IP:/tmp/" || {
        log_error "上传恢复脚本失败"
        exit 1
    }
    
    log_info "执行恢复..."
    BACKUP_DIR_NAME=$(basename "$BACKUP_ARCHIVE" .tar.gz)
    ssh -p "$NEW_SSH_PORT" "$NEW_SSH_USER@$NEW_SERVER_IP" "sudo bash /tmp/migrate-restore.sh $SERVER_TYPE /tmp/$BACKUP_DIR_NAME" || {
        log_error "恢复失败"
        exit 1
    }
    
    # 步骤 5: 验证
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_step "步骤 5/5: 验证迁移结果"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    log_info "上传验证脚本..."
    scp -P "$NEW_SSH_PORT" "$(dirname "$0")/migrate-verify.sh" "$NEW_SSH_USER@$NEW_SERVER_IP:/tmp/" || {
        log_error "上传验证脚本失败"
        exit 1
    }
    
    log_info "执行验证..."
    ssh -p "$NEW_SSH_PORT" "$NEW_SSH_USER@$NEW_SERVER_IP" "bash /tmp/migrate-verify.sh $SERVER_TYPE" || {
        log_warn "验证过程中发现问题，请检查日志"
    }
    
    # 清理
    log_info "清理临时文件..."
    rm -rf /tmp/migration_$DATE
fi

################################################################################
# 迁移完成
################################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "迁移流程完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_title "后续步骤:"
echo ""
echo "1. 更新 DNS 记录"
echo "   将域名 A 记录指向新服务器 IP: $NEW_SERVER_IP"
echo ""
echo "2. 申请 SSL 证书（如未迁移证书）"
if [ "$SERVER_TYPE" = "hk" ]; then
    echo "   sudo certbot --nginx -d mirror.yljdteam.com"
else
    echo "   sudo certbot --nginx -d violetteam.cloud"
fi
echo ""
echo "3. 等待 DNS 传播（通常 5-30 分钟）"
echo "   检查命令: dig your-domain.com"
echo ""
echo "4. 浏览器访问网站测试功能"
echo ""
echo "5. 监控服务运行状态"
if [ "$SERVER_TYPE" = "hk" ]; then
    echo "   pm2 logs mirror-api"
else
    echo "   sudo journalctl -u github-proxy -f"
fi
echo ""
echo "6. 保持旧服务器运行 7 天作为备份"
echo "   确认新服务器稳定后再关闭旧服务器"
echo ""
log_info "技术支持: QQ 1494458927"
echo ""
log_info "迁移完成时间: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


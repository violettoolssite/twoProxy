/**
 * P2P 文件传输信令服务器
 * 使用 WebSocket 进行信令交换
 */

const express = require('express');
const router = express.Router();

// 存储房间和连接信息
const rooms = new Map(); // roomId -> { host: ws, client: ws }
const connections = new Map(); // ws -> { roomId, isHost }

// WebSocket 服务器（需要在 app.js 中初始化）
let wss = null;

// 设置 WebSocket 服务器
function setupWebSocketServer(server) {
  const WebSocket = require('ws');
  
  // 创建 WebSocket 服务器，挂载到 HTTP 服务器上
  wss = new WebSocket.Server({ 
    server: server,
    path: '/api/p2p/signaling',
    perMessageDeflate: false // 禁用压缩以提高性能
  });
  
  wss.on('connection', (ws, req) => {
    console.log('[P2P Signaling] 新连接:', req.socket.remoteAddress);
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleSignalingMessage(ws, data);
      } catch (error) {
        console.error('[P2P Signaling] 消息解析失败:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });
    
    ws.on('close', () => {
      handleDisconnect(ws);
    });
    
    ws.on('error', (error) => {
      console.error('[P2P Signaling] WebSocket 错误:', error);
      handleDisconnect(ws);
    });
  });
  
  console.log('[P2P Signaling] WebSocket 服务器已启动');
}

// 处理信令消息
function handleSignalingMessage(ws, message) {
  try {
    switch (message.type) {
      case 'join':
        handleJoin(ws, message);
        break;
        
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        handleRelay(ws, message);
        break;
        
      default:
        console.warn('[P2P Signaling] 未知消息类型:', message.type);
    }
  } catch (error) {
    console.error('[P2P Signaling] 处理消息失败:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

// 处理加入房间
function handleJoin(ws, message) {
  const { roomId, isHost } = message;
  
  if (!roomId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room ID is required' }));
    return;
  }
  
  let room = rooms.get(roomId);
  
  if (!room) {
    // 创建新房间
    room = {
      host: null,
      client: null,
      createdAt: Date.now()
    };
    rooms.set(roomId, room);
  }
  
  if (isHost) {
    // 主机加入
    if (room.host && room.host !== ws && room.host.readyState === 1) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room already has a host' }));
      return;
    }
    room.host = ws;
    connections.set(ws, { roomId, isHost: true });
    
    console.log(`[P2P Signaling] 主机加入房间: ${roomId}`);
    
    // 如果有客户端，通知主机
    if (room.client && room.client.readyState === 1) {
      ws.send(JSON.stringify({ type: 'peer-ready', roomId }));
    }
  } else {
    // 客户端加入
    if (!room.host) {
      ws.send(JSON.stringify({ type: 'room-not-found', roomId }));
      return;
    }
    
    if (room.client && room.client !== ws && room.client.readyState === 1) {
      ws.send(JSON.stringify({ type: 'room-full', roomId }));
      return;
    }
    
    room.client = ws;
    connections.set(ws, { roomId, isHost: false });
    
    console.log(`[P2P Signaling] 客户端加入房间: ${roomId}`);
    
    // 通知主机有客户端加入
    if (room.host && room.host.readyState === 1) {
      room.host.send(JSON.stringify({ type: 'peer-ready', roomId }));
    }
    
    // 通知客户端连接成功
    ws.send(JSON.stringify({ type: 'joined', roomId }));
  }
}

// 处理消息中继
function handleRelay(ws, message) {
  const connection = connections.get(ws);
  if (!connection) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not connected to any room' }));
    return;
  }
  
  const room = rooms.get(connection.roomId);
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }
  
  // 中继消息到对端
  const target = connection.isHost ? room.client : room.host;
  
  if (target && target.readyState === 1) {
    target.send(JSON.stringify(message));
    console.log(`[P2P Signaling] 中继消息: ${message.type} (房间: ${connection.roomId})`);
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Peer not connected' }));
  }
}

// 处理断开连接
function handleDisconnect(ws) {
  const connection = connections.get(ws);
  if (!connection) return;
  
  const room = rooms.get(connection.roomId);
  if (!room) return;
  
  // 通知对端断开
  const peer = connection.isHost ? room.client : room.host;
  if (peer && peer.readyState === 1) {
    peer.send(JSON.stringify({ 
      type: 'peer-disconnected', 
      roomId: connection.roomId 
    }));
  }
  
  // 清理连接
  if (connection.isHost) {
    room.host = null;
  } else {
    room.client = null;
  }
  
  connections.delete(ws);
  
  // 如果房间为空，删除房间
  if (!room.host && !room.client) {
    rooms.delete(connection.roomId);
    console.log(`[P2P Signaling] 房间已删除: ${connection.roomId}`);
  } else {
    console.log(`[P2P Signaling] 连接断开 (房间: ${connection.roomId})`);
  }
}

// 清理过期房间（每5分钟清理一次）
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30分钟
  
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > maxAge) {
      // 通知房间内的所有连接
      if (room.host && room.host.readyState === 1) {
        room.host.send(JSON.stringify({ type: 'room-expired', roomId }));
        room.host.close();
      }
      if (room.client && room.client.readyState === 1) {
        room.client.send(JSON.stringify({ type: 'room-expired', roomId }));
        room.client.close();
      }
      
      rooms.delete(roomId);
      console.log(`[P2P Signaling] 清理过期房间: ${roomId}`);
    }
  }
}, 5 * 60 * 1000);

// HTTP 路由（用于获取房间信息等）
router.get('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.json({ exists: false });
  }
  
  res.json({
    exists: true,
    hasHost: !!room.host && room.host.readyState === 1,
    hasClient: !!room.client && room.client.readyState === 1,
    createdAt: room.createdAt
  });
});

router.get('/stats', (req, res) => {
  res.json({
    totalRooms: rooms.size,
    totalConnections: connections.size,
    activeRooms: Array.from(rooms.values()).filter(r => 
      (r.host && r.host.readyState === 1) || (r.client && r.client.readyState === 1)
    ).length
  });
});

module.exports = router;
module.exports.setupWebSocketServer = setupWebSocketServer;


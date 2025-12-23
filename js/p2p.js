/**
 * P2P 文件传输功能
 * 使用 WebRTC DataChannel 实现点对点文件传输
 */

// P2P 连接状态
let p2pState = {
  peerConnection: null,
  dataChannel: null,
  roomId: null,
  isHost: false,
  isConnected: false,
  filesToSend: [],
  receivedFiles: [],
  encryptionKey: null
};

// WebRTC 配置
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// 初始化 P2P 功能
function initP2P() {
  updateP2PStatus('未连接', '#6b7280');
  console.log('[P2P] 初始化完成');
}

// 更新连接状态
function updateP2PStatus(text, color) {
  const indicator = document.getElementById('p2p-status-indicator');
  const statusText = document.getElementById('p2p-status-text');
  
  if (indicator) indicator.style.background = color;
  if (statusText) statusText.textContent = text;
}

// 生成随机房间ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

// 创建 P2P 房间
async function createP2PRoom() {
  try {
    const roomId = generateRoomId();
    p2pState.roomId = roomId;
    p2pState.isHost = true;
    
    // 生成加密密钥
    p2pState.encryptionKey = await generateEncryptionKey();
    
    // 创建信令服务器连接
    await connectToSignalingServer(roomId, true);
    
    // 创建 WebRTC 连接
    await createPeerConnection();
    
    // 创建 DataChannel
    p2pState.dataChannel = p2pState.peerConnection.createDataChannel('fileTransfer', {
      ordered: true
    });
    
    setupDataChannel(p2pState.dataChannel);
    
    // 创建 offer
    const offer = await p2pState.peerConnection.createOffer();
    await p2pState.peerConnection.setLocalDescription(offer);
    
    // 通过信令服务器发送 offer
    await sendSignalingMessage({
      type: 'offer',
      roomId: roomId,
      offer: offer
    });
    
    // 显示房间信息
    document.getElementById('p2p-room-id').textContent = roomId;
    document.getElementById('p2p-room-info').style.display = 'block';
    document.getElementById('p2p-send-section').style.display = 'block';
    document.getElementById('btn-create-room').style.display = 'none';
    document.getElementById('btn-join-room').style.display = 'none';
    document.getElementById('btn-disconnect').style.display = 'inline-block';
    
    updateP2PStatus('等待连接...', '#f59e0b');
    showNotify('房间已创建，等待对方加入...', 'success');
    
  } catch (error) {
    console.error('[P2P] 创建房间失败:', error);
    showNotify('创建房间失败: ' + error.message, 'error');
  }
}

// 加入 P2P 房间
async function joinP2PRoom() {
  const roomId = prompt('请输入房间ID:');
  if (!roomId || roomId.trim() === '') {
    return;
  }
  
  try {
    p2pState.roomId = roomId.trim();
    p2pState.isHost = false;
    
    // 生成加密密钥
    p2pState.encryptionKey = await generateEncryptionKey();
    
    // 创建信令服务器连接
    await connectToSignalingServer(roomId, false);
    
    // 创建 WebRTC 连接
    await createPeerConnection();
    
    // 监听 DataChannel
    p2pState.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      setupDataChannel(channel);
    };
    
    // 显示房间信息
    document.getElementById('p2p-room-id').textContent = roomId;
    document.getElementById('p2p-room-info').style.display = 'block';
    document.getElementById('p2p-receive-section').style.display = 'block';
    document.getElementById('btn-create-room').style.display = 'none';
    document.getElementById('btn-join-room').style.display = 'none';
    document.getElementById('btn-disconnect').style.display = 'inline-block';
    
    updateP2PStatus('等待连接...', '#f59e0b');
    showNotify('正在加入房间...', 'info');
    
  } catch (error) {
    console.error('[P2P] 加入房间失败:', error);
    showNotify('加入房间失败: ' + error.message, 'error');
  }
}

// 连接到信令服务器
async function connectToSignalingServer(roomId, isHost) {
  return new Promise((resolve, reject) => {
    // 使用 WebSocket 连接到信令服务器
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/p2p/signaling`;
    
    p2pState.signalingSocket = new WebSocket(wsUrl);
    
    p2pState.signalingSocket.onopen = () => {
      console.log('[P2P] 信令服务器连接成功');
      
      // 发送加入房间消息
      p2pState.signalingSocket.send(JSON.stringify({
        type: 'join',
        roomId: roomId,
        isHost: isHost
      }));
      
      resolve();
    };
    
    p2pState.signalingSocket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      await handleSignalingMessage(message);
    };
    
    p2pState.signalingSocket.onerror = (error) => {
      console.error('[P2P] 信令服务器连接错误:', error);
      reject(error);
    };
    
    p2pState.signalingSocket.onclose = () => {
      console.log('[P2P] 信令服务器连接关闭');
      if (p2pState.isConnected) {
        disconnectP2P();
      }
    };
  });
}

// 发送信令消息
function sendSignalingMessage(message) {
  if (p2pState.signalingSocket && p2pState.signalingSocket.readyState === WebSocket.OPEN) {
    p2pState.signalingSocket.send(JSON.stringify(message));
  }
}

// 处理信令消息
async function handleSignalingMessage(message) {
  try {
    switch (message.type) {
      case 'offer':
        if (!p2pState.isHost) {
          await p2pState.peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
          const answer = await p2pState.peerConnection.createAnswer();
          await p2pState.peerConnection.setLocalDescription(answer);
          
          sendSignalingMessage({
            type: 'answer',
            roomId: p2pState.roomId,
            answer: answer
          });
        }
        break;
        
      case 'answer':
        if (p2pState.isHost) {
          await p2pState.peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
        }
        break;
        
      case 'ice-candidate':
        if (message.candidate) {
          await p2pState.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
        break;
        
      case 'room-not-found':
        showNotify('房间不存在', 'error');
        disconnectP2P();
        break;
        
      case 'room-full':
        showNotify('房间已满', 'error');
        disconnectP2P();
        break;
    }
  } catch (error) {
    console.error('[P2P] 处理信令消息失败:', error);
  }
}

// 创建 PeerConnection
async function createPeerConnection() {
  p2pState.peerConnection = new RTCPeerConnection(rtcConfig);
  
  // ICE 候选处理
  p2pState.peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignalingMessage({
        type: 'ice-candidate',
        roomId: p2pState.roomId,
        candidate: event.candidate
      });
    }
  };
  
  // 连接状态变化
  p2pState.peerConnection.onconnectionstatechange = () => {
    const state = p2pState.peerConnection.connectionState;
    console.log('[P2P] 连接状态:', state);
    
    switch (state) {
      case 'connected':
        p2pState.isConnected = true;
        updateP2PStatus('已连接', '#10b981');
        showNotify('P2P 连接已建立', 'success');
        break;
      case 'disconnected':
      case 'failed':
      case 'closed':
        p2pState.isConnected = false;
        updateP2PStatus('连接断开', '#ef4444');
        if (state !== 'closed') {
          disconnectP2P();
        }
        break;
    }
  };
}

// 设置 DataChannel
function setupDataChannel(channel) {
  p2pState.dataChannel = channel;
  
  channel.onopen = () => {
    console.log('[P2P] DataChannel 已打开');
    updateP2PStatus('已连接', '#10b981');
    p2pState.isConnected = true;
  };
  
  channel.onclose = () => {
    console.log('[P2P] DataChannel 已关闭');
    updateP2PStatus('连接断开', '#ef4444');
    p2pState.isConnected = false;
  };
  
  channel.onerror = (error) => {
    console.error('[P2P] DataChannel 错误:', error);
    showNotify('数据传输错误', 'error');
  };
  
  channel.onmessage = async (event) => {
    await handleDataChannelMessage(event.data);
  };
}

// 处理 DataChannel 消息
async function handleDataChannelMessage(data) {
  try {
    // 如果是 Blob，转换为 ArrayBuffer
    let buffer;
    if (data instanceof Blob) {
      buffer = await data.arrayBuffer();
    } else if (data instanceof ArrayBuffer) {
      buffer = data;
    } else {
      // 尝试解析 JSON
      const text = await new Blob([data]).text();
      const message = JSON.parse(text);
      
      if (message.type === 'file-meta') {
        handleFileMetadata(message);
        return;
      }
      
      if (message.type === 'file-chunk') {
        handleFileChunk(message);
        return;
      }
      
      return;
    }
    
    // 处理二进制数据
    handleBinaryData(buffer);
    
  } catch (error) {
    console.error('[P2P] 处理消息失败:', error);
  }
}

// 处理文件元数据
function handleFileMetadata(meta) {
  const fileInfo = {
    fileId: meta.fileId,
    name: meta.name,
    size: meta.size,
    type: meta.type,
    totalChunks: meta.totalChunks,
    chunks: [],
    receivedSize: 0
  };
  
  p2pState.receivedFiles.push(fileInfo);
  displayReceivedFile(fileInfo);
  
  // 发送确认
  sendDataChannelMessage({
    type: 'file-ack',
    fileId: meta.fileId
  });
}

// 处理文件块
function handleFileChunk(chunk) {
  const fileInfo = p2pState.receivedFiles.find(f => f.fileId === chunk.fileId);
  if (!fileInfo) {
    console.warn('[P2P] 未找到文件信息:', chunk.fileId);
    return;
  }
  
  // 检查是否已经接收过这个块
  const existingChunk = fileInfo.chunks.find(c => c.index === chunk.index);
  if (existingChunk) {
    return; // 已经接收过，跳过
  }
  
  fileInfo.chunks.push({
    index: chunk.index,
    data: chunk.data
  });
  
  // 计算接收的数据大小（base64解码后的大小）
  const base64Length = chunk.data.length;
  const binaryLength = Math.floor(base64Length * 3 / 4);
  fileInfo.receivedSize += binaryLength;
  
  updateFileProgress(fileInfo);
  
  // 如果接收完成
  if (fileInfo.chunks.length === fileInfo.totalChunks) {
    assembleFile(fileInfo);
  }
}

// 处理二进制数据
function handleBinaryData(buffer) {
  // 这里可以处理加密的二进制数据
  console.log('[P2P] 收到二进制数据:', buffer.byteLength, 'bytes');
}

// 发送 DataChannel 消息
function sendDataChannelMessage(message) {
  if (p2pState.dataChannel && p2pState.dataChannel.readyState === 'open') {
    p2pState.dataChannel.send(JSON.stringify(message));
  }
}

// 发送文件
async function sendFile(file) {
  if (!p2pState.isConnected) {
    showNotify('未连接，无法发送文件', 'error');
    return;
  }
  
  const fileId = Date.now() + Math.random();
  const chunkSize = 16 * 1024; // 16KB chunks
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  // 发送文件元数据
  sendDataChannelMessage({
    type: 'file-meta',
    fileId: fileId,
    name: file.name,
    size: file.size,
    type: file.type,
    totalChunks: totalChunks
  });
  
  // 添加文件到发送列表
  const fileInfo = {
    id: fileId,
    name: file.name,
    size: file.size,
    sentSize: 0,
    totalChunks: totalChunks
  };
  p2pState.filesToSend.push(fileInfo);
  displaySendingFile(fileInfo);
  
  // 分块发送文件
  let offset = 0;
  let chunkIndex = 0;
  
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    const arrayBuffer = await chunk.arrayBuffer();
    
    // 加密数据（可选）
    let dataToSend = arrayBuffer;
    try {
      dataToSend = await encryptData(arrayBuffer);
    } catch (error) {
      console.log('[P2P] 加密失败，使用原始数据:', error);
      // 如果加密失败，使用原始数据
    }
    
    // 转换为 base64 发送
    const base64Data = arrayBufferToBase64(dataToSend);
    
    sendDataChannelMessage({
      type: 'file-chunk',
      fileId: fileId,
      index: chunkIndex,
      totalChunks: totalChunks,
      data: base64Data
    });
    
    fileInfo.sentSize += chunk.size;
    updateFileProgress(fileInfo);
    
    offset += chunkSize;
    chunkIndex++;
    
    // 控制发送速度，避免阻塞
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  showNotify(`文件 "${file.name}" 发送完成`, 'success');
}

// 处理文件选择
function handleP2PFileSelect(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    sendFile(file);
  });
  event.target.value = ''; // 重置输入
}

// 处理文件拖拽
function handleP2PFileDrop(event) {
  event.preventDefault();
  const files = Array.from(event.dataTransfer.files);
  files.forEach(file => {
    sendFile(file);
  });
}

// 显示发送文件
function displaySendingFile(fileInfo) {
  const fileList = document.getElementById('p2p-file-list');
  if (!fileList) return;
  
  const fileItem = document.createElement('div');
  fileItem.id = `file-send-${fileInfo.id}`;
  fileItem.style.cssText = `
    padding: 12px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 6px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  
  fileItem.innerHTML = `
    <div style="flex: 1;">
      <div style="font-size: 14px; color: var(--text); margin-bottom: 4px;">${escapeHtml(fileInfo.name)}</div>
      <div style="font-size: 12px; color: var(--text-muted);">${formatFileSize(fileInfo.size)}</div>
      <div style="margin-top: 8px;">
        <div style="height: 4px; background: rgba(0,0,0,0.2); border-radius: 2px; overflow: hidden;">
          <div id="progress-${fileInfo.id}" style="height: 100%; background: #3b82f6; width: 0%; transition: width 0.3s;"></div>
        </div>
      </div>
    </div>
  `;
  
  fileList.appendChild(fileItem);
}

// 显示接收文件
function displayReceivedFile(fileInfo) {
  const receiveList = document.getElementById('p2p-receive-list');
  if (!receiveList) return;
  
  if (receiveList.querySelector('p')) {
    receiveList.innerHTML = '';
  }
  
  const fileItem = document.createElement('div');
  fileItem.id = `file-receive-${fileInfo.fileId || Date.now()}`;
  fileItem.style.cssText = `
    padding: 12px;
    background: rgba(34, 197, 94, 0.1);
    border-radius: 6px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  
  fileItem.innerHTML = `
    <div style="flex: 1;">
      <div style="font-size: 14px; color: var(--text); margin-bottom: 4px;">${escapeHtml(fileInfo.name)}</div>
      <div style="font-size: 12px; color: var(--text-muted);">${formatFileSize(fileInfo.size)}</div>
      <div style="margin-top: 8px;">
        <div style="height: 4px; background: rgba(0,0,0,0.2); border-radius: 2px; overflow: hidden;">
          <div id="progress-receive-${fileInfo.fileId || Date.now()}" style="height: 100%; background: #22c55e; width: 0%; transition: width 0.3s;"></div>
        </div>
      </div>
    </div>
  `;
  
  receiveList.appendChild(fileItem);
}

// 更新文件进度
function updateFileProgress(fileInfo) {
  const progress = (fileInfo.sentSize || fileInfo.receivedSize) / fileInfo.size * 100;
  const progressBar = document.getElementById(`progress-${fileInfo.id}`) || 
                      document.getElementById(`progress-receive-${fileInfo.fileId || fileInfo.id}`);
  if (progressBar) {
    progressBar.style.width = progress + '%';
  }
}

// 组装文件
async function assembleFile(fileInfo) {
  try {
    // 按索引排序块
    fileInfo.chunks.sort((a, b) => a.index - b.index);
    
    // 合并所有块
    const chunks = fileInfo.chunks.map(c => c.data);
    const base64Data = chunks.join('');
    const binaryData = base64ToArrayBuffer(base64Data);
    
    // 解密数据（如果加密了）
    let finalData = binaryData;
    try {
      finalData = await decryptData(binaryData);
    } catch (error) {
      console.log('[P2P] 解密失败，使用原始数据:', error);
      // 如果解密失败，使用原始数据（可能没有加密）
    }
    
    // 创建 Blob
    const blob = new Blob([finalData], { type: fileInfo.type || 'application/octet-stream' });
    
    // 下载文件
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileInfo.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotify(`文件 "${fileInfo.name}" 接收完成`, 'success');
    
    // 从接收列表中移除
    const fileItem = document.getElementById(`file-receive-${fileInfo.fileId}`);
    if (fileItem) {
      fileItem.remove();
    }
    
    // 从状态中移除
    const index = p2pState.receivedFiles.findIndex(f => f.fileId === fileInfo.fileId);
    if (index !== -1) {
      p2pState.receivedFiles.splice(index, 1);
    }
  } catch (error) {
    console.error('[P2P] 组装文件失败:', error);
    showNotify(`文件 "${fileInfo.name}" 组装失败: ${error.message}`, 'error');
  }
}

// 复制房间ID
function copyP2PRoomId() {
  const roomId = document.getElementById('p2p-room-id').textContent;
  navigator.clipboard.writeText(roomId).then(() => {
    showNotify('房间ID已复制', 'success');
  });
}

// 断开连接
function disconnectP2P() {
  if (p2pState.dataChannel) {
    p2pState.dataChannel.close();
    p2pState.dataChannel = null;
  }
  
  if (p2pState.peerConnection) {
    p2pState.peerConnection.close();
    p2pState.peerConnection = null;
  }
  
  if (p2pState.signalingSocket) {
    p2pState.signalingSocket.close();
    p2pState.signalingSocket = null;
  }
  
  p2pState.isConnected = false;
  p2pState.roomId = null;
  p2pState.isHost = false;
  
  // 重置UI
  document.getElementById('p2p-room-info').style.display = 'none';
  document.getElementById('p2p-send-section').style.display = 'none';
  document.getElementById('p2p-receive-section').style.display = 'none';
  document.getElementById('btn-create-room').style.display = 'inline-block';
  document.getElementById('btn-join-room').style.display = 'inline-block';
  document.getElementById('btn-disconnect').style.display = 'none';
  
  updateP2PStatus('未连接', '#6b7280');
  showNotify('已断开连接', 'info');
}

// 生成加密密钥
async function generateEncryptionKey() {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// 加密数据
async function encryptData(data) {
  if (!p2pState.encryptionKey) return data;
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    p2pState.encryptionKey,
    data
  );
  
  // 将 IV 和加密数据合并
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  
  return result.buffer;
}

// 解密数据
async function decryptData(data) {
  if (!p2pState.encryptionKey) return data;
  
  const arrayBuffer = data instanceof ArrayBuffer ? data : new Uint8Array(data).buffer;
  const uint8Array = new Uint8Array(arrayBuffer);
  
  const iv = uint8Array.slice(0, 12);
  const encrypted = uint8Array.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    p2pState.encryptionKey,
    encrypted
  );
  
  return decrypted;
}

// 工具函数
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 页面加载时初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initP2P);
} else {
  initP2P();
}


## 基于WebREC的在线视频会议系统
---
### 简介
> 主要是基于websocket实现STUN服务器，用于实现协议转发，再使用webRTC建立P2P连接，实现音视频连接。
### 准备工作
> `npm install express`
> `npm install express-static`
> `npm install websocket`

### 现有功能
1.使用node实现后端服务
2.使用express、express-static实现界面展现
3.使用websocket基于https实现基础聊天以及协议交换
4.使用webrtc实现视频音频交互

### TODO
* 音视频挂断
* 多人互联
* 信息交换

import { Client } from '@stomp/stompjs'

let stompClient = null

export const connectSocket = (token, onMessage, roomId) => {
  stompClient = new Client({
    brokerURL: 'ws://localhost:8080/ws',
    connectHeaders: { Authorization: `Bearer ${token}` },
    debug: (str) => console.log('STOMP:', str),
    onConnect: () => {
      console.log('✅ WebSocket connected!')
      stompClient.subscribe(`/topic/room/${roomId}`, (msg) => {
        console.log('📨 Message received:', msg.body)
        onMessage(JSON.parse(msg.body))
      })
    },
    onStompError: (frame) => console.error('❌ STOMP error:', frame),
    onDisconnect: () => console.log('Disconnected')
  })
  stompClient.activate()
}

export const sendMessage = (messageDTO) => {
  console.log('Sending:', messageDTO, 'Connected:', stompClient?.connected)
  if (stompClient && stompClient.connected) {
    stompClient.publish({
      destination: '/app/chat.send',
      body: JSON.stringify(messageDTO)
    })
  }
}

export const disconnectSocket = () => {
  if (stompClient) stompClient.deactivate()
}
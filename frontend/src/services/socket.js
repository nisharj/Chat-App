import { Client } from '@stomp/stompjs'

let stompClient = null
let activeToken = null

export const connectSocket = (token, handlers, roomId) => {
  const { onRoomMessage, onFileMessage, onDeleteMessage, onError } = handlers ?? {}

  if (!token || !roomId) {
    onError?.('Chat connection requires an authenticated room session.')
    return
  }

  activeToken = token
  const authHeaders = { Authorization: `Bearer ${token}` }

  stompClient = new Client({
    brokerURL: 'ws://localhost:8080/ws',
    connectHeaders: authHeaders,
    debug: (str) => console.log('STOMP:', str),
    onConnect: () => {
      console.log('WebSocket connected')

      stompClient.subscribe(`/topic/room/${roomId}`, (msg) => {
        console.log('Room message received:', msg.body)
        onRoomMessage?.(JSON.parse(msg.body))
      }, authHeaders)

      stompClient.subscribe(`/topic/files/${roomId}`, (msg) => {
        console.log('File message received:', msg.body)
        onFileMessage?.(JSON.parse(msg.body))
      }, authHeaders)

      stompClient.subscribe(`/topic/messages/${roomId}/delete`, (msg) => {
        console.log('Delete event received:', msg.body)
        onDeleteMessage?.(JSON.parse(msg.body))
      }, authHeaders)
    },
    onStompError: (frame) => {
      console.error('STOMP error:', frame)
      onError?.('Chat connection failed for this room.')
    },
    onWebSocketError: (event) => {
      console.error('WebSocket error:', event)
      onError?.('Chat connection was interrupted.')
    },
    onDisconnect: () => console.log('Disconnected'),
  })

  stompClient.activate()
}

export const sendMessage = (messageDTO) => {
  console.log('Sending:', messageDTO, 'Connected:', stompClient?.connected)

  if (!stompClient || !stompClient.connected) {
    throw new Error('Chat connection is not ready yet.')
  }

  stompClient.publish({
    destination: '/app/chat.send',
    headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
    body: JSON.stringify(messageDTO),
  })
}

export const disconnectSocket = () => {
  if (stompClient) {
    stompClient.deactivate()
    stompClient = null
  }
  activeToken = null
}

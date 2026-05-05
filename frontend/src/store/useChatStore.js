import { create } from 'zustand'

const useChatStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  rooms: [],
  activeRoom: null,
  messages: [],

  setUser: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', token)
    set({ user, token })
  },

  logout: () => {
    localStorage.clear()
    set({ user: null, token: null, rooms: [], activeRoom: null, messages: [] })
  },

  setRooms: (rooms) => set({ rooms }),
  setActiveRoom: (room) => set({ activeRoom: room, messages: [] }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({
    messages: [...(state.messages || []), message]
  })),
}))

export default useChatStore
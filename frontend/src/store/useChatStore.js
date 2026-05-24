/* eslint-disable no-unused-vars */
import { create } from 'zustand'
import { sortAndDeduplicateMessages } from '../utils/chatMessages'

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
  setMessages: (messagesOrUpdater) => set((state) => ({
    messages: sortAndDeduplicateMessages(
      typeof messagesOrUpdater === 'function'
        ? messagesOrUpdater(state.messages || [])
        : messagesOrUpdater
    )
  })),
  addMessage: (message) => set((state) => ({
    messages: sortAndDeduplicateMessages([...(state.messages || []), message])
  })),

  applyDeleteEvent: (event) =>
  set((state) => ({
    messages: (state.messages || []).filter((message) => {
      const id = String(
        message?.attachment?.id ??
        message?.id ??
        ""
      );

      if (!event.messageIds.includes(id)) {
        return true;
      }

      return false;
    }),
    
  })),

}))

export default useChatStore

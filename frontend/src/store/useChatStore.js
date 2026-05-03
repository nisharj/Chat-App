import { create } from 'zustand'

const useChatStore = create((set) => ({
    user: JSON.parse(localStorage.getItem('user')) || null, 
    token: localStorage.getItem('token') || null,
    rooms: [],
    activeRoom: null,
    message: [],

    setUser: (user, token) => {
        localStorage.setItem('user', JSON.stringify(user))
        localStorage.setItem('token', token)
        set({ user, token })
    },

    logout: () => {
        localStorage.clear()
        set({ user: null, token: null, rooms: [], activeRoom: null, message: [] })
    },

    setRooms: (rooms) => set({ rooms }),
    setActiveRoom: (room) => set({ activeRoom: room, message: [] }),
    setMessage: (messages) => set( (state) => ({
        messages: [...state.message, messages]
    })),
    setMessages: (messages) => set({ messages })
}))

export default useChatStore
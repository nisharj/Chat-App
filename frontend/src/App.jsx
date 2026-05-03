import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import useChatStore from './store/useChatStore'

function App() {
  const { token } = useChatStore()  // ← use Zustand store, not localStorage directly

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={token ? <Home /> : <Navigate to="/login" />} />
    </Routes>
  )
}

export default App
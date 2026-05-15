import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { HiChatBubbleLeftRight } from 'react-icons/hi2';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/auth/register', form)
      navigate('/login')
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      setError('Registration failed. Try different username/email.')
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}><HiChatBubbleLeftRight className='inline mr-1'/> ChatApp</h2>
        {error && <p style={styles.error}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <input style={styles.input} placeholder="Username"
            value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
          <input style={styles.input} type="email" placeholder="Email"
            value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input style={styles.input} type="password" placeholder="Password"
            value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <button style={styles.button} type="submit">Register</button>
        </form>
        <p style={styles.link}>Have account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  )
}

const styles = {
  container: { display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#1a1a2e' },
  card: { background:'#16213e', padding:'40px', borderRadius:'12px', width:'360px', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' },
  title: { color:'#1aa3fe', textAlign:'center', marginBottom:'4px' },
  subtitle: { color:'#fff', textAlign:'center', marginBottom:'24px' },
  input: { width:'100%', padding:'12px', marginBottom:'12px', borderRadius:'8px', border:'1px solid #0f3460', background:'#0f3460', color:'#fff', fontSize:'14px', boxSizing:'border-box' },
  button: { width:'100%', padding:'12px', background:'#e94560', color:'#fff', border:'none', borderRadius:'8px', fontSize:'16px', cursor:'pointer' },
  error: { color:'#e94560', textAlign:'center', marginBottom:'12px' },
  link: { color:'#aaa', textAlign:'center', marginTop:'16px' }
}
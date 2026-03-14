import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!email || !password) return
    setLoading(true)
    setMessage('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('注册成功！请检查邮箱验证链接。')
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>大鹭科技(泉州)有限公司</h1>
        <p className="auth-subtitle">
          {isLogin ? '登录你的账号' : '创建一个新账号'}
        </p>

        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {message && <p className="auth-message">{message}</p>}

        <button onClick={handleSubmit} disabled={loading}>
          {loading ? '加载中...' : isLogin ? '登录' : '注册'}
        </button>

        <p className="auth-switch">
          {isLogin ? '还没有账号？' : '已有账号？'}
          <span onClick={() => { setIsLogin(!isLogin); setMessage('') }}>
            {isLogin ? '立即注册' : '立即登录'}
          </span>
        </p>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import type { User } from '@supabase/supabase-js'
import './App.css'

interface Todo {
  id: string
  text: string
  done: boolean
  priority: 'low' | 'medium' | 'high'
  category: string
  due_date: string | null
  created_at: string
}

const PRIORITIES = [
  { value: 'high', label: '高', color: '#ff4d4f' },
  { value: 'medium', label: '中', color: '#faad14' },
  { value: 'low', label: '低', color: '#52c41a' },
]

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [input, setInput] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [category, setCategory] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [filterDone, setFilterDone] = useState<'all' | 'active' | 'done'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (session?.user) {
        setUser(session.user)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) fetchTodos()
  }, [user])

  const fetchTodos = async () => {
    const { data } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setTodos(data)
  }

  const addTodo = async () => {
    const text = input.trim()
    if (!text || !user) return
    const { data } = await supabase.from('todos').insert({
      user_id: user.id,
      text,
      done: false,
      priority,
      category: category.trim(),
      due_date: dueDate || null,
    }).select().single()
    if (data) {
      setTodos([data, ...todos])
      setInput('')
      setCategory('')
      setDueDate('')
      setPriority('medium')
    }
  }

  const toggleTodo = async (id: string, done: boolean) => {
    await supabase.from('todos').update({ done: !done }).eq('id', id)
    setTodos(todos.map(t => t.id === id ? { ...t, done: !done } : t))
  }

  const deleteTodo = async (id: string) => {
    await supabase.from('todos').delete().eq('id', id)
    setTodos(todos.filter(t => t.id !== id))
  }

  const logout = () => supabase.auth.signOut()

  const filtered = todos.filter(t => {
    if (filterDone === 'active') return !t.done
    if (filterDone === 'done') return t.done
    return true
  })

  if (loading) return <div className="loading">加载中...</div>
  if (!user) return <Auth />

  return (
    <div className="app">
      <div className="header">
        <h1>大鹭科技(泉州)有限公司</h1>
        <div className="user-info">
          <span>{user.email}</span>
          <button className="logout-btn" onClick={logout}>退出登录</button>
        </div>
      </div>

      <div className="input-section">
        <div className="input-row">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            placeholder="添加新任务..."
          />
          <button onClick={addTodo}>添加</button>
        </div>
        <div className="input-meta">
          <select value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}>
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="分类"
          />
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-row">
        {(['all', 'active', 'done'] as const).map(f => (
          <button
            key={f}
            className={filterDone === f ? 'active' : ''}
            onClick={() => setFilterDone(f)}
          >
            {f === 'all' ? '全部' : f === 'active' ? '进行中' : '已完成'}
          </button>
        ))}
      </div>

      <ul className="todo-list">
        {filtered.length === 0 && <li className="empty">暂无任务</li>}
        {filtered.map(todo => {
          const p = PRIORITIES.find(pp => pp.value === todo.priority)!
          return (
            <li key={todo.id} className={`todo-item ${todo.done ? 'done' : ''}`}>
              <div className="todo-main">
                <span className="priority-dot" style={{ background: p.color }} title={p.label} />
                <span className="todo-text" onClick={() => toggleTodo(todo.id, todo.done)}>
                  {todo.text}
                </span>
                <button className="delete" onClick={() => deleteTodo(todo.id)}>删除</button>
              </div>
              <div className="todo-meta">
                {todo.category && <span className="tag">{todo.category}</span>}
                {todo.due_date && (
                  <span className={`due ${new Date(todo.due_date) < new Date() && !todo.done ? 'overdue' : ''}`}>
                    {todo.due_date}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="stats">
        共 {todos.length} 项，已完成 {todos.filter(t => t.done).length} 项
      </p >
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
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
  position: number
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

  // New features states
  const [darkMode, setDarkMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [selectedTodos, setSelectedTodos] = useState<Set<string>>(new Set())
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [draggedItem, setDraggedItem] = useState<Todo | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('darkMode')
    if (savedTheme === 'true') {
      setDarkMode(true)
      document.body.classList.add('dark')
    }
  }, [])

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    document.body.classList.toggle('dark', newMode)
    localStorage.setItem('darkMode', String(newMode))
  }

  // Request notification permission
  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      alert('此浏览器不支持通知')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setNotificationsEnabled(true)
      localStorage.setItem('notificationsEnabled', 'true')
    }
  }

  // Check for due date notifications
  useEffect(() => {
    if (!notificationsEnabled || todos.length === 0) return

    const checkDueDates = () => {
      const now = new Date()
      todos.forEach(todo => {
        if (todo.done || !todo.due_date) return

        const dueDate = new Date(todo.due_date)
        const diff = dueDate.getTime() - now.getTime()
        const hoursUntilDue = diff / (1000 * 60 * 60)

        // Notify if due date is within 24 hours
        if (hoursUntilDue > 0 && hoursUntilDue <= 24) {
          new Notification('待办提醒', {
            body: `"${todo.text}" 将在 ${hoursUntilDue.toFixed(1)} 小时后到期`,
            icon: '/favicon.ico'
          })
        }
      })
    }

    // Check immediately and then every hour
    checkDueDates()
    const interval = setInterval(checkDueDates, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [todos, notificationsEnabled])

  // Auth state listener - improved session handling
  useEffect(() => {
    // First check if there's a session stored
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      // Also update loading state when session is detected
      if (session?.user) {
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Fetch todos
  useEffect(() => {
    if (user) {
      fetchTodos()
      // Subscribe to realtime changes
      const channel = supabase
        .channel('todos_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setTodos(prev => [payload.new as Todo, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setTodos(prev => prev.map(t => t.id === payload.new.id ? payload.new as Todo : t))
          } else if (payload.eventType === 'DELETE') {
            setTodos(prev => prev.filter(t => t.id !== payload.old.id))
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user])

  const fetchTodos = async () => {
    const { data } = await supabase
      .from('todos')
      .select('*')
      .order('position', { ascending: true })
    if (data) setTodos(data)
  }

  const addTodo = async () => {
    const text = input.trim()
    if (!text || !user) return

    const maxPosition = todos.length > 0 ? Math.max(...todos.map(t => t.position)) : 0

    const { data } = await supabase.from('todos').insert({
      user_id: user.id,
      text,
      done: false,
      priority,
      category: category.trim(),
      due_date: dueDate || null,
      position: maxPosition + 1
    }).select().single()

    if (data) {
      setTodos([...todos, data])
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
    setSelectedTodos(prev => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return
    await supabase.from('todos').update({ text: editText.trim() }).eq('id', id)
    setTodos(todos.map(t => t.id === id ? { ...t, text: editText.trim() } : t))
    setEditingId(null)
    setEditText('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const toggleSelectTodo = (id: string) => {
    setSelectedTodos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const selectAll = () => {
    if (selectedTodos.size === filtered.length) {
      setSelectedTodos(new Set())
    } else {
      setSelectedTodos(new Set(filtered.map(t => t.id)))
    }
  }

  const bulkDelete = async () => {
    if (!confirm(`确定要删除选中的 ${selectedTodos.size} 项吗？`)) return

    const ids = Array.from(selectedTodos)
    await supabase.from('todos').delete().in('id', ids)
    setTodos(todos.filter(t => !selectedTodos.has(t.id)))
    setSelectedTodos(new Set())
  }

  const bulkComplete = async () => {
    const ids = Array.from(selectedTodos)
    await supabase.from('todos').update({ done: true }).in('id', ids)
    setTodos(todos.map(t => selectedTodos.has(t.id) ? { ...t, done: true } : t))
    setSelectedTodos(new Set())
  }

  const exportToJSON = () => {
    const dataStr = JSON.stringify(todos, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `todos_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }

  const exportToCSV = () => {
    const headers = ['ID', 'Text', 'Done', 'Priority', 'Category', 'Due Date', 'Created At']
    const rows = todos.map(t => [
      t.id,
      `"${t.text.replace(/"/g, '""')}"`,
      t.done ? 'Yes' : 'No',
      t.priority,
      `"${t.category}"`,
      t.due_date || '',
      t.created_at
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `todos_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
  }

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    dragItem.current = index
    setDraggedItem(todos[index])
  }

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index
  }

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return

    const newTodos = [...todos]
    const draggedItem = newTodos[dragItem.current]
    newTodos.splice(dragItem.current, 1)
    newTodos.splice(dragOverItem.current, 0, draggedItem)

    // Update positions in database
    const updates = newTodos.map((t, index) => ({
      id: t.id,
      position: index
    }))

    for (const update of updates) {
      await supabase.from('todos').update({ position: update.position }).eq('id', update.id)
    }

    setTodos(newTodos)
    dragItem.current = null
    dragOverItem.current = null
    setDraggedItem(null)
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
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <div className="header">
        <h1>大鹭科技(泉州)有限公司</h1>
        <div className="header-actions">
          <button
            className="icon-btn"
            onClick={toggleDarkMode}
            title={darkMode ? '切换到浅色模式' : '切换到深色模式'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowExportMenu(!showExportMenu)}
            title="导出数据"
          >
            📥
          </button>
          <button
            className="icon-btn"
            onClick={notificationsEnabled ? () => {} : requestNotifications}
            title={notificationsEnabled ? '通知已开启' : '开启通知'}
            style={{ opacity: notificationsEnabled ? 1 : 0.6 }}
          >
            🔔
          </button>
          <div className="user-info">
            <span>{user.email}</span>
            <button className="logout-btn" onClick={logout}>退出登录</button>
          </div>
        </div>
      </div>

      {/* Export Menu */}
      {showExportMenu && (
        <div className="export-menu">
          <button onClick={exportToJSON}>导出为 JSON</button>
          <button onClick={exportToCSV}>导出为 CSV</button>
        </div>
      )}

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

      {/* Bulk Actions */}
      {selectedTodos.size > 0 && (
        <div className="bulk-actions">
          <span>已选择 {selectedTodos.size} 项</span>
          <button onClick={selectAll}>
            {selectedTodos.size === filtered.length ? '取消全选' : '全选'}
          </button>
          <button onClick={bulkComplete} className="bulk-complete">标记完成</button>
          <button onClick={bulkDelete} className="bulk-delete">批量删除</button>
        </div>
      )}

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
        {filtered.map((todo, index) => {
          const p = PRIORITIES.find(pp => pp.value === todo.priority)!
          return (
            <li
              key={todo.id}
              className={`todo-item ${todo.done ? 'done' : ''} ${selectedTodos.has(todo.id) ? 'selected' : ''} ${draggedItem?.id === todo.id ? 'dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="todo-main">
                <input
                  type="checkbox"
                  checked={selectedTodos.has(todo.id)}
                  onChange={() => toggleSelectTodo(todo.id)}
                  className="todo-checkbox"
                />
                <span
                  className="drag-handle"
                  title="拖拽排序"
                >
                  ⋮⋮
                </span>
                <span className="priority-dot" style={{ background: p.color }} title={p.label} />

                {editingId === todo.id ? (
                  <div className="edit-form">
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(todo.id)}
                      autoFocus
                    />
                    <button onClick={() => saveEdit(todo.id)}>保存</button>
                    <button onClick={cancelEdit}>取消</button>
                  </div>
                ) : (
                  <>
                    <span className="todo-text" onClick={() => toggleTodo(todo.id, todo.done)}>
                      {todo.text}
                    </span>
                    <div className="todo-actions">
                      <button className="edit" onClick={() => startEdit(todo)} title="编辑">✏️</button>
                      <button className="delete" onClick={() => deleteTodo(todo.id)} title="删除">🗑️</button>
                    </div>
                  </>
                )}
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
        {selectedTodos.size > 0 && ` | 已选择 ${selectedTodos.size} 项`}
      </p>

      <footer className="footer">
        大鹭科技(泉州)有限公司 © 2025
      </footer>
    </div>
  )
}

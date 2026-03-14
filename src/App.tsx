import { useState, useEffect } from 'react'
import './App.css'

interface Todo {
  id: number
  text: string
  done: boolean
}

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('todos')
    return saved ? JSON.parse(saved) : []
  })
  const [input, setInput] = useState('')

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  const addTodo = () => {
    const text = input.trim()
    if (!text) return
    setTodos([...todos, { id: Date.now(), text, done: false }])
    setInput('')
  }

  const toggleTodo = (id: number) => {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(t => t.id !== id))
  }

  return (
    <div className="app">
      <h1>菠萝芯的待办清单</h1>

      <div className="input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          placeholder="添加新任务..."
        />
        <button onClick={addTodo}>添加</button>
      </div>

      <ul className="todo-list">
        {todos.length === 0 && <li className="empty">暂无任务，休息一下吧~</li>}
        {todos.map(todo => (
          <li key={todo.id} className={todo.done ? 'done' : ''}>
            <span onClick={() => toggleTodo(todo.id)}>{todo.text}</span>
            <button className="delete" onClick={() => deleteTodo(todo.id)}>删除</button>
          </li>
        ))}
      </ul>

      <p className="stats">
        共 {todos.length} 项，已完成 {todos.filter(t => t.done).length} 项
      </p>
    </div>
  )
}

export default App

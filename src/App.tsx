import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useStore } from './lib/store'
import { Board } from './pages/Board'
import { Chat } from './pages/Chat'
import { Group } from './pages/Group'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Settings } from './pages/Settings'
import { Welcome } from './pages/Welcome'

export function App() {
  const { ready, user, workspace } = useStore()
  if (!ready) return null
  if (!user) return <Login />
  if (!workspace) return <Welcome />
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="tableau" element={<Board />} />
          <Route path="chat" element={<Chat />} />
          <Route path="groupe" element={<Group />} />
          <Route path="reglages" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

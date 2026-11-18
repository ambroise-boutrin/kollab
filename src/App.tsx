import { APP_BASE } from './lib/base'
import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useStore } from './lib/store'
import { Board } from './pages/Board'
import { Chat } from './pages/Chat'
import { Group } from './pages/Group'
import { Intro } from './pages/Intro'
import { ProjectSettings } from './pages/ProjectSettings'
import { Reviews } from './pages/Reviews'
import { readIntro } from './lib/intro'
import { Home } from './pages/Home'
import { LoadError } from './pages/LoadError'
import { Login } from './pages/Login'
import { NewPassword } from './pages/NewPassword'
import { Settings } from './pages/Settings'

export function App() {
  const { ready, user, workspace, loadError } = useStore()
  const [resetting, setResetting] = useState(() => new URLSearchParams(window.location.search).has('nouveau-mot-de-passe'))
  if (!ready) return null
  if (loadError) return <LoadError message={loadError} />
  if (!user) return <Login />
  if (resetting)
    return (
      <NewPassword
        onDone={() => {
          const url = new URL(window.location.href)
          url.searchParams.delete('nouveau-mot-de-passe')
          window.history.replaceState(null, '', url)
          setResetting(false)
        }}
      />
    )
  if (!workspace || readIntro(user.id)) return <Intro />
  return (
    <BrowserRouter basename={APP_BASE || '/'}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="tableau" element={<Board />} />
          <Route path="chat" element={<Chat />} />
          <Route path="revues" element={<Reviews />} />
          <Route path="equipe" element={<Group />} />
          <Route path="groupe" element={<Navigate to="/equipe" replace />} />
          <Route path="projet" element={<ProjectSettings />} />
          <Route path="reglages" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

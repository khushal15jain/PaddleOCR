import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getHealth } from '../api.js'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ children }) {
  const [toast, setToast] = useState(null)
  const [health, setHealth] = useState(null)
  const [online, setOnline] = useState(false)
  const [checking, setChecking] = useState(true)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const checkBackend = useCallback(async () => {
    try {
      setChecking(true)
      const data = await getHealth()
      setHealth(data)
      setOnline(data.status === 'healthy')
      return true
    } catch {
      setOnline(false)
      setHealth(null)
      return false
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    checkBackend()
    const timer = setInterval(checkBackend, 15000)
    return () => clearInterval(timer)
  }, [checkBackend])

  const notify = useCallback((msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }, [])

  return (
    <AppCtx.Provider
      value={{
        health,
        online,
        checking,
        theme,
        setTheme,
        notify,
        checkBackend,
      }}
    >
      {children}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-xl transition-all ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-900 text-slate-100 dark:bg-slate-800'
          }`}
        >
          <span>{toast.msg}</span>
        </div>
      )}
    </AppCtx.Provider>
  )
}

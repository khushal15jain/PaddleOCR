import { useEffect, useState } from 'react'
import { api } from './api.js'
import { useApp } from './components/AppContext.jsx'
import { images as mock } from './data/mockData.js'

export function useImages() {
  const { online } = useApp()
  const [live, setLive] = useState(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!online) { setLive(null); return }
    api('/api/images').then(setLive).catch(() => setLive(null))
  }, [online, tick])
  return { images: live || mock, live: !!live, reload: () => setTick(t => t + 1) }
}

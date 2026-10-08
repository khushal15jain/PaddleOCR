import { useState } from 'react'
import { Card, PageHeader, Btn, Modal, inputCls, download } from '../components/ui.jsx'
import { useApp } from '../components/AppContext.jsx'

const DEF = { language: 'fra', mode: 'strict', apiUrl: '', pageSize: 10 }
const load = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem('settings') || '{}') } } catch { return DEF } }

export default function Settings() {
  const [s, setS] = useState(load)
  const [confirm, setConfirm] = useState(false)
  const { theme, setTheme, notify, needBackend } = useApp()
  const field = (label, el) => <label className="block text-sm font-medium">{label}<div className="mt-1">{el}</div></label>
  return (
    <>
      <PageHeader title="Settings" desc="Preferences are stored in this browser only.">
        <Btn onClick={() => download('ui_settings.json', JSON.stringify(s, null, 2), 'application/json')}>Export settings</Btn>
        <Btn v="primary" onClick={() => { localStorage.setItem('settings', JSON.stringify(s)); notify('Settings saved') }}>Save settings</Btn>
      </PageHeader>
      <Card className="max-w-xl space-y-4">
        {field('Theme', <div className="flex gap-2">{['light', 'dark'].map(t => <Btn key={t} v={theme === t ? 'primary' : 'default'} onClick={() => setTheme(t)}>{t}</Btn>)}</div>)}
        {field('OCR language', <select className={inputCls} value={s.language} onChange={e => setS({ ...s, language: e.target.value })}><option value="fra">French (fra)</option><option value="eng">English (eng)</option></select>)}
        {field('Default scoring mode', <select className={inputCls} value={s.mode} onChange={e => setS({ ...s, mode: e.target.value })}><option>strict</option><option>normalized</option></select>)}
        {field('Backend API URL', <input className={inputCls} placeholder="http://localhost:8000" value={s.apiUrl} onChange={e => setS({ ...s, apiUrl: e.target.value })} />)}
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => needBackend('Test backend connection')}>Test connection</Btn>
          <Btn onClick={() => { setS(DEF); localStorage.removeItem('settings'); notify('Settings reset') }}>Reset to defaults</Btn>
          <Btn v="danger" onClick={() => setConfirm(true)}>Clear saved annotations</Btn>
        </div>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Clear saved annotations?">
        <p>This deletes all transcriptions saved in this browser. Export them first if you need them.</p>
        <div className="mt-4 flex justify-end gap-2"><Btn onClick={() => setConfirm(false)}>Cancel</Btn><Btn v="danger" onClick={() => { localStorage.removeItem('annotations'); setConfirm(false); notify('Annotations cleared') }}>Clear</Btn></div>
      </Modal>
    </>
  )
}

import { useState } from 'react'
import { Card, PageHeader, Btn, Badge, Modal, MockBanner, inputCls, download } from '../components/ui.jsx'
import { reports, reportTemplate } from '../data/mockData.js'
import { useApp } from '../components/AppContext.jsx'

export default function Reports() {
  const [q, setQ] = useState('')
  const [view, setView] = useState(null)
  const { needBackend } = useApp()
  const list = reports.filter(r => (r.name + r.file).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <PageHeader title="Reports" desc="Files the benchmark pipeline writes to outputs/. None exist until you run it.">
        <input aria-label="Search reports" className={inputCls + ' w-56'} placeholder="Search reports" value={q} onChange={e => setQ(e.target.value)} />
        <Btn v="primary" onClick={() => needBackend('Generate report')}>Generate report</Btn>
      </PageHeader>
      <MockBanner>Report previews are templates. No report has been generated.</MockBanner>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map(r => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{r.name}</h2><Badge>Not generated</Badge></div>
            <p className="mt-1 text-sm text-slate-500">{r.desc}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">{r.file}</p>
            <div className="mt-3 flex gap-2"><Btn onClick={() => setView(r)}>Preview template</Btn><Btn onClick={() => download(`${r.id}_template.md`, reportTemplate)}>Download template</Btn></div>
          </Card>
        ))}
        {!list.length && <p className="text-sm text-slate-500">No reports match your search.</p>}
      </div>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.name || ''}><pre className="whitespace-pre-wrap font-mono text-xs">{reportTemplate}</pre></Modal>
    </>
  )
}

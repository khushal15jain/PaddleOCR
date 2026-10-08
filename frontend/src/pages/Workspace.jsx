import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, PageHeader, Btn, Tabs, ScanView, ZoomBar, inputCls, download } from '../components/ui.jsx'
import { images, engines } from '../data/mockData.js'
import { useApp } from '../components/AppContext.jsx'

export default function Workspace() {
  const [sp, setSp] = useSearchParams()
  const id = sp.get('img') || 'IMG_005'
  const [zoom, setZoom] = useState(1)
  const [engine, setEngine] = useState(engines[0])
  const [upload, setUpload] = useState(null)
  const [out, setOut] = useState({})
  const fileRef = useRef(null), jsonRef = useRef(null)
  const { notify, needBackend } = useApp()
  const text = out[engine] || ''

  const onJson = e => {
    const f = e.target.files[0]; if (!f) return
    f.text().then(t => { setOut(o => ({ ...o, [engine]: t })); notify(`Loaded ${f.name}`) })
    e.target.value = ''
  }
  const onImg = e => {
    const f = e.target.files[0]; if (!f) return
    setUpload(URL.createObjectURL(f)); notify(`Previewing ${f.name}`); e.target.value = ''
  }
  return (
    <>
      <PageHeader title="OCR Workspace" desc="Inspect a scan next to OCR output. Running OCR needs a backend; you can load an existing result file.">
        <select aria-label="Select image" className={inputCls + ' w-40'} value={id} onChange={e => { setSp({ img: e.target.value }); setUpload(null) }}>
          {images.map(i => <option key={i.id}>{i.id}</option>)}
        </select>
        <Btn onClick={() => fileRef.current.click()}>Preview local image</Btn>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onImg} />
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{upload ? 'Local preview' : id}</h2><ZoomBar zoom={zoom} setZoom={setZoom} /></div>
          <ScanView id={id} src={upload} zoom={zoom} />
        </Card>
        <Card>
          <Tabs tabs={engines} value={engine} onChange={setEngine} />
          <div className="mb-3 flex flex-wrap gap-2">
            <Btn v="primary" onClick={() => needBackend(`Run ${engine} on ${id}`)}>Run OCR</Btn>
            <Btn onClick={() => jsonRef.current.click()}>Load result file</Btn>
            <input ref={jsonRef} type="file" accept=".json,.txt" hidden onChange={onJson} />
            <Btn disabled={!text} onClick={() => navigator.clipboard.writeText(text).then(() => notify('Copied'), () => notify('Copy blocked by browser'))}>Copy</Btn>
            <Btn disabled={!text} onClick={() => download(`${id}_${engine}.txt`, text)}>Download</Btn>
          </div>
          <pre className="h-72 overflow-auto whitespace-pre-wrap rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-800 dark:bg-slate-950">
            {text || 'No output yet. Backend integration required to run OCR, or load an existing result file (e.g. outputs/paddleocr/IMG_005.json).'}
          </pre>
        </Card>
      </div>
    </>
  )
}

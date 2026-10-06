import { useEffect, useState } from 'react'
import { X, AlertCircle, Info, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react'

export function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const toCSV = rows => {
  if (!rows || !rows.length) return ''
  const keys = Object.keys(rows[0])
  return [
    keys.join(','),
    ...rows.map(r =>
      keys.map(k => {
        const v = r[k] ?? ''
        return typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))
          ? `"${v.replace(/"/g, '""')}"`
          : v
      }).join(',')
    ),
  ].join('\n')
}

export const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-teal-600 focus:ring-1 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-teal-400'

export const Card = ({ className = '', children, hover = false }) => (
  <section
    className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 ${
      hover ? 'hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700' : ''
    } ${className}`}
  >
    {children}
  </section>
)

export const StatCard = ({ title, value, subtitle, delta, tone = 'slate', icon: Icon, badge }) => {
  const tones = {
    slate: 'text-slate-900 dark:text-slate-100',
    teal: 'text-teal-700 dark:text-teal-400',
    amber: 'text-amber-700 dark:text-amber-400',
    indigo: 'text-indigo-700 dark:text-indigo-400',
    rose: 'text-rose-700 dark:text-rose-400',
    emerald: 'text-emerald-700 dark:text-emerald-400',
  }

  return (
    <Card className="flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {Icon && (
          <div className="rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className={`text-2xl font-bold tracking-tight ${tones[tone] || tones.slate}`}>
          {value !== undefined && value !== null ? value : '—'}
        </div>
        {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        {delta && <div className="mt-2 text-xs font-medium">{delta}</div>}
        {badge && <div className="mt-2">{badge}</div>}
      </div>
    </Card>
  )
}

export const PageHeader = ({ title, desc, children }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {title}
      </h1>
      {desc && (
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {desc}
        </p>
      )}
    </div>
    <div className="flex flex-wrap items-center gap-2.5">{children}</div>
  </div>
)

const V = {
  primary:
    'border-teal-700 bg-teal-700 text-white shadow-sm hover:bg-teal-800 active:bg-teal-900 focus:ring-2 focus:ring-teal-500/20',
  default:
    'border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750',
  secondary:
    'border-indigo-700 bg-indigo-700 text-white shadow-sm hover:bg-indigo-800 active:bg-indigo-900',
  danger:
    'border-rose-600 bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800',
  outline:
    'border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
}

export const Btn = ({ v = 'default', size = 'md', className = '', disabled, loading, children, ...p }) => {
  const sizes = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  }

  return (
    <button
      type="button"
      disabled={disabled || loading}
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${V[v] || V.default} ${className}`}
    >
      {loading && <RefreshCw size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

const T = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  green: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  rose: 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  teal: 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  indigo: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  purple: 'bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
}

export const Badge = ({ tone = 'slate', className = '', children }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${T[tone] || T.slate} ${className}`}
  >
    {children}
  </span>
)

export const SyntheticBadge = ({ size = 'sm' }) => (
  <span
    title="Demonstration data — synthetic/generated for system validation"
    className={`inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-100 px-2.5 py-0.5 font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/80 dark:text-violet-300 ${
      size === 'sm' ? 'text-xs' : 'text-sm'
    }`}
  >
    <Sparkles size={12} className="text-violet-600 dark:text-violet-400" />
    Synthetic Demo
  </span>
)

export const SyntheticBanner = () => (
  <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-violet-300 bg-violet-50/90 px-4 py-2.5 text-sm text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200">
    <Sparkles size={18} className="shrink-0 text-violet-600 dark:text-violet-400" />
    <div>
      <span className="font-semibold">Demonstration Data Notice:</span> This item contains synthetic/generated historical-style documents created strictly for system validation and pipeline verification. It is not presented as real archival ground truth.
    </div>
  </div>
)

export const Tabs = ({ tabs, value, onChange, counts = {} }) => (
  <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
    {tabs.map(t => {
      const active = value === t
      return (
        <button
          key={t}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(t)}
          className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            active
              ? 'border-teal-700 text-teal-800 dark:border-teal-400 dark:text-teal-300'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <span>{t}</span>
          {counts[t] !== undefined && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                active
                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {counts[t]}
            </span>
          )}
        </button>
      )
    })}
  </div>
)

export function Modal({ open, onClose, title, maxWidth = 'max-w-2xl', children }) {
  useEffect(() => {
    if (!open) return
    const h = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={e => e.stopPropagation()}
        className={`max-h-[90vh] w-full ${maxWidth} flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}

export const LoadingSpinner = ({ label = 'Loading benchmark data...' }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <RefreshCw size={28} className="animate-spin text-teal-600 dark:text-teal-400" />
    <span className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
  </div>
)

export const EmptyState = ({ title = 'No results found', desc = 'Try adjusting your search or filters.', action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
    <div className="rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-slate-800">
      <Info size={24} />
    </div>
    <h3 className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
    <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{desc}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
)

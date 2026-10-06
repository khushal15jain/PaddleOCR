import { useState } from 'react'

/**
 * High-performance, responsive SVG research charts for OCR benchmarking
 */

export function GroupedBarChart({
  data = [],
  xKey = 'image_id',
  series = [
    { key: 'paddle_cer', label: 'PaddleOCR', color: '#0d9488' },
    { key: 'tesseract_cer', label: 'Tesseract', color: '#f59e0b' },
  ],
  title,
  yLabel = 'Rate',
  height = 260,
  maxVal = null,
}) {
  const [hovered, setHovered] = useState(null)

  if (!data || !data.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-400">
        No chart data available
      </div>
    )
  }

  // Calculate max
  const computedMax =
    maxVal ??
    Math.max(
      ...data.flatMap(d => series.map(s => (typeof d[s.key] === 'number' ? d[s.key] : 0))),
      0.05
    ) * 1.15

  const paddingLeft = 50
  const paddingRight = 20
  const paddingTop = 25
  const paddingBottom = 45
  const width = 600

  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const groupWidth = plotWidth / data.length
  const barWidth = Math.max(4, Math.min(22, (groupWidth * 0.75) / series.length))

  // Y-axis ticks (4 ticks)
  const ticks = [0, computedMax * 0.33, computedMax * 0.66, computedMax]

  return (
    <div className="relative w-full overflow-x-auto">
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </span>
          <div className="flex items-center gap-4 text-xs">
            {series.map(s => (
              <span key={s.key} className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full text-xs select-none" style={{ minWidth: 420 }}>
        {/* Y Gridlines and labels */}
        {ticks.map((t, idx) => {
          const y = paddingTop + plotHeight - (t / computedMax) * plotHeight
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-slate-200 dark:text-slate-800"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-mono"
              >
                {t >= 10 ? t.toFixed(0) : t.toFixed(2)}
              </text>
            </g>
          )
        })}

        {/* Y Label */}
        {yLabel && (
          <text
            x={-height / 2}
            y={12}
            transform="rotate(-90)"
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-semibold"
          >
            {yLabel}
          </text>
        )}

        {/* Bars */}
        {data.map((d, dIdx) => {
          const groupX = paddingLeft + dIdx * groupWidth + (groupWidth - series.length * barWidth) / 2
          return (
            <g key={dIdx}>
              {/* Group X label */}
              <text
                x={paddingLeft + dIdx * groupWidth + groupWidth / 2}
                y={height - paddingBottom + 16}
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-medium"
              >
                {d[xKey]?.replace('DEMO_HIST_', 'D_') || dIdx}
              </text>

              {series.map((s, sIdx) => {
                const val = typeof d[s.key] === 'number' ? d[s.key] : 0
                const barHeight = Math.max(1, (val / computedMax) * plotHeight)
                const bx = groupX + sIdx * barWidth
                const by = paddingTop + plotHeight - barHeight

                return (
                  <rect
                    key={s.key}
                    x={bx}
                    y={by}
                    width={barWidth - 2}
                    height={barHeight}
                    fill={s.color}
                    rx={2}
                    className="cursor-pointer transition-opacity duration-150 hover:opacity-80"
                    onMouseEnter={() =>
                      setHovered({
                        item: d[xKey],
                        label: s.label,
                        val: val,
                        color: s.color,
                        x: bx + barWidth / 2,
                        y: by,
                      })
                    }
                    onMouseLeave={() => setHovered(null)}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Floating tooltip */}
      {hovered && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-slate-800 z-10"
          style={{
            left: `${(hovered.x / width) * 100}%`,
            top: `${(hovered.y / height) * 100}%`,
          }}
        >
          <div className="font-semibold">{hovered.item}</div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hovered.color }} />
            <span>{hovered.label}:</span>
            <span className="font-mono font-bold text-white">
              {typeof hovered.val === 'number' ? hovered.val.toFixed(4) : hovered.val}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function MetricComparisonBars({
  metrics = [
    { metric: 'Precision', paddle: 0.85, tesseract: 0.72 },
    { metric: 'Recall', paddle: 0.82, tesseract: 0.68 },
    { metric: 'F1 Score', paddle: 0.83, tesseract: 0.70 },
    { metric: 'Word IoU', paddle: 0.71, tesseract: 0.59 },
  ],
}) {
  return (
    <div className="space-y-4">
      {metrics.map(m => {
        const pVal = m.paddle ?? 0
        const tVal = m.tesseract ?? 0
        const pBetter = pVal >= tVal

        return (
          <div key={m.metric} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">{m.metric}</span>
              <div className="flex items-center gap-4 font-mono">
                <span className={pBetter ? 'font-bold text-teal-700 dark:text-teal-400' : 'text-slate-500'}>
                  PaddleOCR: {(pVal * 100).toFixed(1)}%
                </span>
                <span className={!pBetter ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-500'}>
                  Tesseract: {(tVal * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Side-by-side Progress Bars */}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, pVal * 100)}%` }}
                />
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, tVal * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

import React from 'react'

export type SummaryItem = {
  id: string
  text: string
  note?: string
  clause?: string
}

/**
 * Summary block for audit results.
 * Shows MV (nonconformities) and PE (improvement proposals) with the related standard clause when available.
 */
export default function Summary({ mv = [], pe = [] }: { mv?: SummaryItem[]; pe?: SummaryItem[] }) {
  if ((mv?.length ?? 0) === 0 && (pe?.length ?? 0) === 0) return null

  return (
    <div className="mt-8 p-4 border rounded bg-white/40">
      <h2 className="text-lg font-semibold mb-3">Kokkuvõte</h2>

      {mv?.length ? (
        <Section
          title="Mittevastavused"
          color="red"
          items={mv}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          }
        />
      ) : null}

      {pe?.length ? (
        <Section
          title="Parendusettepanekud"
          color="blue"
          items={pe}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          }
        />
      ) : null}
    </div>
  )
}

function Section({
  title,
  color,
  items,
  icon,
}: {
  title: string
  color: 'red' | 'blue'
  items: SummaryItem[]
  icon: React.ReactNode
}) {
  const colorCls = color === 'red' ? 'text-red-600' : 'text-blue-600'
  return (
    <div className="mb-4">
      <div className={`font-semibold flex items-center gap-2 ${colorCls}`}>
        <span aria-hidden>{icon}</span> {title} ({items.length})
      </div>
      <ul className="list-disc ml-5 mt-1 space-y-1">
        {items.map((item) => (
          <li key={`${title}-${item.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{item.id}</span>
              {item.clause ? (
                <span className="text-xs border rounded px-2 py-0.5">Standardi nõue: {item.clause}</span>
              ) : null}
            </div>
            <div className="mt-0.5">{item.text}</div>
            {item.note ? (
              <div className="block text-sm text-gray-600">Märkus: {item.note}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

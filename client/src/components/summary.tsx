import React from 'react'

export type SummaryItem = { id: string; text: string; note?: string }

export default function Summary({ mv = [], pe = [] }: { mv?: SummaryItem[]; pe?: SummaryItem[] }) {
  if ((mv?.length ?? 0) === 0 && (pe?.length ?? 0) === 0) return null
  return (
    <div className="mt-8 p-4 border rounded bg-white/40">
      <h2 className="text-lg font-semibold mb-3">Kokkuvõte</h2>

      {mv?.length ? (
        <Section title="Mittevastavused" items={mv} />
      ) : null}

      {pe?.length ? (
        <Section title="Parendusettepanekud" items={pe} />
      ) : null}
    </div>
  )
}

function Section({ title, items }: { title: string; items: SummaryItem[] }) {
  return (
    <div className="mb-4">
      <div className="font-semibold">{title} ({items.length})</div>
      <ul className="list-disc ml-5 mt-1 space-y-1">
        {items.map((it) => (
          <li key={`${title}-${it.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{it.id}</span>
            </div>
            <div className="mt-0.5">{it.text}</div>
            {it.note ? <div className="block text-sm text-gray-600">Märkus: {it.note}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

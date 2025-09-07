import React from 'react'
import AuditorHeader from './AuditorHeader'
import Summary, { SummaryItem } from './components/summary'

export default function App() {
  // TODO: Replace these with your real computed arrays
  const summaryMV: SummaryItem[] = []
  const summaryPE: SummaryItem[] = []

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Glamox GPE Siseaudit</h1>
      {/* Header (loads/saves audit meta) */}
      <AuditorHeader auditId="draft" />
      {/* Summary (shows MV & PE with clauses) */}
      <Summary mv={summaryMV} pe={summaryPE} />
    </div>
  )
}

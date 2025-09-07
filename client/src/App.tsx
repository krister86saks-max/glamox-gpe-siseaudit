import React from 'react'
import AuditorHeader from './components/AuditorHeader'
import Summary, { SummaryItem } from './components/summary'

export default function App() {
  // TODO: siia lisa oma päris summaryMV ja summaryPE massiivid
  const summaryMV: SummaryItem[] = []
  const summaryPE: SummaryItem[] = []

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Glamox GPE Siseaudit</h1>
      <AuditorHeader auditId="draft" />
      <Summary mv={summaryMV} pe={summaryPE} />
    </div>
  )
}

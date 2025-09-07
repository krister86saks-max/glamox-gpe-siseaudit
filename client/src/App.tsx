import React from 'react'
import AuditorHeader from './components/AuditorHeader'
import Summary, { SummaryItem } from './components/summary'

export default function App() {
  // TODO: asenda need oma tegelike MV ja PE massiividega
  const summaryMV: SummaryItem[] = []
  const summaryPE: SummaryItem[] = []

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Glamox GPE Siseaudit</h1>

      {/* Audiitori päiseplokk */}
      <AuditorHeader auditId="draft" />

      {/* Kokkuvõte mitte-vastavustest ja parendusettepanekutest */}
      <Summary mv={summaryMV} pe={summaryPE} />
    </div>
  )
}

import React from 'react'
import Summary from './components/summary'

export default function App() {
  // Temporary shell App so the project builds while you wire Summary into real data.
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Glamox GPE Siseaudit</h1>
      <p className="mb-2">App on töös. Kokkuvõtte komponent on lisatud:</p>
      <Summary />
    </div>
  )
}

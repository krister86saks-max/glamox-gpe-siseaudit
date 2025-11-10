import React from 'react';

interface Props {
  mode: 'siseaudit' | 'tarnijaaudit';
  onChange: (m: 'siseaudit' | 'tarnijaaudit') => void;
}

export default function AuditModeTabs({ mode, onChange }: Props) {
  return (
    <div className="flex gap-2 mb-4 print:hidden">
      <button
        className={`px-4 py-2 rounded-2xl shadow ${mode==='siseaudit' ? 'bg-black text-white' : 'bg-white'}`}
        onClick={() => onChange('siseaudit')}
      >
        Siseaudit
      </button>

      <button
        className={`px-4 py-2 rounded-2xl shadow ${mode==='tarnijaaudit' ? 'bg-black text-white' : 'bg-white'}`}
        onClick={() => onChange('tarnijaaudit')}
      >
        Tarnijaaudit
      </button>
    </div>
  );
}

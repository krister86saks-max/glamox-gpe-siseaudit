// client/src/types/audit.ts

// NB: tehtud teadlikult "leebed" tüübid, et SupplierAuditPage.tsx kompileeruks.
//   - QuestionType sisaldab 'open'
//   - SubQuestion omab options/answerOptions/answerText (võivad olla stringid või objektid)
//   - SupplierAuditPoint omab subQuestions, code, comment
//   - SupplierAudit omab supplierName, auditor, date
//   - Ekspordime: SupplierAudit, SupplierAuditTemplate, SubQuestion

export type QuestionType = 'open' | 'single' | 'multi';

// Võib tulla stringidena või objektidena – lubame mõlemad.
// Kui komponendis tehakse ...o (spread), jääb 'any' ohutuks.
export type AnyOption = any;

export interface SubQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: AnyOption[];        // nt ['Jah','Ei'] või [{id,label}]
  answerOptions?: AnyOption[];  // valitud variandid (sama kuju, mida komponent kasutab)
  answerText?: string;          // 'open' vastus
}

export interface SupplierAuditPoint {
  id: string;
  title: string;
  code?: string;                // komponendis kasutatakse
  subQuestions: SubQuestion[];  // teeme nõutavaks, et vältida “possibly undefined”
  comment?: string;             // komponendis kasutatakse
  allowImages?: boolean;
}

export interface SupplierAudit {
  id: string;
  name: string;
  supplierName?: string;        // komponendis kasutatakse
  auditor?: string;             // komponendis kasutatakse
  date?: string;                // komponendis kasutatakse (ISO string)
  points: SupplierAuditPoint[];
}

// Hoian malli nime samana, kui kuskil imporditakse
export type SupplierAuditTemplate = SupplierAudit;


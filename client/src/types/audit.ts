// client/src/types/audit.ts

// NB: SupplierAuditPage.tsx eeldab:
//  - QuestionType sisaldab 'open'
//  - SupplierAuditPoint omab 'code', 'subQuestions', 'comment'
//  - Eksporditakse SupplierAudit, SupplierAuditTemplate, SubQuestion

// Vastusevaliku kirje
export type ChoiceOption = {
  id: string;
  label: string;
};

// Küsimuse tüüp
export type QuestionType = 'open' | 'single' | 'multi';

// Alam-küsimus (komponent kasutab seda nime)
export interface SubQuestion {
  id: string;
  text: string;
  type: QuestionType;     // 'open' | 'single' | 'multi'
  options?: string[];     // single/multi korral valikud
}

// (Varem defineeritud) alternatiivne küsimuse tüüp – hoian alles, kui kuskil kasutatakse
export interface SupplierAuditQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
}

// Auditi punkt (plokk)
// Teeme väljad paindlikuks, et SupplierAuditPage.tsx saaks neid kasutada
export interface SupplierAuditPoint {
  id: string;
  title: string;                 // ploki pealkiri
  code?: string;                 // nt kood (komponent seda küsib)
  subQuestions?: SubQuestion[];  // komponenti järgi
  questions?: SupplierAuditQuestion[]; // jäetud ühilduvuseks
  comment?: string;              // komponendis kasutatakse
  allowImages?: boolean;
}

// Kogu audit/“mall”
export interface SupplierAudit {
  id: string;
  name: string;
  points: SupplierAuditPoint[];
}

// Hoian ka nime "SupplierAuditTemplate", kui komponent seda impordib
export type SupplierAuditTemplate = SupplierAudit;

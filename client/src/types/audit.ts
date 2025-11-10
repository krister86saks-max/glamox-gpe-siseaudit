// client/src/types/audit.ts

// Valikvastuse element (nt checkboxi/single valiku kirje)
export type ChoiceOption = {
  id: string;         // stabiilne ID (nt nanoid)
  label: string;      // mida näidatakse UI-s
};

// Küsimuse tüüp: vaba tekst, üksik valik, mitu valikut
export type QuestionType = 'free' | 'single' | 'multi';

// Ühe auditi punkti sees olev küsimus
export interface SupplierAuditQuestion {
  id: string;                 // küsimuse ID
  text: string;               // küsimuse tekst
  type: QuestionType;         // 'free' | 'single' | 'multi'
  options?: string[];         // kui 'single' või 'multi' → valikud (lihttekstina)
}

// Auditi punkt (plokk), mille all on mitu küsimust + kommentaar
export interface SupplierAuditPoint {
  id: string;                         // punkti ID
  title: string;                      // punkti pealkiri (nt “Ostmine ning kliendirahulolu …”)
  questions: SupplierAuditQuestion[]; // selle punkti küsimused
  allowImages?: boolean;              // kas lubatakse pilte lisada (UI-s)
}

// Kogu “mall”
export interface SupplierAuditTemplate {
  id: string;                         // malli ID
  name: string;                       // malli nimi (nt “Supplier Plastic moulding”)
  points: SupplierAuditPoint[];       // mallis sisalduvad punktid
}

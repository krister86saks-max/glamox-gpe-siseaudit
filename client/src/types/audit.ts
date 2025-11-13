export type QuestionType = 'open' | 'multi'

export interface SubOption {
  id: string
  label: string
  score?: number // valikvastuse punktid (valikuline)
}

export interface SubQuestion {
  id: string
  text: string
  type: QuestionType
  options?: SubOption[]
  // OPEN
  answerText?: string
  // MULTI – valitud valikute id-d
  answerOptions?: string[]
}

export interface SupplierAuditPoint {
  id: string
  title: string
  code?: string
  comment?: string
  subQuestions: SubQuestion[]
}

export interface SupplierAudit {
  id: string
  supplierName: string
  date: string
  auditor: string
  points: SupplierAuditPoint[]
  status: 'draft' | 'final' | string
}

export interface SupplierAuditTemplate {
  id: string
  name: string
  points: SupplierAuditPoint[]
}


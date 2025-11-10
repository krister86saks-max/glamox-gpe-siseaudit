export type QuestionType = 'open' | 'multi';

export interface SubQuestionOption {
  id: string;
  label: string;
}

export interface SubQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: SubQuestionOption[];
  answerText?: string;
  answerOptions?: string[];
}

export interface SupplierAuditPoint {
  id: string;
  code?: string;
  title: string;
  subQuestions: SubQuestion[];
  comment?: string;
}

export interface SupplierAudit {
  id: string;
  supplierName: string;
  date: string;
  auditor: string;
  points: SupplierAuditPoint[];
  status?: 'draft' | 'final';
}

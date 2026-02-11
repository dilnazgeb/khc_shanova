/**
 * Auto-generated entity types
 * Contains all CMS collection interfaces in a single file 
 */

/**
 * Collection ID: constructionprojects
 * Interface for ConstructionProjects
 */
export interface ConstructionProjects {
  _id: string;
  _createdDate?: Date;
  _updatedDate?: Date;
  /** @wixFieldType text */
  projectName?: string;
  /** @wixFieldType text */
  location?: string;
  /** @wixFieldType text */
  description?: string;
  /** @wixFieldType text */
  currentStatus?: string;
  /** @wixFieldType text */
  riskLevel?: 'критичный' | 'тревожный' | 'нормальный';
  /** @wixFieldType number */
  mlRiskProbability?: number;
  /** @wixFieldType number */
  budgetAdherence?: number;
  /** @wixFieldType number */
  scheduleAdherence?: number;
  /** @wixFieldType number */
  smrCompletion?: number;
  /** @wixFieldType number */
  gprDelayPercent?: number;
  /** @wixFieldType number */
  gprDelayDays?: number;
  /** @wixFieldType number */
  dduPayments?: number;
  /** @wixFieldType checkbox */
  guaranteeExtension?: boolean;
  /** @wixFieldType datetime */
  createdAt?: Date | string;
  /** @wixFieldType datetime */
  updatedAt?: Date | string;
  /** @wixFieldType text */
  reportPeriod?: string;
  /** @wixFieldType text */
  code?: string;
  /** @wixFieldType text */
  customer?: string;
  /** Analysis result from PDF analyzer */
  analysisResult?: any;
  /** Flag indicating analyzer needs 3 recent monthly reports to evaluate b6 */
  needs3Reports?: boolean;
  /** Project ID for deduplication (based on code + customer) */
  projectId?: string;
  /** History of reports by month */
  reportHistory?: {
    month: string; // YYYYMM format
    reportPeriod: string; // "2025 декабря" or similar
    smrCompletion: number;
    gprDelayPercent: number;
    gprDelayDays: number;
    dduPayments: number;
    dduMonthlyValues?: number[]; // [м1, м2, м3] in тенге
    riskLevel: 'критичный' | 'тревожный' | 'нормальный';
    timestamp: string; // ISO date
    analysisResult: any;
    pdfUrl?: string; // URL to original PDF file
  }[];
  /** Status explanation / why this status */
  statusReasons?: {
    reason: string;
    metric?: string;
    value?: string | number;
    threshold?: string | number;
    change?: number; // change from previous month
  }[];
  /** Uploaded PDF reports */
  pdfReports?: {
    month: string;
    reportPeriod: string;
    fileName: string;
    uploadedAt: string;
    url?: string;
  }[];
}


/**
 * Collection ID: projecthistory
 * Interface for ProjectHistory
 */
export interface ProjectHistory {
  _id: string;
  _createdDate?: Date;
  _updatedDate?: Date;
  /** @wixFieldType text */
  projectId?: string;
  /** @wixFieldType datetime */
  updateTimestamp?: Date | string;
  /** @wixFieldType text */
  statusChangeDescription?: string;
  /** @wixFieldType text */
  previousProjectStatus?: string;
  /** @wixFieldType text */
  currentProjectStatus?: string;
  /** @wixFieldType text */
  previousRiskLevel?: string;
  /** @wixFieldType text */
  currentRiskLevel?: string;
  /** @wixFieldType text */
  mlPrediction?: string;
  /** @wixFieldType number */
  mlPredictionConfidence?: number;
}


/**
 * Collection ID: projectreports
 * Interface for ProjectReports
 */
export interface ProjectReports {
  _id: string;
  _createdDate?: Date;
  _updatedDate?: Date;
  /** @wixFieldType text */
  reportFileName?: string;
  /** @wixFieldType url */
  downloadLink?: string;
  /** @wixFieldType datetime */
  uploadDate?: Date | string;
  /** @wixFieldType text */
  processingStatus?: string;
  /** @wixFieldType text */
  ingestionLog?: string;
  /** Результаты анализа PDF (JSON объект) */
  analysisResult?: any;
}

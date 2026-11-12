export type Province =
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

/** Money fields are null while the person has not typed anything. */
export type Amount = number | null;

/** Answers to the "is this for your company?" questions. null = not answered. */
export interface Screening {
  /** Private company controlled by Canadian residents (a CCPC). Must be true. */
  canadianPrivate: boolean | null;
  /** Owner or family controls another corporation. Must be false. */
  otherCorporations: boolean | null;
  /** Holds investments or rental property. Must be false. */
  investments: boolean | null;
  /** Sold or scrapped equipment it had been writing off. Must be false. */
  soldEquipment: boolean | null;
}

export interface Company {
  legalName: string;
  /** 9 digits; the RC0001 program account is assumed. */
  businessNumber: string;
  province: Province | '';
  incorporationDate: string; // YYYY-MM-DD
  yearStart: string;
  yearEnd: string;
  street: string;
  city: string;
  postalCode: string;
}

export type ExpenseCategoryId =
  | 'subcontractors' | 'software' | 'salary' | 'payroll' | 'professional' | 'office'
  | 'phone' | 'meals' | 'travel' | 'vehicle' | 'advertising' | 'insurance' | 'bank'
  | 'rent' | 'homeOffice' | 'dues' | 'training' | 'other';

export interface ExpenseLine {
  id: string;
  category: ExpenseCategoryId;
  note: string;
  amount: Amount;
}

export type AssetKind = 'computer' | 'equipment' | 'software';

export interface Asset {
  id: string;
  description: string;
  kind: AssetKind;
  /** Date bought and first used. */
  date: string;
  cost: Amount;
}

export interface YearEndBalances {
  cash: Amount;
  receivables: Amount;
  /** Unpaid bills and credit card balance. */
  payables: Amount;
  /** GST/HST collected but not yet sent to CRA. Negative if a refund is due. */
  salesTaxOwing: Amount;
  /** Positive: the company owes the owner. Negative: the owner owes the company. */
  shareholderLoan: Amount;
  shareCapital: Amount;
  /** Retained earnings at the end of last year. */
  openingRetainedEarnings: Amount;
}

export interface Owner {
  name: string;
  title: string;
}

export interface ReturnData {
  screening: Screening;
  company: Company;
  /** false = nil return: no income, expenses or bank activity this year. */
  hadActivity: boolean | null;
  revenue: Amount;
  expenses: ExpenseLine[];
  assets: Asset[];
  /** Undepreciated balances carried in from last year's Schedule 8. */
  openingUcc: { computer: Amount; equipment: Amount };
  dividendsPaid: Amount;
  instalmentsPaid: Amount;
  /** Non-capital losses from earlier years not yet used (last year's Schedule 4 closing balance). */
  priorLosses: Amount;
  balances: YearEndBalances;
  owner: Owner;
}

export interface CcaAssetResult {
  id: string;
  description: string;
  kind: AssetKind;
  cost: number;
  claim: number;
  /** Plain-language reason for the first-year amount. */
  rule: string;
}

export interface CcaClassResult {
  kind: AssetKind;
  classNumber: number;
  rate: number;
  opening: number;
  additions: number;
  claim: number;
  closing: number;
}

export interface Calculation {
  isNil: boolean;
  daysInYear: number;

  revenue: number;
  /** Operating expenses before the equipment write-off, summed per category. */
  expensesByCategory: { category: ExpenseCategoryId; amount: number }[];
  operatingExpenses: number;
  /** Book amortization. Set equal to the tax write-off (CCA) to keep the books simple. */
  amortization: number;
  totalExpenses: number;
  incomeBeforeTax: number;
  netIncomeAfterTax: number;

  mealsNonDeductible: number;
  netIncomeForTax: number;
  taxableIncome: number;
  /** Positive when the year is a loss for tax purposes. */
  taxLoss: number;
  /** Non-capital losses (Schedule 4): brought in, used against this year's income, and left for later years. */
  lossOpening: number;
  lossApplied: number;
  lossClosing: number;

  businessLimit: number;
  overBusinessLimit: boolean;
  federalRate: number;
  provincialRate: number;
  /** The provincial rate relies on a change that was announced but may not be law yet. */
  provincialRateIsAnnounced: boolean;
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  instalmentsPaid: number;
  balanceOwing: number;

  cca: { assets: CcaAssetResult[]; classes: CcaClassResult[]; total: number };

  balanceSheet: {
    cash: number;
    receivables: number;
    taxesReceivable: number;
    dueFromShareholder: number;
    equipment: number;
    totalAssets: number;
    payables: number;
    taxesPayable: number;
    dueToShareholder: number;
    totalLiabilities: number;
    shareCapital: number;
    openingRetainedEarnings: number;
    dividends: number;
    retainedEarnings: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    /** Assets minus liabilities and equity. Zero when the books tie. */
    difference: number;
    balanced: boolean;
  };

  /** null until the tax year is known. */
  filingDue: string | null;
  balanceDue: string | null;
}

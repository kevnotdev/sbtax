import type { ReturnData } from './types';

export const EMPTY_RETURN: ReturnData = {
  screening: { canadianPrivate: null, otherCorporations: null, investments: null, soldEquipment: null },
  company: {
    legalName: '', businessNumber: '', province: '', incorporationDate: '',
    yearStart: '', yearEnd: '', street: '', city: '', postalCode: '',
  },
  hadActivity: null,
  revenue: null,
  expenses: [],
  assets: [],
  openingUcc: { computer: null, equipment: null },
  dividendsPaid: null,
  instalmentsPaid: null,
  balances: {
    cash: null, receivables: null, payables: null, salesTaxOwing: null,
    shareholderLoan: null, shareCapital: null, openingRetainedEarnings: null,
  },
  owner: { name: '', title: '' },
};

/** A made-up one-person consulting company whose books tie, for trying the product. */
export const SAMPLE_RETURN: ReturnData = {
  screening: { canadianPrivate: true, otherCorporations: false, investments: false, soldEquipment: false },
  company: {
    legalName: 'Northline Consulting Inc.',
    businessNumber: '123456782',
    province: 'ON',
    incorporationDate: '2023-04-10',
    yearStart: '2025-01-01',
    yearEnd: '2025-12-31',
    street: '200 Example Street',
    city: 'Toronto',
    postalCode: 'M5V 2T6',
  },
  hadActivity: true,
  revenue: 145000,
  expenses: [
    { id: 's1', category: 'software', note: 'Hosting and design tools', amount: 2850 },
    { id: 's2', category: 'phone', note: '', amount: 1680 },
    { id: 's3', category: 'meals', note: '', amount: 950 },
    { id: 's4', category: 'subcontractors', note: 'Contract developer', amount: 3500 },
    { id: 's5', category: 'bank', note: '', amount: 420 },
    { id: 's6', category: 'professional', note: 'Bookkeeping', amount: 1200 },
  ],
  assets: [{ id: 'a1', description: 'Laptop', kind: 'computer', date: '2025-03-12', cost: 3499 }],
  openingUcc: { computer: 0, equipment: 0 },
  dividendsPaid: 40000,
  instalmentsPaid: 0,
  balances: {
    cash: 114551,
    receivables: 5000,
    payables: 850,
    salesTaxOwing: 3200,
    shareholderLoan: 0,
    shareCapital: 100,
    openingRetainedEarnings: 24500,
  },
  owner: { name: 'Sam Sample', title: 'Director' },
};

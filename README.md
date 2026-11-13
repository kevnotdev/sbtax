# TaxPilot

A plain-language T2 corporate tax return for small incorporated businesses in Canada.

```
npm run dev        # http://localhost:3000  (add ?sample to load a sample company)
npm test           # tax engine tests
npm run typecheck
```

## Where things are

- `src/lib/brand.ts`: product name, filing fee, and the `DEMO_FILING` switch.
- `src/lib/tax-engine/rates.ts`: every tax rate and write-off rule, with the date it was last checked.
- `src/lib/tax-engine/calculator.ts`: the return calculation. `checks.ts` decides what blocks filing.
- `src/components/steps/`: one file per screen.

## Not real yet

Filing is a labelled simulation. Sending returns to CRA requires certification under CRA's
T2 Corporation Internet Filing program, and the certified `.cor` file format is not implemented.

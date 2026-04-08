import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type CurrencyCode = "USD" | "KES" | "UGX" | "TZS" | "EUR" | "GBP";

interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  rate: number; // rate relative to USD (1 USD = X units)
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", rate: 1 },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling", rate: 129.5 },
  UGX: { code: "UGX", symbol: "USh", name: "Ugandan Shilling", rate: 3750 },
  TZS: { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling", rate: 2650 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", rate: 0.92 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", rate: 0.79 },
};

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  formatAmount: (usdAmount: number) => string;
  convertAmount: (usdAmount: number) => number;
  currencyInfo: CurrencyInfo;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    return (localStorage.getItem("preferred_currency") as CurrencyCode) || "USD";
  });

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    localStorage.setItem("preferred_currency", code);
  }, []);

  const currencyInfo = CURRENCIES[currency];

  const convertAmount = useCallback(
    (usdAmount: number) => usdAmount * currencyInfo.rate,
    [currencyInfo.rate]
  );

  const formatAmount = useCallback(
    (usdAmount: number) => {
      const converted = usdAmount * currencyInfo.rate;
      // For currencies with large values (UGX, TZS), skip decimals
      const decimals = currencyInfo.rate >= 100 ? 0 : 2;
      return `${currencyInfo.symbol} ${converted.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    },
    [currencyInfo]
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount, convertAmount, currencyInfo }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

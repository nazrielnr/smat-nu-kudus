/**
 * Accounting engine: journal generation, balance validation, ledger, trial balance.
 * Pure logic; all persistence goes through repositories/routes with D1 batches.
 */
import type { AccountRow, AccountType } from "../repositories/accounts";
import type { TransactionRow } from "../repositories/transactions";

export interface JournalLineSpec {
  account_id: number;
  account_code?: string;
  account_name?: string;
  description?: string | null;
  debit: number;
  credit: number;
}

export interface JournalSpec {
  journal_number: string;
  entry_date: string;
  description: string | null;
  source_type: "manual" | "transaction_post" | "transaction_reversal";
  source_transaction_id: number | null;
  transaction_id: number | null;
  lines: JournalLineSpec[];
}

export class AccountingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Validate that a journal is balanced: total debit === total credit, non-zero, no negative lines. */
export function validateBalanced(lines: JournalLineSpec[]): void {
  if (lines.length < 2) {
    throw new AccountingError("UNBALANCED_JOURNAL", "Journal must have at least 2 lines");
  }
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    if (line.debit < 0 || line.credit < 0) {
      throw new AccountingError("NEGATIVE_LINE", "Journal lines cannot have negative amounts");
    }
    if (line.debit > 0 && line.credit > 0) {
      throw new AccountingError("BOTH_SIDES", "A journal line cannot have both debit and credit");
    }
    if (line.debit === 0 && line.credit === 0) {
      throw new AccountingError("ZERO_LINE", "A journal line cannot be zero on both sides");
    }
    totalDebit += line.debit;
    totalCredit += line.credit;
  }
  if (totalDebit === 0 || totalCredit === 0) {
    throw new AccountingError("UNBALANCED_JOURNAL", "Journal totals cannot be zero");
  }
  if (totalDebit !== totalCredit) {
    throw new AccountingError(
      "UNBALANCED_JOURNAL",
      `Journal is not balanced: debit ${totalDebit} != credit ${totalCredit}`
    );
  }
}

export function journalTotals(lines: JournalLineSpec[]): { total_debit: number; total_credit: number } {
  return {
    total_debit: lines.reduce((s, l) => s + l.debit, 0),
    total_credit: lines.reduce((s, l) => s + l.credit, 0),
  };
}

/** Kas/Bank account selection by payment method. */
const CASH_ACCOUNT_CODE = "111";
const BANK_ACCOUNT_CODE = "112";
const ASSET_NONCASH_CODE = "120";
const ASSET_WAQF_NETO_CODE = "411-6";

export function cashAccountFor(tx: Pick<TransactionRow, "payment_method" | "rekening">): string {
  if (tx.payment_method === "transfer" || tx.rekening) return BANK_ACCOUNT_CODE;
  return CASH_ACCOUNT_CODE;
}

/**
 * Build journal lines for a transaction.
 *
 * - penerimaan uang (cash):     Dr Kas/Bank, Cr category default (pendapatan) account
 * - penerimaan aset nonkas:     Dr Aset Wakaf Nonkas, Cr Aset Wakaf (aset neto)
 * - pengeluaran:                Dr category default (beban) account, Cr Kas/Bank
 */
export function buildJournalLines(
  tx: TransactionRow,
  categoryAccount: AccountRow,
  accounts: AccountRow[]
): JournalLineSpec[] {
  const byCode = new Map(accounts.map((a) => [a.code, a] as const));
  const kas = byCode.get(CASH_ACCOUNT_CODE)!;
  const bank = byCode.get(BANK_ACCOUNT_CODE)!;
  const noncash = byCode.get(ASSET_NONCASH_CODE)!;
  const neto = byCode.get(ASSET_WAQF_NETO_CODE)!;

  const lines: JournalLineSpec[] = [];
  const cashAccount = tx.payment_method === "transfer" || tx.rekening ? bank : kas;

  if (tx.transaction_type === "penerimaan") {
    if (tx.payment_method === "aset_nonkas" || tx.payment_method === "aset") {
      lines.push({
        account_id: noncash.id, account_code: noncash.code, account_name: noncash.name,
        description: tx.description, debit: tx.amount, credit: 0,
      });
      lines.push({
        account_id: neto.id, account_code: neto.code, account_name: neto.name,
        description: tx.description, debit: 0, credit: tx.amount,
      });
    } else {
      lines.push({
        account_id: cashAccount.id, account_code: cashAccount.code, account_name: cashAccount.name,
        description: tx.description, debit: tx.amount, credit: 0,
      });
      lines.push({
        account_id: categoryAccount.id, account_code: categoryAccount.code, account_name: categoryAccount.name,
        description: tx.description, debit: 0, credit: tx.amount,
      });
    }
  } else {
    // pengeluaran
    lines.push({
      account_id: categoryAccount.id, account_code: categoryAccount.code, account_name: categoryAccount.name,
      description: tx.description, debit: tx.amount, credit: 0,
    });
    lines.push({
      account_id: cashAccount.id, account_code: cashAccount.code, account_name: cashAccount.name,
      description: tx.description, debit: 0, credit: tx.amount,
    });
  }
  return lines;
}

/** Swap debit/credit for reversal journals. */
export function reverseLines(lines: JournalLineSpec[]): JournalLineSpec[] {
  return lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));
}

/**
 * Ledger running balance sign convention:
 * - aset & beban: debit increases
 * - liabilitas, aset_neto & pendapatan: credit increases
 */
export function isDebitPositive(accountType: AccountType): boolean {
  return accountType === "aset" || accountType === "beban";
}

export interface LedgerRow {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  entry_date: string;
  journal_number: string;
  journal_id: number;
  description: string | null;
  debit: number;
  credit: number;
  running_balance: number;
}

export function computeRunningBalance(
  opening: number,
  rows: Array<Omit<LedgerRow, "running_balance">>
): LedgerRow[] {
  let balance = opening;
  return rows.map((r) => {
    balance += r.debit - r.credit;
    return { ...r, running_balance: balance };
  });
}

export interface TrialBalanceRow {
  account_id: number;
  code: string;
  name: string;
  account_type: AccountType;
  saldo_awal: number;
  total_debit: number;
  total_credit: number;
  saldo_akhir: number;
}

export interface TrialBalanceResult {
  date: string;
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  balanced: boolean;
}

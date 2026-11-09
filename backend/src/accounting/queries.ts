import type { D1Database } from "@cloudflare/workers-types";
import type { AccountRow, AccountType } from "../repositories/accounts";
import { computeRunningBalance, isDebitPositive, type LedgerRow } from "./engine";

export async function getLedger(
  db: D1Database,
  accountId: number,
  dateFrom: string | null,
  dateTo: string | null
): Promise<{ account: AccountRow; opening: number; rows: LedgerRow[]; closing: number }> {
  const account = await db
    .prepare("SELECT * FROM accounts WHERE id = ?")
    .bind(accountId)
    .first<AccountRow>();
  if (!account) throw new Error("Account not found");

  const sign = isDebitPositive(account.account_type as AccountType) ? 1 : -1;

  // opening balance: all posted journal movements strictly before dateFrom (or all-time when no from)
  let opening = 0;
  if (dateFrom) {
    const openRow = await db
      .prepare(
        `SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS d FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_id
         WHERE jl.account_id = ? AND je.status = 'posted' AND je.entry_date < ?`
      )
      .bind(accountId, dateFrom)
      .first<{ d: number }>();
    opening = (openRow?.d ?? 0) * sign;
  }

  const where = ["jl.account_id = ?", "je.status = 'posted'"];
  const params: unknown[] = [accountId];
  if (dateFrom) { where.push("je.entry_date >= ?"); params.push(dateFrom); }
  if (dateTo) { where.push("je.entry_date <= ?"); params.push(dateTo); }

  const r = await db
    .prepare(
      `SELECT jl.account_id, a.code AS account_code, a.name AS account_name, a.account_type,
              je.entry_date, je.journal_number, je.id AS journal_id, jl.description,
              jl.debit, jl.credit
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_id
       JOIN accounts a ON a.id = jl.account_id
       WHERE ${where.join(" AND ")}
       ORDER BY je.entry_date, je.id, jl.line_number`
    )
    .bind(...params)
    .all<Omit<LedgerRow, "running_balance">>();

  // engine computes running balance in debit-positive space; adjust sign for report
  const rows = computeRunningBalance(0, r.results ?? []).map((row) => ({
    ...row,
    running_balance: row.running_balance * sign,
  }));
  const movement = rows.reduce((s, x) => s + (x.debit - x.credit) * sign, 0);
  return { account, opening, rows, closing: opening + movement };
}

export interface TrialRow {
  account_id: number;
  code: string;
  name: string;
  account_type: string;
  opening: number;
  total_debit: number;
  total_credit: number;
  closing: number;
}

export async function getTrialBalance(db: D1Database, date: string) {
  const r = await db
    .prepare(
      `SELECT a.id AS account_id, a.code, a.name, a.account_type,
              COALESCE(SUM(CASE WHEN je.entry_date < ? THEN jl.debit - jl.credit ELSE 0 END), 0) AS raw_opening,
              COALESCE(SUM(CASE WHEN je.entry_date <= ? THEN jl.debit ELSE 0 END), 0) AS total_debit,
              COALESCE(SUM(CASE WHEN je.entry_date <= ? THEN jl.credit ELSE 0 END), 0) AS total_credit
       FROM accounts a
       LEFT JOIN journal_lines jl ON jl.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jl.journal_id AND je.status = 'posted'
       GROUP BY a.id, a.code, a.name, a.account_type
       ORDER BY a.code`
    )
    .bind(date, date, date)
    .all<{
      account_id: number; code: string; name: string; account_type: string;
      raw_opening: number; total_debit: number; total_credit: number;
    }>();

  const rows: TrialRow[] = (r.results ?? []).map((x) => {
    const sign = isDebitPositive(x.account_type as AccountType) ? 1 : -1;
    const opening = x.raw_opening * sign;
    const movement = x.total_debit - x.total_credit;
    return {
      account_id: x.account_id,
      code: x.code,
      name: x.name,
      account_type: x.account_type,
      opening,
      total_debit: x.total_debit,
      total_credit: x.total_credit,
      closing: movement * sign,
    };
  });

  const totalDebit = rows.reduce((s, x) => s + x.total_debit, 0);
  const totalCredit = rows.reduce((s, x) => s + x.total_credit, 0);
  return {
    date,
    rows,
    total_debit: totalDebit,
    total_credit: totalCredit,
    balanced: totalDebit === totalCredit,
  };
}

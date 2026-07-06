import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Search, Trash2, Loader2, Receipt, PiggyBank, ArrowUpRight, ArrowDownRight, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { formatINR, toPaise } from "@/lib/money";
import { Money, PageHeader, StatTile, EmptyState } from "@/components/app/primitives";
import { Modal, Field } from "@/components/app/Modal";
import {
  listTransactionsFn, addTransactionFn, deleteTransactionFn, importTransactionsFn,
} from "@/api/transactions";

export const Route = createFileRoute("/_app/transactions")({
  validateSearch: (search: Record<string, unknown>): { create?: true } =>
    search.create === true ||
    search.create === "true" ||
    search.create === 1 ||
    search.create === "1"
      ? { create: true }
      : {},
  loader: async () => await listTransactionsFn(),
  component: TransactionsPage,
});

type TypeFilter = "all" | "income" | "expense";
type TxType = "income" | "expense";
type LoaderTx = Awaited<ReturnType<typeof listTransactionsFn>>["transactions"][number];
type ParsedRow = { date?: string; name: string; category?: string; amount: number };

/* ---------- CSV parsing (client-side, robust-enough) ---------- */

/** Split a single CSV line, honouring double-quoted fields that contain commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Clean a raw amount cell to a signed number. "(1,200)" or "-₹1,200" -> -1200. */
function cleanAmount(raw: string): number {
  let s = (raw ?? "").trim();
  if (!s) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.trim().startsWith("-")) neg = true;
  s = s.replace(/[^0-9.]/g, "");
  if (s === "" || s === ".") return NaN;
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return neg ? -Math.abs(n) : n;
}

const NAME_KEYS = ["description", "narration", "particular", "details", "merchant", "payee", "name"];

/** Parse CSV text into importable rows. Amount keeps its sign (negative = expense). */
function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const first = splitCsvLine(lines[0]);
  const lower = first.map((c) => c.toLowerCase());
  const headerKeys = ["date", "amount", "description", "name", "category", "type", "debit", "credit", "narration", "particular"];
  const hasHeader = lower.some((c) => headerKeys.some((k) => c.includes(k)));

  let dateIdx = -1, nameIdx = -1, amountIdx = -1, categoryIdx = -1, typeIdx = -1, debitIdx = -1, creditIdx = -1;
  let dataLines = lines;

  if (hasHeader) {
    lower.forEach((c, i) => {
      if (dateIdx < 0 && c.includes("date")) { dateIdx = i; return; }
      if (nameIdx < 0 && NAME_KEYS.some((k) => c.includes(k))) { nameIdx = i; return; }
      if (amountIdx < 0 && c.includes("amount")) { amountIdx = i; return; }
      if (categoryIdx < 0 && c.includes("category")) { categoryIdx = i; return; }
      if (typeIdx < 0 && c.includes("type")) { typeIdx = i; return; }
      if (debitIdx < 0 && (c.includes("debit") || c.includes("withdrawal"))) { debitIdx = i; return; }
      if (creditIdx < 0 && (c.includes("credit") || c.includes("deposit"))) { creditIdx = i; return; }
    });
    dataLines = lines.slice(1);
  }

  const rows: ParsedRow[] = [];
  for (const line of dataLines) {
    const cols = splitCsvLine(line);
    if (cols.length === 0) continue;

    let date: string | undefined;
    let name = "";
    let category: string | undefined;
    let amount = NaN;

    if (hasHeader) {
      if (dateIdx >= 0) date = cols[dateIdx];
      if (nameIdx >= 0) name = cols[nameIdx] ?? "";
      if (categoryIdx >= 0) category = cols[categoryIdx];
      if (amountIdx >= 0) {
        amount = cleanAmount(cols[amountIdx] ?? "");
      } else if (debitIdx >= 0 || creditIdx >= 0) {
        const debit = debitIdx >= 0 ? cleanAmount(cols[debitIdx] ?? "") : NaN;
        const credit = creditIdx >= 0 ? cleanAmount(cols[creditIdx] ?? "") : NaN;
        if (Number.isFinite(credit) && credit !== 0) amount = Math.abs(credit);
        else if (Number.isFinite(debit) && debit !== 0) amount = -Math.abs(debit);
      }
      if (typeIdx >= 0 && Number.isFinite(amount)) {
        const t = (cols[typeIdx] ?? "").toLowerCase();
        if (t.includes("expense") || t.includes("debit") || t.includes("withdraw")) amount = -Math.abs(amount);
        else if (t.includes("income") || t.includes("credit") || t.includes("deposit")) amount = Math.abs(amount);
      }
    } else if (cols.length >= 3) {
      // assume [date, description, amount]
      date = cols[0];
      name = cols[1] ?? "";
      amount = cleanAmount(cols[2] ?? "");
    } else if (cols.length === 2) {
      // assume [description, amount]
      name = cols[0] ?? "";
      amount = cleanAmount(cols[1] ?? "");
    } else {
      continue;
    }

    name = (name ?? "").trim();
    if (!name) name = "Imported transaction";
    if (name.length > 120) name = name.slice(0, 120);
    if (!Number.isFinite(amount) || amount === 0) continue;

    const cleanCategory = category?.trim();
    rows.push({
      date: date?.trim() ? date.trim() : undefined,
      name,
      category: cleanCategory ? cleanCategory.slice(0, 40) : undefined,
      amount,
    });
    if (rows.length >= 500) break; // server caps at 500 rows
  }
  return rows;
}

function TransactionsPage() {
  const { transactions, categories, monthIncome, monthExpense, monthSaved } =
    Route.useLoaderData() as Awaited<ReturnType<typeof listTransactionsFn>>;
  const { create } = Route.useSearch();
  const router = useRouter();

  const expenseCategories = useMemo(
    () => categories.filter((c) => c !== "Income"),
    [categories],
  );

  // Optimistic mirror of the loader list — updated instantly on add/delete,
  // then reconciled by router.invalidate() re-running the loader.
  const [rows, setRows] = useState<LoaderTx[]>(transactions);
  useEffect(() => {
    setRows(transactions);
  }, [transactions]);

  // Filters
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [catFilter, setCatFilter] = useState<string>("all");

  // Create modal
  const [createOpen, setCreateOpen] = useState<boolean>(create ?? false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState<TxType>("expense");
  const [category, setCategory] = useState<string>(() => expenseCategories[0] ?? "Other");
  const [roundup, setRoundup] = useState(true);
  const [busy, setBusy] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // CSV import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ParsedRow[]>([]);
  const [importBusy, setImportBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (catFilter !== "all" && t.category !== catFilter) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, typeFilter, catFilter]);

  const resetForm = () => {
    setName("");
    setAmount("");
    setTxType("expense");
    setCategory(expenseCategories[0] ?? "Other");
    setRoundup(true);
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!name.trim()) {
      toast.error("Add a description");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);

    // Optimistic insert at the top of the list.
    const now = new Date();
    const optimisticId = `optimistic-${now.getTime()}`;
    const optimistic: LoaderTx = {
      id: optimisticId,
      userId: "",
      name: name.trim(),
      category: txType === "income" ? "Income" : category,
      icon: txType === "income" ? "💰" : "🧾",
      amount: toPaise(amt),
      type: txType,
      roundupSaved: 0,
      occurredAt: now,
      createdAt: now,
    };
    setRows((prev) => [optimistic, ...prev]);

    try {
      const res = await addTransactionFn({
        data: {
          name: name.trim(),
          category: txType === "income" ? "Income" : category,
          amount: amt,
          type: txType,
          roundup: txType === "expense" ? roundup : false,
        },
      });
      await router.invalidate();
      if (res.roundup > 0) {
        toast.success(`Transaction added · ${formatINR(res.roundup, { sign: true })} auto-saved`);
      } else {
        toast.success("Transaction added");
      }
      setCreateOpen(false);
      resetForm();
    } catch (e) {
      // Drop the optimistic row now; invalidate restores server truth.
      setRows((prev) => prev.filter((t) => t.id !== optimisticId));
      await router.invalidate();
      toast.error(e instanceof Error ? e.message : "Couldn't add transaction");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    setDeletingId(id);
    // Optimistic removal.
    setRows((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await deleteTransactionFn({ data: { id } });
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't delete transaction");
        await router.invalidate();
        return;
      }
      await router.invalidate();
      toast.success("Transaction deleted");
    } catch {
      await router.invalidate();
      toast.error("Couldn't delete transaction");
    } finally {
      setDeletingId(null);
    }
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast.error("No valid rows found in that CSV");
        return;
      }
      setImportRows(parsed);
      setImportOpen(true);
    } catch {
      toast.error("Couldn't read that CSV file");
    }
  };

  const confirmImport = async () => {
    if (importRows.length === 0) return;
    setImportBusy(true);
    try {
      const res = await importTransactionsFn({ data: { rows: importRows } });
      await router.invalidate();
      toast.success(`Imported ${res.imported} transaction${res.imported === 1 ? "" : "s"}`);
      setImportOpen(false);
      setImportRows([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't import transactions");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Transactions"
        subtitle="Every rupee in and out. Search, filter, and round spare change straight into your pods."
        actions={
          <>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Import CSV
            </button>
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Add transaction
            </button>
          </>
        }
      />

      {/* Hidden CSV picker */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFilePicked}
      />

      {/* Month stats */}
      <div className="reveal grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Income" value={<Money paise={monthIncome} />} sub="this month" />
        <StatTile label="Spent" value={<Money paise={monthExpense} />} sub="this month" />
        <StatTile accent label="Auto-Saved" value={<Money paise={monthSaved} />} sub="roundups this month" />
      </div>

      {/* Filters + list */}
      <div className="reveal panel p-6">
        {/* Filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <input
              className="input-field pl-9"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search transactions"
            />
          </div>

          <div className="flex items-center rounded-lg bg-white/[0.03] border border-white/[0.06] p-1 shrink-0">
            {(["all", "income", "expense"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setTypeFilter(v)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm capitalize transition cursor-pointer",
                  typeFilter === v
                    ? "bg-[#00E5FF]/15 text-[#00E5FF]"
                    : "text-white/50 hover:text-white",
                )}
              >
                {v}
              </button>
            ))}
          </div>

          <select
            className="input-field sm:w-48 shrink-0"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="mt-5 -mx-2 max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Receipt size={22} />}
              title={rows.length === 0 ? "No transactions yet" : "No matches"}
              hint={
                rows.length === 0
                  ? "Add your first transaction to start tracking your money."
                  : "Try a different search or clear your filters."
              }
              action={
                rows.length === 0 ? (
                  <button className="btn-primary" onClick={() => setCreateOpen(true)}>
                    <Plus size={16} /> Add transaction
                  </button>
                ) : undefined
              }
            />
          ) : (
            filtered.map((t) => (
              <div
                key={t.id}
                className="group flex items-center gap-3 px-2 py-3 border-t border-white/5 hover:bg-white/[0.02] rounded-lg transition"
              >
                <div className="h-10 w-10 rounded-lg bg-white/[0.04] border border-white/[0.06] grid place-items-center text-lg shrink-0" aria-hidden>
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{t.name}</p>
                  <p className="text-[11px] text-white/40">
                    {t.category} · {formatDistanceToNow(new Date(t.occurredAt), { addSuffix: true })}
                  </p>
                </div>
                {t.roundupSaved > 0 && (
                  <span className="chip !text-[#00E5FF] !border-[#00E5FF]/25 !bg-[#00E5FF]/10">
                    <PiggyBank size={9} /> +<Money paise={t.roundupSaved} />
                  </span>
                )}
                <span
                  className={cn(
                    "num text-sm font-semibold w-24 text-right",
                    t.type === "income" ? "text-[#00FF9D]" : "text-white",
                  )}
                >
                  {t.type === "income" ? "+" : "−"}<Money paise={t.amount} />
                </span>
                <button
                  onClick={() => onDelete(t.id)}
                  disabled={deletingId === t.id}
                  className="h-8 w-8 shrink-0 rounded-lg grid place-items-center text-white/40 hover:text-[#FF6B7A] hover:bg-[#FF6B7A]/10 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Delete transaction"
                >
                  {deletingId === t.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add transaction modal */}
      <Modal
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) resetForm();
        }}
        title="Add transaction"
        description="Log money in or out. Round expenses up into a pod automatically."
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary" onClick={submit} disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Description" htmlFor="tx-name">
            <input
              id="tx-name"
              className="input-field"
              placeholder="e.g. Chai with friends"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </Field>

          <Field label="Amount (₹)" htmlFor="tx-amount">
            <input
              id="tx-amount"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              className="input-field"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>

          <Field label="Type" htmlFor="tx-type-expense">
            <div className="grid grid-cols-2 gap-2">
              <button
                id="tx-type-expense"
                type="button"
                onClick={() => setTxType("expense")}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-medium transition cursor-pointer flex items-center justify-center gap-2",
                  txType === "expense"
                    ? "bg-[#FF8A5B]/15 border-[#FF8A5B]/40 text-[#FF8A5B]"
                    : "bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white",
                )}
              >
                <ArrowDownRight size={15} /> Expense
              </button>
              <button
                type="button"
                onClick={() => setTxType("income")}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-medium transition cursor-pointer flex items-center justify-center gap-2",
                  txType === "income"
                    ? "bg-[#00FF9D]/15 border-[#00FF9D]/40 text-[#00FF9D]"
                    : "bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white",
                )}
              >
                <ArrowUpRight size={15} /> Income
              </button>
            </div>
          </Field>

          <Field label="Category" htmlFor="tx-category">
            {txType === "income" ? (
              <input id="tx-category" className="input-field" value="Income" readOnly disabled />
            ) : (
              <select
                id="tx-category"
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {expenseCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>

          {txType === "expense" && (
            <button
              type="button"
              onClick={() => setRoundup((r) => !r)}
              className="w-full flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 text-left cursor-pointer hover:bg-white/[0.05] transition"
              aria-pressed={roundup}
            >
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <PiggyBank size={14} className="text-[#00E5FF]" /> Roundup
                </p>
                <p className="text-[11px] text-white/40 mt-0.5">Round up to nearest ₹100 into a pod</p>
              </div>
              <span
                className={cn(
                  "h-6 w-11 rounded-full relative transition shrink-0",
                  roundup ? "bg-[#00E5FF] shadow-[0_0_12px_#00E5FF80]" : "bg-white/10",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-[#06060F] transition-all",
                    roundup ? "right-0.5" : "left-0.5",
                  )}
                />
              </span>
            </button>
          )}
        </div>
      </Modal>

      {/* CSV import preview modal */}
      <Modal
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o);
          if (!o) setImportRows([]);
        }}
        title="Import from CSV"
        description="Review the parsed rows, then confirm the import."
        footer={
          <>
            <button className="btn-ghost" onClick={() => setImportOpen(false)} disabled={importBusy}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={confirmImport}
              disabled={importBusy || importRows.length === 0}
            >
              {importBusy && <Loader2 size={16} className="animate-spin" />}
              Import {importRows.length} row{importRows.length === 1 ? "" : "s"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl p-3.5 border bg-[#00E5FF]/10 border-[#00E5FF]/25">
            <p className="font-mono-tech text-[9px] uppercase tracking-[0.18em] text-white/50">Ready to import</p>
            <p className="num text-2xl font-semibold mt-1 text-[#00E5FF]">{importRows.length}</p>
            <p className="text-[11px] text-white/50 mt-0.5">
              valid row{importRows.length === 1 ? "" : "s"} parsed from your file
            </p>
          </div>

          {importRows.length > 0 && (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              {importRows.slice(0, 5).map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 border-t border-white/5 first:border-t-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{r.name}</p>
                    <p className="text-[11px] text-white/40 truncate">
                      {r.category ? `${r.category} · ` : ""}
                      {r.date ? r.date : "no date"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "num text-sm font-semibold shrink-0",
                      r.amount < 0 ? "text-white" : "text-[#00FF9D]",
                    )}
                  >
                    {r.amount < 0 ? "−" : "+"}
                    <Money paise={toPaise(Math.abs(r.amount))} />
                  </span>
                </div>
              ))}
              {importRows.length > 5 && (
                <p className="px-3 py-2 text-[11px] text-white/40 border-t border-white/5">
                  +{importRows.length - 5} more row{importRows.length - 5 === 1 ? "" : "s"}…
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] text-white/40">
            Format: date, description, amount (negative = expense). Headers are auto-detected when present.
          </p>
        </div>
      </Modal>
    </div>
  );
}

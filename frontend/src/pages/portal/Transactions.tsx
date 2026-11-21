import { useState } from 'react';
import { LuDownload, LuHistory } from 'react-icons/lu';
import { useL, useT } from '../../i18n';
import { formatDateTime } from '../../lib/format';
import { portal, type Transaction } from '../../lib/portal-api';
import { useLang } from '../../router';
import { ErrorNote, Pager, StatusBadge, useMoney } from '../../components/portal/Bits';
import { methodLabel, txStatusLabel, txTypeLabel } from '../../components/portal/labels';
import { PortalShell, useLoad } from '../../components/portal/Shell';
import { Button } from '../../components/ui/Button';
import { EmptyState, Spinner } from '../../components/ui/Feedback';
import { SelectField } from '../../components/ui/Form';

const PAGE = 20;

function toCsv(rows: Transaction[]) {
  const head = ['id', 'date', 'type', 'method', 'amount', 'currency', 'status', 'account', 'reference'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [head.join(','), ...rows.map((r) => [r.id, r.created_at, r.type, r.method, r.amount, r.currency, r.status, r.account_login, r.reference].map(esc).join(','))].join('\n');
}

export default function Transactions() {
  const L = useL();
  const t = useT();
  const lang = useLang();
  const money = useMoney();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const data = useLoad(() => portal.transactions({ type, status, page, page_size: PAGE }), [type, status, page]);

  const exportCsv = () => {
    if (!data.data) return;
    const blob = new Blob([toCsv(data.data.items)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bolt-transactions-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PortalShell
      title={L({ en: 'Transactions', ar: 'المعاملات' })}
      actions={
        <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!data.data?.items.length}>
          <LuDownload className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">CSV</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid max-w-xl grid-cols-2 gap-3">
          <SelectField label={L({ en: 'Type', ar: 'النوع' })} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">{L({ en: 'All types', ar: 'كل الأنواع' })}</option>
            {Object.entries(txTypeLabel).map(([k, v]) => (
              <option key={k} value={k}>{L(v)}</option>
            ))}
          </SelectField>
          <SelectField label={L({ en: 'Status', ar: 'الحالة' })} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{L({ en: 'All statuses', ar: 'كل الحالات' })}</option>
            {Object.entries(txStatusLabel).map(([k, v]) => (
              <option key={k} value={k}>{L(v.label)}</option>
            ))}
          </SelectField>
        </div>
        {data.loading ? (
          <Spinner label={t.common.loading} />
        ) : data.error ? (
          <ErrorNote message={data.error} onRetry={data.reload} />
        ) : !data.data?.items.length ? (
          <EmptyState icon={<LuHistory />} title={L({ en: 'No transactions found', ar: 'لا توجد معاملات' })} />
        ) : (
          <div className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-subtle">
                    <th className="px-5 py-3 text-start font-medium">#</th>
                    <th className="px-3 py-3 text-start font-medium">{L({ en: 'Date', ar: 'التاريخ' })}</th>
                    <th className="px-3 py-3 text-start font-medium">{L({ en: 'Type', ar: 'النوع' })}</th>
                    <th className="px-3 py-3 text-start font-medium">{L({ en: 'Method', ar: 'الوسيلة' })}</th>
                    <th className="px-3 py-3 text-start font-medium">{L({ en: 'Account', ar: 'الحساب' })}</th>
                    <th className="px-3 py-3 text-end font-medium">{L({ en: 'Amount', ar: 'المبلغ' })}</th>
                    <th className="px-5 py-3 text-end font-medium">{L({ en: 'Status', ar: 'الحالة' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.items.map((tx) => (
                    <tr key={tx.id} className="border-b border-line/60 last:border-0">
                      <td className="num px-5 py-3 text-fg-subtle">{tx.id}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(tx.created_at, lang)}</td>
                      <td className="px-3 py-3">{L(txTypeLabel[tx.type])}</td>
                      <td className="px-3 py-3 text-fg-muted">{L(methodLabel[tx.method] ?? { en: tx.method, ar: tx.method })}</td>
                      <td className="num px-3 py-3" dir="ltr">{tx.account_login ?? '—'}</td>
                      <td className="num px-3 py-3 text-end font-semibold">{money(tx.amount, tx.currency)}</td>
                      <td className="px-5 py-3 text-end">
                        <StatusBadge s={txStatusLabel[tx.status]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 pb-4">
              <Pager page={page} pageSize={PAGE} total={data.data.total} onPage={setPage} />
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}

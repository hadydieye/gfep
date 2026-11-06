import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  FileClock,
  FileText,
  IdCard,
  LineChart,
  Receipt,
  ReceiptText,
  ShieldCheck,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AccountStatusBadge } from '@/components/access/access-labels';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { HeadcountChart } from '@/components/dashboard/headcount-chart';
import { ServiceStatusCard } from '@/components/dashboard/service-status-card';
import { InvoiceStatusBadge, TRANSACTION_TYPE_LABEL, TransactionStatusBadge } from '@/components/finance/finance-badges';
import { MoneyAmount } from '@/components/finance/money-amount';
import { ErrorState } from '@/components/states/states';
import { apiGet } from '@/lib/api/server';
import type { AuthUser, DashboardData } from '@/lib/api/types';
import { getSession } from '@/lib/auth/session';

const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3';

export default async function DashboardPage() {
  const [user, result] = await Promise.all([getSession(), apiGet<DashboardData>('/dashboard')]);
  if (!user || (!result.ok && result.status === 401)) {
    redirect('/login');
  }
  if (!result.ok) {
    return <ErrorState message="Impossible de charger le tableau de bord. Réessayer." />;
  }

  const firstName = user.employee?.firstName ?? user.username;
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground-primary">Bonjour, {firstName}</h1>
      <div className={GRID}>
        {result.data.role === 'SUPER_ADMIN' && <AdminCards data={result.data} />}
        {result.data.role === 'IT_ADMINISTRATOR' && <ItAdminCards data={result.data} />}
        {result.data.role === 'IT_TECHNICIAN' && result.data.services && <ServiceStatusCard services={result.data.services} />}
        {result.data.role === 'HR_MANAGER' && <HrCards data={result.data} />}
        {result.data.role === 'AUDITOR' && <MyInfoCard user={user} />}
        {result.data.role === 'ACCOUNTANT' && <AccountantCards data={result.data} />}
        {result.data.role === 'DEPARTMENT_MANAGER' && <ManagerCards data={result.data} />}
        {result.data.role === 'EMPLOYEE' && <EmployeeCards user={user} data={result.data} />}
      </div>
    </div>
  );
}

// Vue consolidée (design §6.2) : effectif, état des services, comptes récents
function AdminCards({ data }: { data: DashboardData }) {
  return (
    <>
      <DashboardCard
        label="Effectif global"
        icon={Users}
        value={data.indicators.totalEmployees ?? 0}
        subtitle="Employés actifs"
      />
      {data.services && <ServiceStatusCard services={data.services} />}
      {data.recentAccounts && <RecentAccountsCard accounts={data.recentAccounts} />}
      <DashboardCard label="Accès rapides" icon={Zap}>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <Link href="/employees" className="inline-flex items-center gap-2 text-link hover:underline">
              <Users className="h-4 w-4" aria-hidden /> Employés
            </Link>
          </li>
          <li>
            <Link href="/departments" className="inline-flex items-center gap-2 text-link hover:underline">
              <Building2 className="h-4 w-4" aria-hidden /> Départements
            </Link>
          </li>
          <li>
            <Link href="/access/users" className="inline-flex items-center gap-2 text-link hover:underline">
              <ShieldCheck className="h-4 w-4" aria-hidden /> Comptes et rôles
            </Link>
          </li>
        </ul>
      </DashboardCard>
    </>
  );
}

function ItAdminCards({ data }: { data: DashboardData }) {
  return (
    <>
      {data.recentAccounts && <RecentAccountsCard accounts={data.recentAccounts} />}
      {data.services && <ServiceStatusCard services={data.services} />}
    </>
  );
}

const DATE_SHORT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });

function RecentAccountsCard({ accounts }: { accounts: NonNullable<DashboardData['recentAccounts']> }) {
  const sections = [
    { title: 'Récemment créés', items: accounts.created, empty: 'Aucun compte créé récemment.' },
    { title: 'Récemment suspendus', items: accounts.suspended, empty: 'Aucun compte suspendu.' },
  ];
  return (
    <DashboardCard label="Comptes récents" icon={UserPlus}>
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-secondary">{section.title}</h3>
          {section.items.length === 0 ? (
            <p className="text-sm text-foreground-secondary">{section.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {section.items.map((account) => (
                <li key={account.id} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground-primary">{account.displayName ?? account.username}</span>
                    <span className="text-xs text-foreground-secondary">{account.username} · {DATE_SHORT.format(new Date(account.date))}</span>
                  </span>
                  <AccountStatusBadge status={account.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <Link href="/access/users" className="mt-1 text-sm font-medium text-link hover:underline">
        Gérer les comptes
      </Link>
    </DashboardCard>
  );
}

function HrCards({ data }: { data: DashboardData }) {
  const hires = data.recentHires ?? [];
  return (
    <>
      <DashboardCard label="Effectif global" icon={Users} value={data.indicators.totalEmployees ?? 0} subtitle="Employés actifs" />
      <DashboardCard label="Répartition par département" icon={Building2} className="md:col-span-2">
        <HeadcountChart data={data.headcountByDepartment ?? []} />
      </DashboardCard>
      <DashboardCard label="Dernières embauches" icon={UserPlus}>
        {hires.length === 0 ? (
          <p className="text-sm text-foreground-secondary">Aucune embauche enregistrée.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {hires.map((hire) => (
              <li key={hire.id} className="flex items-baseline justify-between gap-3">
                <Link href={`/employees/${hire.id}`} className="min-w-0 truncate font-medium text-link hover:underline">
                  {hire.firstName} {hire.lastName}
                </Link>
                <span className="shrink-0 text-xs text-foreground-secondary">
                  {hire.department} · {DATE_SHORT.format(new Date(hire.hireDate))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </>
  );
}

function ManagerCards({ data }: { data: DashboardData }) {
  return (
    <>
      <DashboardCard
        label="Effectif de mon équipe"
        icon={Users}
        value={data.indicators.departmentEmployees ?? 0}
        subtitle="Employés actifs du département"
      />
      <DashboardCard
        label="Département"
        icon={LineChart}
        value={<span className="text-xl">{data.indicators.departmentName ?? '—'}</span>}
        subtitle="Votre périmètre de gestion"
      />
      <DocumentListCard
        label="Documents en attente de validation"
        icon={FileClock}
        documents={data.pendingDocuments ?? []}
        emptyMessage="Aucun document en attente de validation."
      />
    </>
  );
}

// Mois des indicateurs (AAAA-MM, UTC) en toutes lettres : « novembre 2026 »
function monthLabel(month: string | undefined): string {
  if (!month) return 'Mois en cours';
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00.000Z`),
  );
}

function AccountantCards({ data }: { data: DashboardData }) {
  const month = monthLabel(data.indicators.month);
  const transactions = data.recentTransactions ?? [];
  const invoices = data.pendingInvoices ?? [];
  const pendingTotal = data.indicators.pendingInvoicesTotal ?? invoices.length;
  return (
    <>
      <DashboardCard
        label="Recettes validées"
        icon={ArrowUpRight}
        value={<MoneyAmount amount={data.indicators.monthIncome ?? '0.00'} className="text-2xl" />}
        subtitle={month}
      />
      <DashboardCard
        label="Dépenses validées"
        icon={ArrowDownRight}
        value={<MoneyAmount amount={data.indicators.monthExpense ?? '0.00'} className="text-2xl" />}
        subtitle={month}
      />
      <DashboardCard label="Transactions récentes" icon={Receipt}>
        {transactions.length === 0 ? (
          <p className="text-sm text-foreground-secondary">Aucune transaction enregistrée.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium tabular-nums text-foreground-primary">{transaction.reference}</span>
                  <span className="text-xs text-foreground-secondary">{TRANSACTION_TYPE_LABEL[transaction.transactionType]}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <MoneyAmount amount={transaction.amount} currency={transaction.currency} className="text-foreground-primary" />
                  <TransactionStatusBadge status={transaction.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/finance/transactions" className="mt-1 text-sm font-medium text-link hover:underline">
          Voir les transactions
        </Link>
      </DashboardCard>
      <DashboardCard label="Factures en attente" icon={ReceiptText} value={pendingTotal} subtitle="Envoyées ou en retard">
        {invoices.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-3">
                <Link href={`/finance/invoices/${invoice.id}`} className="min-w-0 truncate font-medium text-link hover:underline">
                  {invoice.invoiceNumber} · {invoice.clientName}
                </Link>
                <InvoiceStatusBadge status={invoice.status} />
              </li>
            ))}
          </ul>
        )}
        <Link href="/finance/invoices" className="mt-1 text-sm font-medium text-link hover:underline">
          Voir les factures
        </Link>
      </DashboardCard>
    </>
  );
}

function EmployeeCards({ user, data }: { user: AuthUser; data: DashboardData }) {
  return (
    <>
      <MyInfoCard user={user} />
      <DocumentListCard
        label="Mes documents récents"
        icon={FileText}
        documents={data.recentDocuments ?? []}
        emptyMessage="Aucun document récent."
      />
    </>
  );
}

// « Mes informations » : EMPLOYEE, et AUDITOR jusqu'à l'étape 2.6 (design §6.2)
function MyInfoCard({ user }: { user: AuthUser }) {
  return (
    <>
      <DashboardCard label="Mes informations" icon={IdCard}>
        <dl className="flex flex-col gap-1 text-sm">
          {user.employee && (
            <div>
              <dt className="sr-only">Nom</dt>
              <dd className="font-medium text-foreground-primary">
                {user.employee.firstName} {user.employee.lastName}
              </dd>
            </div>
          )}
          <div>
            <dt className="sr-only">Email</dt>
            <dd className="text-foreground-secondary">{user.email}</dd>
          </div>
        </dl>
        {user.employee && (
          <Link
            href={`/employees/${user.employee.id}`}
            className="mt-1 text-sm font-medium text-link hover:underline"
          >
            Voir ma fiche
          </Link>
        )}
      </DashboardCard>
    </>
  );
}

function DocumentListCard({
  label,
  icon,
  documents,
  emptyMessage,
}: {
  label: string;
  icon: LucideIcon;
  documents: Array<{ id: string; title: string; createdAt: string }>;
  emptyMessage: string;
}) {
  return (
    <DashboardCard label={label} icon={icon}>
      {documents.length === 0 ? (
        <p className="text-sm text-foreground-secondary">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {documents.map((document) => (
            <li key={document.id} className="flex items-baseline justify-between gap-3">
              <Link
                href={`/documents/${document.id}`}
                className="min-w-0 truncate font-medium text-link hover:underline"
              >
                {document.title}
              </Link>
              <time className="shrink-0 text-xs text-foreground-secondary" dateTime={document.createdAt}>
                {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                  new Date(document.createdAt),
                )}
              </time>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

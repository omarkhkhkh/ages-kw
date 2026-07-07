import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';

import { AuthProvider, useAuth } from '@/contexts/auth';
import { Layout } from '@/components/layout';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import TendersList from '@/pages/tenders-list';
import TenderNew from '@/pages/tender-new';
import TenderDetail from '@/pages/tender-detail';
import EntitiesList from '@/pages/entities-list';
import SuppliersList from '@/pages/suppliers-list';
import RfqList from '@/pages/rfq-list';
import PurchaseOrdersList from '@/pages/purchase-orders-list';
import ProjectsList from '@/pages/projects-list';
import GuaranteesList from '@/pages/guarantees-list';
import ContractsList from '@/pages/contracts-list';
import Guide from '@/pages/guide';
import AdminUsers from '@/pages/admin-users';
import CalendarPage from '@/pages/calendar';
import ActivityLog from '@/pages/activity-log';
import TransportationList from '@/pages/transportation-list';
import FinancesList from '@/pages/finances-list';
import TasksList from '@/pages/tasks-list';
import PracticesList from '@/pages/practices-list';
import CompanyDocuments from '@/pages/company-documents';
import GovernmentRegistrations from '@/pages/government-registrations';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error: any) => {
        if (error?.message?.includes('401') || error?.message?.includes('403')) return false;
        return failureCount < 2;
      },
    },
  },
});

function ModuleGuard({ access, children }: { access: boolean; children: React.ReactNode }) {
  if (!access) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <div className="text-4xl">🔒</div>
        <p className="font-medium">ليس لديك صلاحية الوصول إلى هذه الوحدة</p>
        <p className="text-sm">تواصل مع المدير لتفعيل الصلاحية</p>
      </div>
    );
  }
  return <>{children}</>;
}

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full" />
          <p className="text-muted-foreground text-sm">جاري التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const isAdmin = user.role === "admin";

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/tenders">
          <ModuleGuard access={isAdmin || user.accessTenders}><TendersList /></ModuleGuard>
        </Route>
        <Route path="/tenders/new">
          <ModuleGuard access={isAdmin || user.accessTenders}><TenderNew /></ModuleGuard>
        </Route>
        <Route path="/tenders/:id">
          <ModuleGuard access={isAdmin || user.accessTenders}><TenderDetail /></ModuleGuard>
        </Route>
        <Route path="/entities">
          <ModuleGuard access={isAdmin || user.accessEntities}><EntitiesList /></ModuleGuard>
        </Route>
        <Route path="/suppliers">
          <ModuleGuard access={isAdmin || user.accessSuppliers}><SuppliersList /></ModuleGuard>
        </Route>
        <Route path="/rfq">
          <ModuleGuard access={isAdmin || user.accessRfq}><RfqList /></ModuleGuard>
        </Route>
        <Route path="/purchase-orders">
          <ModuleGuard access={isAdmin || user.accessPo}><PurchaseOrdersList /></ModuleGuard>
        </Route>
        <Route path="/projects">
          <ModuleGuard access={isAdmin || user.accessProjects}><ProjectsList /></ModuleGuard>
        </Route>
        <Route path="/guarantees">
          <ModuleGuard access={isAdmin || user.accessGuarantees}><GuaranteesList /></ModuleGuard>
        </Route>
        <Route path="/contracts">
          <ModuleGuard access={isAdmin || user.accessContracts}><ContractsList /></ModuleGuard>
        </Route>
        <Route path="/transportation">
          <ModuleGuard access={isAdmin || user.accessTransportation}><TransportationList /></ModuleGuard>
        </Route>
        <Route path="/finance">
          <ModuleGuard access={isAdmin}><FinancesList /></ModuleGuard>
        </Route>
        <Route path="/practices">
          <ModuleGuard access={isAdmin || user.accessTenders}><PracticesList /></ModuleGuard>
        </Route>
        <Route path="/company-docs">
          <ModuleGuard access={isAdmin || user.accessTenders}><CompanyDocuments /></ModuleGuard>
        </Route>
        <Route path="/gov-registrations">
          <ModuleGuard access={isAdmin || user.accessTenders}><GovernmentRegistrations /></ModuleGuard>
        </Route>
        <Route path="/tasks" component={TasksList} />
        <Route path="/guide" component={Guide} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/activity-log" component={ActivityLog} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;

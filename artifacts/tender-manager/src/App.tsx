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
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error: any) => {
        // Don't retry 401/403 errors
        if (error?.message?.includes('401') || error?.message?.includes('403')) return false;
        return failureCount < 2;
      },
    },
  },
});

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

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/tenders" component={TendersList} />
        <Route path="/tenders/new" component={TenderNew} />
        <Route path="/tenders/:id" component={TenderDetail} />
        <Route path="/entities" component={EntitiesList} />
        <Route path="/suppliers" component={SuppliersList} />
        <Route path="/rfq" component={RfqList} />
        <Route path="/purchase-orders" component={PurchaseOrdersList} />
        <Route path="/projects" component={ProjectsList} />
        <Route path="/guarantees" component={GuaranteesList} />
        <Route path="/contracts" component={ContractsList} />
        <Route path="/guide" component={Guide} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/calendar" component={CalendarPage} />
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

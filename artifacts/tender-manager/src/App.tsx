import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';

import { Layout } from '@/components/layout';
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
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function AppRouter() {
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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppRouter />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;

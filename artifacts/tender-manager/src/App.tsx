import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';

import { Layout } from '@/components/layout';
import Dashboard from '@/pages/dashboard';
import TendersList from '@/pages/tenders-list';
import TenderNew from '@/pages/tender-new';
import TenderDetail from '@/pages/tender-detail';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
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

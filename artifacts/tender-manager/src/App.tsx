import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';

import { AuthProvider, useAuth } from '@/contexts/auth';
import { I18nProvider } from '@/contexts/i18n';
import { Layout } from '@/components/layout';
import Landing from '@/pages/landing';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import TendersList from '@/pages/tenders-list';
import TenderNew from '@/pages/tender-new';
import TenderDetail from '@/pages/tender-detail';
import EntitiesList from '@/pages/entities-list';
import EntityDetail from '@/pages/entity-detail';
import DepartmentDetail from '@/pages/department-detail';
import AdminServiceTypes from '@/pages/admin-service-types';
import SuppliersList from '@/pages/suppliers-list';
import RfqList from '@/pages/rfq-list';
import PurchaseOrdersList from '@/pages/purchase-orders-list';
import PurchaseOrderDetail from '@/pages/purchase-order-detail';
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
import AdminTaskTypes from '@/pages/admin-task-types';
import PracticesList from '@/pages/practices-list';
import CompanyDocuments from '@/pages/company-documents';
import GovernmentRegistrations from '@/pages/government-registrations';
import CompetitorIntelligence from '@/pages/competitor-intelligence/index';
import CompetitorDetail from '@/pages/competitor-intelligence/competitor-detail';
import PredictPage from '@/pages/competitor-intelligence/predict';
import CorrespondenceList from '@/pages/correspondence-list';
import ResidencyCompanies from '@/pages/residency-companies';
import ResidencyCompanyDashboard from '@/pages/residency-company-dashboard';
import ResidencyWorkerDetail from '@/pages/residency-worker-detail';
import MaintenanceIndex from '@/pages/maintenance/index';
import EquipmentDetail from '@/pages/maintenance/equipment-detail';
import WorkOrderDetail from '@/pages/maintenance/work-order-detail';
import MaintenanceReportTemplates from '@/pages/maintenance/report-templates';
import ResearchIndex from '@/pages/research/index';
import PricingList from '@/pages/pricing/index';
import PricingSheetDetail from '@/pages/pricing/sheet-detail';
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

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        {/* بعد تسجيل الدخول، /login تعيد التوجيه للوحة التحكم بدل صفحة 404 */}
        <Route path="/login"><Redirect to="/" /></Route>
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
        <Route path="/entities/:id/departments/:deptId">
          <ModuleGuard access={isAdmin || user.accessEntities}><DepartmentDetail /></ModuleGuard>
        </Route>
        <Route path="/entities/:id">
          <ModuleGuard access={isAdmin || user.accessEntities}><EntityDetail /></ModuleGuard>
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
        <Route path="/purchase-orders/:id">
          <ModuleGuard access={isAdmin || user.accessPo}><PurchaseOrderDetail /></ModuleGuard>
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
        <Route path="/tasks">
          <ModuleGuard access={isAdmin || user.accessTasks}><TasksList /></ModuleGuard>
        </Route>
        <Route path="/competitor-intelligence/c/:id">
          <ModuleGuard access={isAdmin || user.accessTenders}><CompetitorDetail /></ModuleGuard>
        </Route>
        <Route path="/competitor-intelligence/predict">
          <ModuleGuard access={isAdmin || user.accessTenders}><PredictPage /></ModuleGuard>
        </Route>
        <Route path="/competitor-intelligence">
          <ModuleGuard access={isAdmin || user.accessTenders}><CompetitorIntelligence /></ModuleGuard>
        </Route>
        <Route path="/correspondence">
          <ModuleGuard access={isAdmin || user.accessCorrespondence}><CorrespondenceList /></ModuleGuard>
        </Route>
        <Route path="/residency">
          <ModuleGuard access={isAdmin || user.accessResidency}><ResidencyCompanies /></ModuleGuard>
        </Route>
        <Route path="/residency/:companyId">
          <ModuleGuard access={isAdmin || user.accessResidency}><ResidencyCompanyDashboard /></ModuleGuard>
        </Route>
        <Route path="/residency/:companyId/workers/:workerId">
          <ModuleGuard access={isAdmin || user.accessResidency}><ResidencyWorkerDetail /></ModuleGuard>
        </Route>
        <Route path="/maintenance">
          <ModuleGuard access={isAdmin || user.accessMaintenance}><MaintenanceIndex /></ModuleGuard>
        </Route>
        <Route path="/maintenance/report-templates">
          <ModuleGuard access={isAdmin}><MaintenanceReportTemplates /></ModuleGuard>
        </Route>
        <Route path="/maintenance/equipment/:id">
          <ModuleGuard access={isAdmin || user.accessMaintenance}><EquipmentDetail /></ModuleGuard>
        </Route>
        <Route path="/maintenance/work-orders/:id">
          <ModuleGuard access={isAdmin || user.accessMaintenance}><WorkOrderDetail /></ModuleGuard>
        </Route>
        <Route path="/research">
          <ModuleGuard access={isAdmin || user.accessResearch}><ResearchIndex /></ModuleGuard>
        </Route>
        <Route path="/pricing">
          <ModuleGuard access={isAdmin || user.accessPricing}><PricingList /></ModuleGuard>
        </Route>
        <Route path="/pricing/:id">
          <ModuleGuard access={isAdmin || user.accessPricing}><PricingSheetDetail /></ModuleGuard>
        </Route>
        <Route path="/guide" component={Guide} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/activity-log" component={ActivityLog} />
        <Route path="/admin/service-types" component={AdminServiceTypes} />
        <Route path="/admin/task-types" component={AdminTaskTypes} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;

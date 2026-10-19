import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Dashboard',
    loadComponent: () => import('./pages/dashboard.page').then((m) => m.DashboardPage),
  },
  { path: 'gold-loans', title: 'Gold loans', loadComponent: () => import('./pages/gold-loans/gold-loans.page').then((m) => m.GoldLoansPage) },
  { path: 'gold-loans/new', title: 'Add gold loan', loadComponent: () => import('./pages/gold-loans/loan-form.page').then((m) => m.LoanFormPage) },
  { path: 'gold-loans/:id/edit', title: 'Edit gold loan', loadComponent: () => import('./pages/gold-loans/loan-form.page').then((m) => m.LoanFormPage) },
  { path: 'gold-loans/:id', title: 'Gold loan', loadComponent: () => import('./pages/gold-loans/loan-detail.page').then((m) => m.LoanDetailPage) },
  { path: 'renewals', title: 'Renewals', loadComponent: () => import('./pages/renewals/renewals.page').then((m) => m.RenewalsPage) },
  { path: 'renewals/:id/record', title: 'Record renewal', loadComponent: () => import('./pages/renewals/record-renewal.page').then((m) => m.RecordRenewalPage) },
  { path: 'family', title: 'Family', loadComponent: () => import('./pages/family/family.page').then((m) => m.FamilyPage) },
  { path: 'car-loan', title: 'Car loan', loadComponent: () => import('./pages/car-loan/car-loan.page').then((m) => m.CarLoanPage) },
  { path: 'assets-liabilities', title: 'Assets and liabilities', loadComponent: () => import('./pages/money/assets-liabilities.page').then((m) => m.AssetsLiabilitiesPage) },
  { path: 'planner', title: 'Planner', loadComponent: () => import('./pages/money/planner.page').then((m) => m.PlannerPage) },
  {
    path: 'settings',
    title: 'Settings',
    loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'design',
    title: 'Design system',
    loadComponent: () => import('./pages/design-system.page').then((m) => m.DesignSystemPage),
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./pages/not-found.page').then((m) => m.NotFoundPage),
  },
];

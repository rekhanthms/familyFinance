export interface NavItem {
  path: string;
  label: string;
  /** Shorter text for the phone's bottom bar. */
  mobileLabel: string;
  /** Primary items get a slot on the phone's bottom bar; the rest live under "More". */
  primary: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: 'dashboard', label: 'Dashboard', mobileLabel: 'Home', primary: true },
  { path: 'gold-loans', label: 'Gold loans', mobileLabel: 'Loans', primary: true },
  { path: 'renewals', label: 'Renewals', mobileLabel: 'Renewals', primary: true },
  { path: 'family', label: 'Family', mobileLabel: 'Family', primary: true },
  { path: 'car-loan', label: 'Car loan', mobileLabel: 'Car loan', primary: false },
  { path: 'assets-liabilities', label: 'Assets and liabilities', mobileLabel: 'Assets', primary: false },
  { path: 'planner', label: 'Planner', mobileLabel: 'Planner', primary: false },
  { path: 'settings', label: 'Settings', mobileLabel: 'Settings', primary: false },
];

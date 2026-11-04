export type Role = 'Parent' | 'Child';

export interface UserProfile {
  id: string;
  role: Role;
  email: string;
  name: string;
  pairingCode?: string;
  baseBalance?: number;
  currency?: string;
  createdAt: string;
}

export interface Family {
  id: string;
  parentId: string;
  childIds: string[];
}

export interface Transaction {
  id: string;
  childId: string;
  expenseName: string;
  amount: number;
  category: string;
  notes?: string;
  receiptUrl?: string;
  date: string;
}

export interface Category {
  id: string;
  childId?: string; // Optional for default categories
  name: string;
  icon?: string;
  isDefault: boolean;
}

export type BalanceHistoryType = 'IN' | 'OUT';

export interface BalanceHistory {
  id: string;
  childId: string;
  amount: number;
  description: string;
  type: BalanceHistoryType;
  date: string;
}

export interface SavingsGoal {
  id: string;
  childId: string;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: string;
}

export interface BudgetSettings {
  id: string;
  childId: string;
  parentId: string;
  dailyLimit: number;
  monthlyLimit: number;
  weeklyLimit?: number;
  limitType?: 'daily' | 'weekly' | 'monthly';
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

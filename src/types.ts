export type UserRole = 'customer' | 'barber' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  bio?: string;
  specialties?: string[];
  createdAt?: any;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  category: string;
  description?: string;
}

export interface WorkingHourConfig {
  start: string;
  end: string;
  enabled: boolean;
}

export interface BarberProfile {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  rating?: number;
  reviewCount?: number;
  available: boolean;
  workingHours?: {
    [key: string]: WorkingHourConfig;
  };
  specialties?: string[];
}

export interface Queue {
  id: string;
  barberId: string;
  shopId: string;
  active: boolean;
  createdAt: any;
}

export interface QueueEntry {
  id: string;
  customerId: string;
  customerName: string;
  status: 'waiting' | 'in-progress' | 'completed';
  joinedAt: any;
  completedAt?: any;
  position: number;
}

export interface Booking {
  id: string;
  barberId: string;
  customerId: string;
  serviceName: string;
  price: number;
  status: 'upcoming' | 'completed' | 'cancelled' | 'confirmed';
  appointmentDate?: string;
  createdAt: any;
  serviceType?: 'home' | 'shop';
  address?: string;
  cancelledAt?: string;
}

export interface Review {
  id?: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment?: string;
  createdAt: any;
}

export interface AnalyticsData {
  _id: string; // Date or Category name
  total?: number;
  count: number;
}

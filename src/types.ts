import { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'barber';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  phoneNumber?: string;
  createdAt: Timestamp;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  category: string;
}

export interface WorkingHour {
  start: string;
  end: string;
  enabled: boolean;
}

export interface BarberProfile {
  id: string;
  userId: string;
  bio: string;
  specialties: string[];
  available: boolean;
  rating: number;
  reviewCount: number;
  displayName?: string;
  photoURL?: string;
  workingHours?: {
    [key: string]: WorkingHour;
  };
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  customerId: string;
  barberId: string;
  serviceId: string;
  startTime: Timestamp;
  endTime: Timestamp;
  status: BookingStatus;
  totalPrice: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  
  // Denormalized for easier display in lists
  serviceName?: string;
  barberName?: string;
  customerName?: string;
}

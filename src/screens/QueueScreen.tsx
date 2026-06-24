import React, { useEffect, useState } from 'react';
import { 
  collection, 
  addDoc, 
  getDoc,
  getDocs,
  doc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BarberProfile } from '../types';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui';
import { Clock } from 'lucide-react';
import { cn } from '../lib/utils';

export const QueueScreen = ({ barberId, onActionComplete }: { barberId: string | null, onActionComplete?: () => void }) => {
  const [barbersList, setBarbersList] = useState<BarberProfile[]>([]);
  const [activeBarberId, setActiveBarberId] = useState<string | null>(barberId);
  const [barber, setBarber] = useState<BarberProfile | null>(null);
  const [loadingBarber, setLoadingBarber] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingDate, setBookingDate] = useState<string>('');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const { user, profile } = useAuth();

  useEffect(() => {
    // Fetch all barbers to populate the dropdown
    getDocs(collection(db, 'barbers')).then(snap => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BarberProfile[];
      setBarbersList(list);
      if (!activeBarberId && list.length > 0) {
        setActiveBarberId(list[0].id);
      }
    }).catch(err => {
      console.error("Failed to load barbers:", err);
    });
  }, []);

  useEffect(() => {
    if (activeBarberId) {
      setLoadingBarber(true);
      getDoc(doc(db, 'barbers', activeBarberId)).then(snap => {
        if (snap.exists()) {
          setBarber({ id: snap.id, ...snap.data() } as BarberProfile);
        }
      }).catch(err => {
        handleFirestoreError(err, OperationType.GET, `barbers/${activeBarberId}`);
      }).finally(() => {
        setLoadingBarber(false);
      });
    } else {
      setBarber(null);
    }
  }, [activeBarberId]);

  useEffect(() => {
    if (!barber) {
      setAvailabilityMessage('Please select a specialist.');
      setIsAvailable(false);
      return;
    }
    if (!bookingDate) {
      setAvailabilityMessage('Please choose date and time parameters.');
      setIsAvailable(false);
      return;
    }

    try {
      // bookingDate is in "YYYY-MM-DDTHH:MM" format (datetime-local)
      const parts = bookingDate.split('T');
      if (parts.length < 2) {
        setAvailabilityMessage('Please select a valid date and time.');
        setIsAvailable(false);
        return;
      }
      const dateStr = parts[0]; // "YYYY-MM-DD"
      const timeStr = parts[1]; // "HH:MM"

      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) {
        setAvailabilityMessage('Invalid target date coordinates.');
        setIsAvailable(false);
        return;
      }
      const dayOfWeek = days[dateObj.getDay()];
      const hoursConfig = barber.workingHours?.[dayOfWeek];
      
      if (!hoursConfig || !hoursConfig.enabled) {
        setAvailabilityMessage(`Specialist is offline on ${dayOfWeek.toUpperCase()}.`);
        setIsAvailable(false);
        return;
      }

      const timeVal = timeStr; // "HH:MM"
      const startVal = hoursConfig.start;
      const endVal = hoursConfig.end;

      if (timeVal >= startVal && timeVal <= endVal) {
        setAvailabilityMessage(`Slot verified! Specialist active on ${dayOfWeek.toUpperCase()} (${startVal} - ${endVal}).`);
        setIsAvailable(true);
      } else {
        setAvailabilityMessage(`Coordinate mismatch! Active hours are ${startVal} - ${endVal}.`);
        setIsAvailable(false);
      }
    } catch (e) {
      console.error(e);
      setAvailabilityMessage('Validation process interrupted.');
      setIsAvailable(false);
    }
  }, [bookingDate, barber]);

  const handleBooking = async () => {
    if (!user || !profile || !activeBarberId || !bookingDate) {
      alert('Validation error. Missing user session or specialist selection.');
      return;
    }
    if (!isAvailable) {
      alert(`Validation error: ${availabilityMessage}`);
      return;
    }

    setSubmitting(true);
    const path = 'bookings';
    try {
      const parts = bookingDate.split('T');
      const formattedApptDate = parts.length === 2 ? `${parts[0]} ${parts[1]}` : bookingDate;

      const docRef = await addDoc(collection(db, 'bookings'), {
        barberId: activeBarberId,
        customerId: user.uid,
        customerName: profile.displayName,
        serviceName: 'Scheduled Grooming',
        price: 450,
        status: 'pending',
        appointmentDate: formattedApptDate,
        createdAt: new Date().toISOString(),
        serviceType: 'shop'
      });

      // Create a notification for the barber
      await addDoc(collection(db, 'notifications'), {
        userId: activeBarberId,
        type: 'appointment_request',
        title: 'New Appointment Request',
        message: `${profile.displayName} requested Scheduled Grooming on ${parts[0]} at ${parts[1]}.`,
        createdAt: new Date().toISOString(),
        read: false,
        bookingId: docRef.id
      });

      alert("Appointment transmission successful! Pending specialist authorization.");
      setBookingDate('');
      if (onActionComplete) onActionComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-stone-50 min-h-screen pb-32">
      <div className="flex flex-col gap-1 mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-tight">
          Strategic Planning
        </h2>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest italic">
          Configure temporal coordinates for grooming extraction
        </p>
      </div>

      <div className="space-y-6">
        {/* Barber Picker */}
        <div className="space-y-2 bg-white border border-stone-200 p-6 shadow-sm">
          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.3em]">Select Specialist</label>
          <select 
            value={activeBarberId || ''} 
            onChange={(e) => setActiveBarberId(e.target.value || null)}
            className="w-full h-12 border border-stone-200 px-4 text-xs font-bold uppercase tracking-widest focus:border-zinc-900 outline-none transition-all bg-white"
          >
            <option value="">-- Choose Specialist --</option>
            {barbersList.map(b => (
              <option key={b.id} value={b.id}>{b.displayName || 'Anonymous Specialist'}</option>
            ))}
          </select>
        </div>

        {/* Temporal coordinates picker */}
        <div className="p-8 bg-white border-[4px] border-stone-200 flex flex-col items-center shadow-sm">
          <Clock className="text-stone-300 mb-4" size={24} />
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4">Select Deployment Window</h3>
          <p className="text-[9px] text-stone-400 uppercase tracking-widest mb-6 text-center">Define target date and time parameters below.</p>
          
          <div className="w-full space-y-4">
            <input 
              type="datetime-local" 
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-full h-12 border-2 border-stone-100 px-4 text-[10px] font-bold uppercase tracking-widest focus:border-zinc-900 outline-none transition-all"
            />

            {bookingDate && (
              <div className={cn(
                "p-4 border-[2px] flex items-center justify-between text-[10px] font-bold uppercase tracking-wide w-full transition-all duration-300",
                isAvailable 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                  : 'bg-rose-50 border-rose-500 text-rose-700'
              )}>
                <span>{availabilityMessage}</span>
              </div>
            )}

            <Button 
              onClick={handleBooking}
              disabled={submitting || !isAvailable || !bookingDate}
              variant="primary"
              className="w-full h-14 bg-zinc-900 text-white hover:bg-black transition-all text-[10px] font-bold"
            >
              {submitting ? 'TRANSMITTING...' : 'SCHEDULE EXTRACTION'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

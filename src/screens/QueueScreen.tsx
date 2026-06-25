import React, { useEffect, useState } from 'react';
import { 
  collection, 
  addDoc, 
  getDoc,
  getDocs,
  doc,
  query,
  where,
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BarberProfile, QueueEntry } from '../types';
import { useAuth } from '../lib/AuthContext';
import { Button, Card, Badge } from '../components/ui';
import { Clock, Users, UserCheck, AlertCircle, Play, LogOut, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export const QueueScreen = ({ barberId, onActionComplete }: { barberId: string | null, onActionComplete?: () => void }) => {
  const [activeTab, setActiveTab] = useState<'live' | 'strategic'>('live');
  const [barbersList, setBarbersList] = useState<BarberProfile[]>([]);
  const [activeBarberId, setActiveBarberId] = useState<string | null>(barberId);
  const [barber, setBarber] = useState<BarberProfile | null>(null);
  const [loadingBarber, setLoadingBarber] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingDate, setBookingDate] = useState<string>('');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  
  // Live queue state
  const [liveQueue, setLiveQueue] = useState<QueueEntry[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  
  const { user, profile } = useAuth();
  const QUEUE_ID = 'main_shop_queue';
  const [queueBarberId, setQueueBarberId] = useState<string | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'queues', QUEUE_ID)).then(snap => {
      if (snap.exists()) {
        setQueueBarberId(snap.data().barberId || null);
      }
    }).catch(err => {
      console.error("Failed to load queue doc:", err);
    });
  }, []);

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

  // Listen to live queue in real-time
  useEffect(() => {
    setLoadingQueue(true);
    const q = query(
      collection(db, 'queues', QUEUE_ID, 'customers'),
      where('status', 'in', ['waiting', 'in-progress'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QueueEntry[];
      
      // Sort client-side by joinedAt asc to ensure deterministic position
      entries.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
      
      // Map positions
      const mapped = entries.map((entry, idx) => ({
        ...entry,
        position: idx + 1
      }));
      
      setLiveQueue(mapped);
      setLoadingQueue(false);
    }, (error) => {
      console.error("Failed to subscribe to live queue:", error);
      handleFirestoreError(error, OperationType.GET, `queues/${QUEUE_ID}/customers`);
      setLoadingQueue(false);
    });

    return () => unsubscribe();
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
      const dateParts = dateStr.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      const dateObj = new Date(year, month, day);
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

  const handleJoinQueue = async () => {
    if (!user || !profile) {
      alert('Authentication required. Please log in.');
      return;
    }

    const targetBarberIdForQueue = activeBarberId || queueBarberId;
    const targetQueueBarber = targetBarberIdForQueue ? barbersList.find(b => b.id === targetBarberIdForQueue || b.userId === targetBarberIdForQueue) : null;
    const isQueueAvailable = targetQueueBarber ? targetQueueBarber.available !== false : true;

    if (!isQueueAvailable) {
      alert('Queue currently unavailable.');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'queues', QUEUE_ID, 'customers'), {
        customerId: user.uid,
        customerName: profile.displayName || user.displayName || 'Anonymous Client',
        status: 'waiting',
        joinedAt: new Date().toISOString(),
        barberId: activeBarberId || '',
        serviceName: 'Walk-In Grooming',
        price: 350
      });
      alert('Successfully deployed into the walk-in sequence!');
    } catch (err: any) {
      console.error("Failed to join queue:", err);
      alert(`Interrupted: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!userQueueEntry) return;
    if (!window.confirm('Are you sure you want to cancel your standby sequence?')) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'queues', QUEUE_ID, 'customers', userQueueEntry.id), {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });
      alert('Standby sequence terminated successfully.');
    } catch (err: any) {
      console.error("Failed to leave queue:", err);
      alert(`Interrupted: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const userQueueEntry = user ? liveQueue.find(e => e.customerId === user.uid) : null;
  const isInQueue = !!userQueueEntry;
  const userPosition = userQueueEntry ? userQueueEntry.position : 0;
  const peopleAhead = userQueueEntry ? userPosition - 1 : liveQueue.length;
  const estimatedWait = peopleAhead * 15;

  const targetBarberIdForQueue = activeBarberId || queueBarberId;
  const targetQueueBarber = targetBarberIdForQueue ? barbersList.find(b => b.id === targetBarberIdForQueue || b.userId === targetBarberIdForQueue) : null;
  const isQueueAvailable = targetQueueBarber ? targetQueueBarber.available !== false : true;

  return (
    <div className="flex-1 p-6 bg-stone-50 min-h-screen pb-32">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-tight">
          Grooming Station
        </h2>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest italic">
          Align walk-in sequence or schedule tactical extractions
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 mb-8">
        <button 
          onClick={() => setActiveTab('live')}
          className={cn(
            "flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] border-b-2 transition-all",
            activeTab === 'live' 
              ? 'border-zinc-900 text-zinc-900 font-extrabold' 
              : 'border-transparent text-stone-400 hover:text-stone-600'
          )}
        >
          Live Sequence
        </button>
        <button 
          onClick={() => setActiveTab('strategic')}
          className={cn(
            "flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] border-b-2 transition-all",
            activeTab === 'strategic' 
              ? 'border-zinc-900 text-zinc-900 font-extrabold' 
              : 'border-transparent text-stone-400 hover:text-stone-600'
          )}
        >
          Strategic Planning
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'live' ? (
        <div className="space-y-6">
          {loadingQueue ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-zinc-400" size={24} />
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Synchronizing sequence telemetry...</p>
            </div>
          ) : isInQueue ? (
            // Active Live Queue Tracking Card
            <div className="space-y-6">
              <div className="bg-zinc-900 text-white border-[4px] border-zinc-900 p-8 text-center space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
                
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-white text-zinc-900 flex items-center justify-center font-black text-2xl border-[3px] border-zinc-900">
                    {userPosition}
                  </div>
                </div>

                <div className="space-y-2">
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none text-[8px] tracking-widest py-1 px-3">
                    {userQueueEntry?.status === 'in-progress' ? 'ENGAGEMENT LIVE' : 'ON STANDBY'}
                  </Badge>
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] pt-1">Your Standby Position</h3>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest">
                    {userQueueEntry?.status === 'in-progress' 
                      ? 'Please proceed to your assigned grooming station immediately.'
                      : 'Maintain position. Your tactical sequence is active.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-6">
                  <div className="text-center space-y-1">
                    <p className="text-[8px] font-bold text-stone-500 uppercase tracking-widest">People Ahead</p>
                    <p className="text-xl font-bold">{peopleAhead}</p>
                  </div>
                  <div className="text-center space-y-1 border-l border-zinc-800">
                    <p className="text-[8px] font-bold text-stone-500 uppercase tracking-widest">Est. Wait Time</p>
                    <p className="text-xl font-bold">{estimatedWait} <span className="text-[10px] font-medium text-stone-400">MINS</span></p>
                  </div>
                </div>

                <Button 
                  onClick={handleLeaveQueue}
                  disabled={submitting}
                  className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white text-[10px] uppercase font-bold tracking-widest border-none mt-2 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={14} />
                  Terminate Sequence
                </Button>
              </div>

              {/* General Queue List for Transparency */}
              <div className="bg-white border border-stone-200 p-6 space-y-4 shadow-sm">
                <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                  <Users size={12} />
                  Live Walk-In Sequence ({liveQueue.length} Active)
                </h4>
                <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto pr-1">
                  {liveQueue.map((item) => (
                    <div key={item.id} className="py-3 flex justify-between items-center text-[10px]">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "w-5 h-5 flex items-center justify-center font-bold border rounded-full text-[8px]",
                          item.customerId === user?.uid 
                            ? 'bg-zinc-900 text-white border-zinc-900 font-extrabold' 
                            : 'bg-stone-50 text-stone-500 border-stone-200'
                        )}>
                          {item.position}
                        </span>
                        <span className={cn(
                          "font-bold uppercase tracking-tight",
                          item.customerId === user?.uid ? 'text-zinc-900 font-black' : 'text-stone-400'
                        )}>
                          {item.customerId === user?.uid ? 'You' : `Standby Client #${item.position}`}
                        </span>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[7px] py-0.5",
                        item.status === 'in-progress' 
                          ? 'border-emerald-200 text-emerald-700 bg-emerald-50 font-bold' 
                          : 'border-stone-200 text-stone-500 bg-stone-50/50'
                      )}>
                        {item.status === 'in-progress' ? 'ENGAGED' : 'STANDBY'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Join Live Queue UI
            <div className="space-y-6">
              <div className="p-8 bg-white border-[4px] border-stone-200 flex flex-col items-center shadow-sm text-center">
                <Users className="text-stone-300 mb-4 animate-pulse" size={32} />
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2">Live Shop Sequence</h3>
                <p className="text-[9px] text-stone-400 uppercase tracking-widest max-w-xs leading-relaxed mb-6">
                  Join the real-time standby queue for immediate in-shop grooming.
                </p>

                <div className="w-full grid grid-cols-2 gap-4 border-y border-stone-100 py-6 mb-6">
                  <div className="text-center space-y-1">
                    <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">Active Queue</p>
                    <p className="text-2xl font-bold text-zinc-900">{liveQueue.length} <span className="text-[10px] text-stone-400">USERS</span></p>
                  </div>
                  <div className="text-center space-y-1 border-l border-stone-100">
                    <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">Estimated Delay</p>
                    <p className="text-2xl font-bold text-zinc-900">{liveQueue.length * 15} <span className="text-[10px] text-stone-400">MINS</span></p>
                  </div>
                </div>

                {/* Optional Specialist selector for the queue join */}
                <div className="w-full space-y-4 text-left mb-6">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em]">Select Preferred Specialist</label>
                    <select 
                      value={activeBarberId || ''} 
                      onChange={(e) => setActiveBarberId(e.target.value || null)}
                      className="w-full h-11 border border-stone-200 px-3 text-[10px] font-bold uppercase tracking-widest focus:border-zinc-900 outline-none bg-white"
                    >
                      <option value="">-- No Preference (First Available) --</option>
                      {barbersList.map(b => (
                        <option key={b.id} value={b.id}>{b.displayName || 'Anonymous Specialist'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isQueueAvailable && (
                  <div className="w-full p-4 mb-4 bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold uppercase tracking-widest text-center animate-in fade-in">
                    Queue currently unavailable.
                  </div>
                )}

                <Button 
                  onClick={handleJoinQueue}
                  disabled={submitting || !isQueueAvailable}
                  className={cn(
                    "w-full h-14 text-[10px] font-bold tracking-widest",
                    isQueueAvailable 
                      ? "bg-zinc-900 hover:bg-black text-white" 
                      : "bg-stone-100 text-stone-400 cursor-not-allowed border-stone-200"
                  )}
                >
                  {submitting ? 'TRANSMITTING...' : isQueueAvailable ? 'JOIN LIVE SEQUENCE' : 'QUEUE UNAVAILABLE'}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Tab Content: Strategic Planning (Appointments)
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
      )}
    </div>
  );
};

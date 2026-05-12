import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  updateDoc,
  setDoc,
  doc, 
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { QueueEntry, BarberProfile } from '../types';
import { useAuth } from '../lib/AuthContext';
import { Button, Card, Badge } from '../components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { User, Clock, Scissors, ChevronLeft, LogOut, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

const QUEUE_ID = 'main_shop_queue'; // Simplified for demo

export const QueueScreen = ({ barberId, onActionComplete }: { barberId: string | null, onActionComplete?: () => void }) => {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [barber, setBarber] = useState<BarberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [bookingDate, setBookingDate] = useState<string>('');
  const { user, profile } = useAuth();

  const handleBooking = async () => {
    if (!user || !profile || !barberId || !bookingDate) return;
    setJoining(true);
    const path = 'bookings';
    try {
      await addDoc(collection(db, 'bookings'), {
        barberId,
        customerId: user.uid,
        customerName: profile.displayName,
        serviceName: 'Scheduled Grooming',
        price: 450,
        status: 'upcoming',
        appointmentDate: bookingDate,
        createdAt: new Date().toISOString()
      });
      alert("Appointment transmission successful. Redirecting to systems...");
      setBookingDate('');
      if (onActionComplete) onActionComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (barberId) {
      getDoc(doc(db, 'barbers', barberId)).then(snap => {
        if (snap.exists()) setBarber(snap.data() as BarberProfile);
      }).catch(err => handleFirestoreError(err, OperationType.GET, `barbers/${barberId}`));
    }

    const q = query(
      collection(db, 'queues', QUEUE_ID, 'customers'),
      where('status', 'in', ['waiting', 'in-progress'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QueueEntry[];
      
      // Sort client-side by joinedAt asc
      entries.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
      
      setQueue(entries.map((item, index) => ({ ...item, position: index + 1 })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `queues/${QUEUE_ID}/customers`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [barberId]);

  const joinQueue = async () => {
    if (!user || !profile) return;
    
    if (queue.some(q => q.customerId === user.uid)) {
      alert("Subject already identified in active sequence.");
      return;
    }

    setJoining(true);
    const path = `queues/${QUEUE_ID}/customers/${user.uid}`;
    try {
      await setDoc(doc(db, 'queues', QUEUE_ID, 'customers', user.uid), {
        customerId: user.uid,
        customerName: profile.displayName,
        status: 'waiting',
        joinedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setJoining(false);
    }
  };

  const leaveQueue = async (entryId: string) => {
    if (!confirm("Are you sure you want to leave the queue? Your position will be lost.")) return;
    const path = `queues/${QUEUE_ID}/customers/${entryId}`;
    try {
      await updateDoc(doc(db, 'queues', QUEUE_ID, 'customers', entryId), {
        status: 'cancelled',
        cancelledReason: 'user-requested',
        completedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const isInQueue = user ? queue.find(q => q.customerId === user.uid) : null;
  const userPosition = isInQueue?.position;
  const currentService = queue.find(q => q.status === 'in-progress');

  return (
    <div className="flex-1 p-6 bg-stone-50 min-h-screen pb-32">
      <div className="flex flex-col gap-1 mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-tight">
          {barber ? `Sector: ${barber.displayName}` : 'Live Terminal Status'}
        </h2>
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest italic">
            {barber ? 'Targeting Station Alpha' : 'Main Deployment Line'}
          </p>
          <Badge className="bg-zinc-900 px-3 border-none h-6">
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">{queue.length} Active Nodes</span>
          </Badge>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {userPosition ? (
          <motion.div 
            key="in-queue"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border-4 border-zinc-900 p-8 flex flex-col items-center mb-8 shadow-[8px_8px_0px_#e5e7eb]"
          >
            <div className="w-full flex justify-between items-start mb-6">
              <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-stone-300">Live Telemetry</span>
              <button 
                onClick={() => leaveQueue(isInQueue!.id)}
                className="text-stone-300 hover:text-red-500 transition-colors"
                title="Leave Queue"
              >
                <LogOut size={14} />
              </button>
            </div>
            
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Internal Priority</p>
            <div className="text-7xl font-bold tracking-tighter text-zinc-900">
              #{userPosition}
            </div>
            
            <div className="w-full grid grid-cols-2 gap-4 mt-8 border-t border-stone-50 pt-6">
              <div className="text-center border-r border-stone-50">
                <p className="text-[8px] font-bold uppercase text-stone-300 mb-1">Wait Est.</p>
                <p className="text-xs font-bold text-zinc-900 uppercase">~{userPosition * 15}m</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold uppercase text-stone-300 mb-1">Status</p>
                <p className="text-xs font-bold text-zinc-900 uppercase">{isInQueue?.status}</p>
              </div>
            </div>

            {isInQueue?.status === 'in-progress' && (
              <div className="mt-6 w-full p-3 bg-amber-50 border border-amber-100 flex items-center gap-3 animate-pulse">
                <AlertCircle size={14} className="text-amber-600" />
                <p className="text-[10px] font-bold uppercase text-amber-600 tracking-tight">Active Operation: Proceed to station.</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="not-in-queue"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-8 space-y-4"
          >
            <div className="p-8 bg-zinc-900 text-white flex flex-col items-center border-[4px] border-zinc-900 shadow-xl">
              <Clock className="text-stone-400 mb-6" size={40} />
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] mb-2 text-center">Node Offline</h3>
              <p className="text-[10px] text-stone-500 uppercase tracking-widest mb-8 text-center max-w-[200px]">Join the priority sequence for grooming extraction.</p>
              <Button 
                onClick={joinQueue}
                disabled={joining}
                className="w-full h-16 bg-white text-zinc-900 hover:bg-stone-100 rounded-none text-xs"
              >
                {joining ? 'TRANSMITTING...' : 'INITIALIZE LIVE JOIN'}
              </Button>
            </div>

            <div className="p-8 bg-white border-[4px] border-stone-200 flex flex-col items-center shadow-sm">
              <Clock className="text-stone-300 mb-4" size={24} />
              <h3 className="text-xs font-bold uppercase tracking-widest mb-4">Strategic Planning</h3>
              <p className="text-[9px] text-stone-400 uppercase tracking-widest mb-6 text-center">Select deployment date for future grooming session.</p>
              
              <div className="w-full space-y-4">
                <input 
                  type="datetime-local" 
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full h-12 border-2 border-stone-100 px-4 text-[10px] font-bold uppercase tracking-widest focus:border-zinc-900 outline-none transition-all"
                />
                <Button 
                  onClick={handleBooking}
                  disabled={joining || !bookingDate}
                  variant="outline"
                  className="w-full h-14 border-zinc-900 text-zinc-900 hover:bg-zinc-900 hover:text-white transition-all text-[10px] font-bold"
                >
                  {joining ? 'UPLOADING...' : 'SCHEDULE EXTRACTION'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest pl-2">Live Sequence</h3>
        {loading ? (
          <div className="p-12 text-center text-[10px] uppercase font-bold text-stone-200">Syncing node list...</div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
            {queue.length > 0 ? queue.map((item) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "flex justify-between items-center p-5 bg-white border shadow-sm transition-all",
                  item.customerId === user?.uid ? "border-zinc-900 border-l-[6px]" : "border-stone-100"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "w-6 h-6 flex items-center justify-center text-[10px] font-bold border",
                    item.status === 'in-progress' ? "bg-zinc-900 text-white border-zinc-900" : "text-stone-300 border-stone-100"
                  )}>
                    {item.position}
                  </span>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider block">
                      {item.customerName || `Subject ${item.customerId.slice(-4)}`}
                    </span>
                    <span className="text-[8px] text-stone-300 font-bold uppercase tracking-widest">
                      Signal: {format(new Date(item.joinedAt), 'HH:mm:ss')}
                    </span>
                  </div>
                </div>
                <Badge className={cn(
                  "text-[8px] border-none px-2 h-4",
                  item.status === 'in-progress' ? 'bg-amber-100 text-amber-700' : 'bg-stone-50 text-stone-400'
                )}>
                  {item.status}
                </Badge>
              </motion.div>
            )) : (
              <div className="py-20 text-center border-2 border-dashed border-stone-200">
                 <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">Empty Sector</p>
              </div>
            )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};


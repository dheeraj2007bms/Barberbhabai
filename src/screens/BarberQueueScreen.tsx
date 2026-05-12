import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  updateDoc, 
  doc, 
  addDoc, 
  writeBatch,
  getDocs,
  Timestamp,
  increment,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { QueueEntry, BarberProfile, Booking } from '../types';
import { useAuth } from '../lib/AuthContext';
import { Button, Card, Badge } from '../components/ui';
import { CheckCircle2, User, Play, UserX, Bell, Clock, Settings, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { setDoc, getDoc } from 'firebase/firestore';

const QUEUE_ID = 'main_shop_queue'; // Simplified for demo

export const BarberQueueScreen = () => {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState({ servedToday: 0, waitingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // 0. Ensure queue document exists with this barber as owner for the demo
    const ensureQueue = async () => {
      try {
        const queueDoc = await getDoc(doc(db, 'queues', QUEUE_ID));
        if (!queueDoc.exists()) {
          await setDoc(doc(db, 'queues', QUEUE_ID), {
            barberId: user.uid,
            shopId: 'prime_alpha'
          });
        }
      } catch (err) {
        console.error("Queue init error:", err);
      }
    };
    ensureQueue();

    // 1. Listen to queue
    const q = query(
      collection(db, 'queues', QUEUE_ID, 'customers'),
      where('status', 'in', ['waiting', 'in-progress'])
    );

    const unsubscribeQueue = onSnapshot(q, (snapshot) => {
      let entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QueueEntry[];
      
      // Sort client-side by joinedAt asc
      entries.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
      
      setQueue(entries.map((e, index) => ({ ...e, position: index + 1 })));
      setStats(prev => ({ ...prev, waitingCount: entries.filter(e => e.status === 'waiting').length }));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `queues/${QUEUE_ID}/customers`);
    });

    // 2. Listen to barber profile for status
    const unsubscribeProfile = onSnapshot(doc(db, 'barbers', user.uid), (docRef) => {
      if (docRef.exists()) setBarberProfile({ id: docRef.id, ...docRef.data() } as BarberProfile);
    }, (error) => {
       handleFirestoreError(error, OperationType.GET, `barbers/${user.uid}`);
    });

    // 3. Get today's stats
    const today = new Date();
    today.setHours(0,0,0,0);
    const statsQuery = query(
      collection(db, 'bookings'),
      where('barberId', '==', user.uid),
      where('status', '==', 'completed')
    );
    
    getDocs(statsQuery).then(snap => {
      // Filter manually to avoid complex indexing for now if not needed
      const todayCount = snap.docs.filter(d => d.data().createdAt >= today.toISOString()).length;
      setStats(prev => ({ ...prev, servedToday: todayCount }));
    }).catch(error => {
      console.error("Stats error:", error);
    });

    // 4. Listen to upcoming bookings
    const bq = query(
      collection(db, 'bookings'),
      where('barberId', '==', user.uid),
      where('status', 'in', ['upcoming', 'confirmed'])
    );

    const unsubscribeBookings = onSnapshot(bq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      
      // Sort client-side by createdAt desc
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setUpcomingBookings(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
    });

    return () => {
      unsubscribeQueue();
      unsubscribeProfile();
      unsubscribeBookings();
    };
  }, [user]);

  const startService = async (entryId: string) => {
    const path = `queues/${QUEUE_ID}/customers/${entryId}`;
    try {
      await updateDoc(doc(db, 'queues', QUEUE_ID, 'customers', entryId), {
        status: 'in-progress'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const notifyCustomer = async (entry: QueueEntry) => {
    const path = 'notifications';
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: entry.customerId,
        type: 'queue_call',
        title: 'Tactical Deployment!',
        message: 'Your slot is active. Proceed to the grooming station immediately.',
        createdAt: new Date().toISOString(),
        read: false
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleNoShow = async (entryId: string) => {
    const path = `queues/${QUEUE_ID}/customers/${entryId}`;
    try {
      console.log('Reporting no-show for subject:', entryId);
      await updateDoc(doc(db, 'queues', QUEUE_ID, 'customers', entryId), {
        status: 'cancelled',
        cancelledReason: 'no-show',
        completedAt: new Date().toISOString()
      });
      alert('Subject ejected from sequence.');
    } catch (err) {
      console.error('No-show error:', err);
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const toggleAvailability = async () => {
    if (!user || !barberProfile) return;
    const path = `barbers/${user.uid}`;
    try {
      await updateDoc(doc(db, 'barbers', user.uid), {
        available: !barberProfile.available
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const markCompleted = async (entry: QueueEntry) => {
    if (!user) return;
    const path = `queues/${QUEUE_ID}/customers/${entry.id}`;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'queues', QUEUE_ID, 'customers', entry.id), {
        status: 'completed',
        completedAt: new Date().toISOString()
      });
      batch.set(doc(collection(db, 'bookings')), {
        barberId: user.uid,
        serviceName: 'Standard Grooming',
        price: 350,
        status: 'completed',
        createdAt: new Date().toISOString(),
        customerId: entry.customerId
      });
      await batch.commit();
      setStats(prev => ({ ...prev, servedToday: prev.servedToday + 1 }));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const formatDateSafe = (dateString: string | undefined, fallback: string) => {
    if (!dateString) return fallback;
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return fallback;
      return format(d, 'MMM d, HH:mm');
    } catch (e) {
      return fallback;
    }
  };

  return (
    <div className="flex-1 p-6 bg-stone-50 min-h-screen pb-32">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-tight">Queue Commander</h2>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Sector: Shop Prime Alpha</p>
        </div>
        
        <button 
          onClick={toggleAvailability}
          className={`flex items-center gap-2 px-4 py-2 border-[2px] transition-all ${
            barberProfile?.available 
            ? 'bg-zinc-900 text-white border-zinc-900' 
            : 'bg-white text-red-500 border-red-500 shadow-[4px_4px_0px_#ef4444]'
          }`}
        >
          <Power size={14} className={barberProfile?.available ? 'animate-pulse' : ''} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {barberProfile?.available ? 'Active Signal' : 'Signal Jammed'}
          </span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card className="p-4 bg-white border-stone-200">
          <p className="text-[8px] font-bold uppercase text-stone-400 tracking-widest mb-1">Subjects Processed</p>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={16} className="text-zinc-900" />
            <span className="text-2xl font-bold tracking-tighter">{stats.servedToday}</span>
          </div>
        </Card>
        <Card className="p-4 bg-white border-stone-200">
          <p className="text-[8px] font-bold uppercase text-stone-400 tracking-widest mb-1">Incoming Signal</p>
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-zinc-900" />
            <span className="text-2xl font-bold tracking-tighter">{stats.waitingCount}</span>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest pl-1">Live Queue Units</h3>
          <AnimatePresence>
          {queue.length > 0 ? (
            queue.map((item, index) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white border-[3px] p-6 shadow-sm flex flex-col gap-6 transition-all ${
                  item.status === 'in-progress' ? 'border-zinc-900 ring-4 ring-zinc-900/5' : 'border-stone-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 flex items-center justify-center font-bold text-lg shadow-lg border-[2px] ${
                      item.status === 'in-progress' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-900 border-zinc-900'
                    }`}>
                      {item.position}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">
                        Subject ID: {item.customerId.slice(-6)}
                      </p>
                      <h4 className="text-lg font-bold uppercase tracking-wider">
                        {item.customerName || 'Anonymous Subject'}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${item.status === 'in-progress' ? 'bg-zinc-900 animate-ping' : 'bg-stone-300'}`}></span>
                        <p className={`text-[8px] uppercase tracking-widest font-bold ${item.status === 'in-progress' ? 'text-zinc-900' : 'text-stone-300'}`}>
                          {item.status === 'in-progress' ? 'Engagement Live' : 'On Standby'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[8px] font-bold text-stone-400 uppercase">Awaiting extraction since</p>
                    <p className="text-[10px] font-bold text-zinc-900">{format(new Date(item.joinedAt), 'HH:mm:ss')}</p>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-stone-50 pt-4">
                  {item.status === 'waiting' && index === 0 && (
                    <>
                      <Button 
                        onClick={() => startService(item.id)}
                        className="flex-1 bg-zinc-900 text-white h-12 text-[10px]"
                      >
                        <Play size={14} className="mr-2" />
                        Commence Engagement
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => notifyCustomer(item)}
                        className="p-3 border-stone-200"
                      >
                        <Bell size={14} />
                      </Button>
                    </>
                  )}
                  {item.status === 'in-progress' && (
                    <Button 
                      onClick={() => markCompleted(item)}
                      className="flex-1 bg-zinc-900 text-white h-12 text-[10px]"
                    >
                      <CheckCircle2 size={14} className="mr-2" />
                      De-brief / Complete
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    onClick={() => handleNoShow(item.id)}
                    className="px-3 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100"
                  >
                    <UserX size={14} />
                  </Button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-32 text-center border-2 border-dashed border-stone-200 bg-stone-50/50">
              <User className="mx-auto text-stone-200 mb-4 opacity-30" size={64} />
              <p className="text-[12px] font-bold text-stone-300 uppercase tracking-[0.2em] mb-2">Sector Clear</p>
              <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest italic">All subjects extracted or absent</p>
            </div>
          )}
          </AnimatePresence>
          {queue.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-stone-200 bg-stone-50/50 rounded-lg">
              <p className="text-[10px] font-bold text-stone-300 uppercase tracking-[0.2em]">Queue Clear</p>
            </div>
          )}
        </div>

        {upcomingBookings.length > 0 && (
          <div className="space-y-4 pt-8 border-t border-stone-200">
            <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest pl-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              Scheduled Deployments
            </h3>
            <div className="space-y-3">
              {upcomingBookings.map((b) => (
                <Card key={b.id} className="p-5 bg-white border-stone-200 shadow-sm flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-tight">{b.customerName || 'Sync Subject'}</h4>
                    <p className="text-[9px] text-stone-400 uppercase font-bold mt-1">
                      {b.appointmentDate ? formatDateSafe(b.appointmentDate, 'Future Task') : 'Stasis'}
                    </p>
                    <Badge variant="outline" className="text-[7px] mt-2 border-amber-100 text-amber-600 bg-amber-50">{b.serviceName}</Badge>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className="text-[8px] bg-zinc-900 border-none">{b.status}</Badge>
                    <p className="text-[8px] font-bold text-stone-300 uppercase">Coord: {b.serviceType}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


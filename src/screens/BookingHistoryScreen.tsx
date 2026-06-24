import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Booking } from '../types';
import { useAuth } from '../lib/AuthContext';
import { Card, Button, Badge } from '../components/ui';
import { Clock, Scissors, Calendar, ChevronRight, XCircle, CheckCircle2, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ReviewModal } from '../components/ReviewModal';

export const BookingHistoryScreen = ({ onBack }: { onBack?: () => void }) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user || !profile) return;

    // Use a loading state for the query itself
    setLoading(true);

    const q = query(
      collection(db, 'bookings'),
      where(profile.role === 'barber' ? 'barberId' : 'customerId', '==', user.uid)
      // Removing orderBy for now to avoid potential missing index errors during initial dev
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      
      // Manual sort by createdAt desc
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setBookings(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile]);

  const cancelBooking = async (id: string, barberId: string) => {
    const path = `bookings/${id}`;
    try {
      console.log('Attempting to abort mission:', id);
      await updateDoc(doc(db, 'bookings', id), {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });
      
      // Create a notification for the other party
      let targetUserId = barberId;
      if (profile?.role === 'barber') {
        const targetBooking = bookings.find(b => b.id === id);
        if (targetBooking?.customerId) {
          targetUserId = targetBooking.customerId;
        }
      }

      if (targetUserId) {
        await addDoc(collection(db, 'notifications'), {
          userId: targetUserId,
          type: 'cancellation',
          title: 'Engagement Aborted',
          message: `The mission with ${profile?.displayName || 'Unknown'} has been cancelled.`,
          createdAt: new Date().toISOString(),
          read: false
        });
      }
      
      alert("Mission aborted successfully. Terminal updated.");
    } catch (err) {
      console.error('Cancellation error for booking:', id, err);
      handleFirestoreError(err, OperationType.UPDATE, path);
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

  const filteredBookings = bookings.filter(b => 
    activeTab === 'upcoming' 
      ? ['pending', 'upcoming', 'confirmed', 'accepted'].includes(b.status) 
      : ['completed', 'cancelled', 'rejected'].includes(b.status)
  );

  if (loading) return <div className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-stone-300">Synchronizing temporal nodes...</div>;

  return (
    <div className="flex-1 p-6 bg-stone-50 min-h-screen pb-32">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-tight">Mission History</h2>
      </div>

      <div className="flex gap-2 mb-6 border-b border-stone-200 pb-4">
        {['upcoming', 'history'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === tab ? 'bg-zinc-900 text-white' : 'text-stone-400 hover:text-zinc-600'
            }`}
          >
            {tab === 'upcoming' ? 'Active Directives' : 'Archived Ops'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="space-y-4"
        >
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <Card key={booking.id} className="bg-white border-stone-200 p-6 flex flex-col gap-4 shadow-sm hover:border-zinc-900 transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3 items-center">
                    <div className="p-2 bg-stone-50 border border-stone-100">
                      <Scissors size={14} className="text-zinc-900" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-tighter">{booking.serviceName}</h4>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">
                        {booking.appointmentDate 
                          ? `Scheduled: ${formatDateSafe(booking.appointmentDate, 'Future Ops')}`
                          : `Created: ${formatDateSafe(booking.createdAt, 'Known Time')}`
                        }
                      </p>
                    </div>
                  </div>
                  <Badge className={`text-[8px] py-0 h-5 ${
                    booking.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                    booking.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200' :
                    booking.status === 'rejected' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                    booking.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse' :
                    booking.status === 'confirmed' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                    booking.status === 'accepted' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    'bg-zinc-900 text-white'
                  }`}>
                    {booking.status}
                  </Badge>
                </div>

                {booking.serviceType === 'home' && booking.address && (
                  <div className="p-3 bg-red-50/50 border border-red-100/50 text-[10px] font-mono text-zinc-700">
                    <p className="text-[8px] font-bold text-red-500 uppercase tracking-widest mb-1">Target Address</p>
                    {booking.address}
                  </div>
                )}

                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest border-t border-stone-50 pt-4">
                  <span className="text-stone-400">Assignment Value</span>
                  <span className="text-zinc-900">₹{booking.price}</span>
                </div>

                {activeTab === 'upcoming' && (
                  <div className="flex gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => cancelBooking(booking.id, booking.barberId)}
                      className="flex-1 text-red-600 border-red-100 hover:bg-red-50 hover:border-red-200 text-[10px]"
                    >
                      <XCircle size={12} className="mr-2" />
                      Abort Mission
                    </Button>
                  </div>
                )}
                
                {booking.status === 'completed' && activeTab === 'history' && profile?.role === 'customer' && (
                  <Button 
                    size="sm"
                    className="w-full mt-2 bg-stone-100 text-zinc-900 border border-stone-200"
                    onClick={() => setSelectedBarberId(booking.barberId)}
                  >
                    <Star size={10} className="mr-2" />
                    Sub-Sieve Assessment (Rate)
                  </Button>
                )}
              </Card>
            ))
          ) : (
            <div className="p-20 text-center border border-dashed border-stone-200">
              <Calendar className="mx-auto text-stone-200 mb-4 opacity-50" size={48} />
              <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">No terminal data recorded for this sector</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {selectedBarberId && (
        <ReviewModal 
          isOpen={true} 
          barberId={selectedBarberId} 
          onClose={() => setSelectedBarberId(null)} 
        />
      )}
    </div>
  );
};

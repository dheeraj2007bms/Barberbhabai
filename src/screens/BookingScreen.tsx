import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Card, Button, Input } from '../components/ui';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BarberProfile } from '../types';

export const BookingScreen = ({ barberId }: { barberId: string | null }) => {
  const [isHomeService, setIsHomeService] = useState(false);
  const [address, setAddress] = useState('');
  const [selectedService, setSelectedService] = useState({ name: 'Skin Fade', price: 150 });
  const [loading, setLoading] = useState(false);
  const [barber, setBarber] = useState<BarberProfile | null>(null);
  const { user } = useAuth();
  
  React.useEffect(() => {
    if (barberId) {
      getDoc(doc(db, 'barbers', barberId)).then(snap => {
        if (snap.exists()) setBarber(snap.data() as BarberProfile);
      });
    }
  }, [barberId]);

  const HOME_SERVICE_FEE = 150;
  const totalPrice = isHomeService ? selectedService.price + HOME_SERVICE_FEE : selectedService.price;

  const handleBooking = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'bookings'), {
        barberId: barberId || 'b1',
        serviceName: selectedService.name,
        price: totalPrice,
        createdAt: new Date().toISOString(),
        customerId: user.uid,
        status: 'upcoming',
        serviceType: isHomeService ? 'home' : 'shop',
        address: isHomeService ? address : ''
      });
      alert('Operation recorded. Signal stable.');
    } catch (err) {
      console.error('Booking Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-stone-50 min-h-screen pb-32">
      <div className="mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-tight">Configure Routine</h2>
        {barber && (
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">
            Specialist: {barber.displayName}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <Card className="bg-white border-stone-200 p-6 flex justify-between items-center transition-all hover:border-zinc-900">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest leading-none mb-2">Service Location</h3>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              {isHomeService ? 'Specialist arrives at your node' : 'Visit the shop unit'}
            </p>
          </div>
          <button 
            onClick={() => setIsHomeService(!isHomeService)}
            className={`w-12 h-6 rounded-full transition-all relative ${isHomeService ? 'bg-zinc-900' : 'bg-stone-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isHomeService ? 'left-7' : 'left-1'}`} />
          </button>
        </Card>

        {isHomeService && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.3em]">Drop-off Coordinates (Address)</p>
            <Input 
              placeholder="Enter full physical address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-16"
            />
            <div className="bg-red-50 text-red-600 px-3 py-1 text-[8px] font-bold uppercase tracking-widest inline-block rounded">
              + ₹{HOME_SERVICE_FEE} Travel Premium
            </div>
          </div>
        )}

        <div className="pt-10 border-t border-stone-200 space-y-4">
          <div className="flex justify-between items-center text-[10px] font-bold text-stone-400 uppercase tracking-widest">
             <span>{selectedService.name}</span>
             <span>₹{selectedService.price}</span>
          </div>
          {isHomeService && (
            <div className="flex justify-between items-center text-[10px] font-bold text-red-400 uppercase tracking-widest">
               <span>Home Charge</span>
               <span>₹{HOME_SERVICE_FEE}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-lg font-bold text-zinc-900 uppercase tracking-tighter pt-4 border-t border-stone-100">
             <span>Total Charge</span>
             <span>₹{totalPrice}</span>
          </div>
        </div>

        <Button 
          disabled={loading || (isHomeService && !address)}
          onClick={handleBooking}
          className="w-full h-16 shadow-xl mt-10 active:scale-95 transition-transform"
        >
          {loading ? 'Synchronizing...' : 'Initialize Synchronization'}
        </Button>
      </div>
    </div>
  );
};

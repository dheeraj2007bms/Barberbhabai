import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Card, Button, Input } from '../components/ui';
import { collection, addDoc, getDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BarberProfile, Service } from '../types';

export const BookingScreen = ({ barberId, onComplete }: { barberId: string | null, onComplete?: () => void }) => {
  const [isHomeService, setIsHomeService] = useState(false);
  const [address, setAddress] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [barbersList, setBarbersList] = useState<BarberProfile[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(barberId);
  const [selectedBarber, setSelectedBarber] = useState<BarberProfile | null>(null);
  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  
  useEffect(() => {
    // 1. Fetch all services
    getDocs(collection(db, 'services')).then(snap => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
      setServices(list);
      if (list.length > 0) {
        setSelectedService(list[0]);
      }
    });

    // 2. Fetch all barbers
    getDocs(collection(db, 'barbers')).then(snap => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BarberProfile[];
      setBarbersList(list);
    });
  }, []);

  useEffect(() => {
    if (selectedBarberId) {
      getDoc(doc(db, 'barbers', selectedBarberId)).then(snap => {
        if (snap.exists()) {
          setSelectedBarber(snap.data() as BarberProfile);
        }
      });
    } else {
      setSelectedBarber(null);
    }
  }, [selectedBarberId]);

  useEffect(() => {
    if (!selectedBarber) {
      setAvailabilityMessage('Please select a specialist.');
      setIsAvailable(false);
      return;
    }
    if (!selectedDate || !selectedTime) {
      setAvailabilityMessage('Please choose date and time parameters.');
      setIsAvailable(false);
      return;
    }

    try {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dateObj = new Date(selectedDate);
      if (isNaN(dateObj.getTime())) {
        setAvailabilityMessage('Invalid target date coordinates.');
        setIsAvailable(false);
        return;
      }
      const dayOfWeek = days[dateObj.getDay()];
      const hoursConfig = selectedBarber.workingHours?.[dayOfWeek];
      
      if (!hoursConfig || !hoursConfig.enabled) {
        setAvailabilityMessage(`Specialist is offline on ${dayOfWeek.toUpperCase()}.`);
        setIsAvailable(false);
        return;
      }

      const timeVal = selectedTime;
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
  }, [selectedDate, selectedTime, selectedBarber]);

  const HOME_SERVICE_FEE = 150;
  const servicePrice = selectedService ? selectedService.price : 0;
  const totalPrice = isHomeService ? servicePrice + HOME_SERVICE_FEE : servicePrice;

  const handleBooking = async () => {
    console.log('Initiating booking synchronization sequence...');
    console.log('Context parameters:', { user: !!user, profile: !!profile });
    console.log('Inputs:', { selectedBarberId, selectedService, selectedDate, selectedTime, isHomeService, address });

    if (!user || !profile) {
      alert('Authentication error. Session not synchronized. Please log in again.');
      return;
    }

    if (!selectedBarberId) {
      alert('Validation Error: Please select a specialist.');
      return;
    }

    if (!selectedService) {
      alert('Validation Error: Please select a service node.');
      return;
    }

    if (!selectedDate || !selectedTime) {
      alert('Validation Error: Please choose date and time parameters.');
      return;
    }

    if (isHomeService && !address.trim()) {
      alert('Validation Error: Physical address is required for home service delivery.');
      return;
    }

    if (!isAvailable) {
      alert(`Availability Error: ${availabilityMessage}`);
      return;
    }

    setLoading(true);
    try {
      const apptDate = `${selectedDate} ${selectedTime}`;
      console.log('Writing booking record to Firestore...');

      const docRef = await addDoc(collection(db, 'bookings'), {
        barberId: selectedBarberId,
        serviceName: selectedService.name,
        price: totalPrice,
        createdAt: new Date().toISOString(),
        customerId: user.uid,
        customerName: profile.displayName,
        status: 'pending',
        serviceType: isHomeService ? 'home' : 'shop',
        address: isHomeService ? address : '',
        appointmentDate: apptDate
      });

      console.log('Booking document created successfully:', docRef.id);

      // Create notification for the barber
      console.log('Creating notification alert for barber:', selectedBarberId);
      await addDoc(collection(db, 'notifications'), {
        userId: selectedBarberId,
        type: isHomeService ? 'home_request' : 'appointment_request',
        title: isHomeService ? 'New Home Service Request' : 'New Appointment Request',
        message: `${profile.displayName} requested ${selectedService.name} on ${selectedDate} at ${selectedTime}.`,
        createdAt: new Date().toISOString(),
        read: false,
        bookingId: docRef.id
      });

      console.log('Notification created successfully.');

      alert('Operation recorded successfully! Booking request pending specialist authorization.');
      
      // Clear inputs
      setAddress('');
      setSelectedDate('');
      setSelectedTime('');

      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error('Firestore Booking/Notification Write Error:', err);
      alert(`Synchronization failed. Signal interrupted: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-stone-50 min-h-screen pb-32">
      <div className="mb-8 flex flex-col gap-1">
        <h2 className="text-2xl font-bold uppercase tracking-tight">Configure Routine</h2>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest italic">Initialize grooming parameters</p>
      </div>

      <div className="space-y-6">
        {/* Barber Picker */}
        <div className="space-y-2 bg-white border border-stone-200 p-6 shadow-sm">
          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.3em]">Select Specialist</label>
          <select 
            value={selectedBarberId || ''} 
            onChange={(e) => setSelectedBarberId(e.target.value || null)}
            className="w-full h-12 border border-stone-200 px-4 text-xs font-bold uppercase tracking-widest focus:border-zinc-900 outline-none transition-all bg-white"
          >
            <option value="">-- Choose Specialist --</option>
            {barbersList.map(b => (
              <option key={b.id} value={b.id}>{b.displayName || 'Anonymous Specialist'}</option>
            ))}
          </select>
        </div>

        {/* Service Picker */}
        <div className="space-y-2 bg-white border border-stone-200 p-6 shadow-sm">
          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.3em]">Select Service Node</label>
          {services.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto">
              {services.map(s => (
                <div 
                  key={s.id}
                  onClick={() => setSelectedService(s)}
                  className={`p-3 border-[2px] transition-all cursor-pointer flex justify-between items-center ${
                    selectedService?.id === s.id 
                      ? 'border-zinc-900 bg-zinc-900/5' 
                      : 'border-stone-100 bg-stone-50/50 hover:border-stone-300'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">{s.name}</p>
                    <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">{s.durationMinutes} minutes</p>
                  </div>
                  <span className="text-xs font-bold">₹{s.price}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[9px] text-stone-300 font-bold uppercase">No active service nodes found.</p>
          )}
        </div>

        {/* Date and Time Inputs */}
        <div className="space-y-4 bg-white border border-stone-200 p-6 shadow-sm">
          <label className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.3em] block border-b border-stone-100 pb-2 mb-2">Temporal Coordinates</label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Select Date</label>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-12 border border-stone-200 px-4 text-xs font-bold focus:border-zinc-900 outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Select Time</label>
              <input 
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full h-12 border border-stone-200 px-4 text-xs font-bold focus:border-zinc-900 outline-none transition-all"
              />
            </div>
          </div>

          <div className={`p-4 border-[2px] flex items-center justify-between text-[10px] font-bold uppercase tracking-wide ${
            isAvailable 
              ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
              : 'bg-amber-50 border-amber-500 text-amber-700'
          }`}>
            <span>{availabilityMessage}</span>
          </div>
        </div>

        {/* Home Service Toggle */}
        <Card className="bg-white border-stone-200 p-6 flex justify-between items-center transition-all hover:border-zinc-900">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest leading-none mb-2">Service Location</h3>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              {isHomeService ? 'Specialist arrives at your node' : 'Visit the shop unit'}
            </p>
          </div>
          <button 
            type="button"
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
             <span>{selectedService?.name || 'Selected Service'}</span>
             <span>₹{servicePrice}</span>
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
          disabled={loading || !isAvailable || (isHomeService && !address) || !selectedService || !selectedBarberId}
          onClick={handleBooking}
          className="w-full h-16 shadow-xl mt-10 active:scale-95 transition-transform"
        >
          {loading ? 'Synchronizing...' : 'Initialize Synchronization'}
        </Button>
      </div>
    </div>
  );
};

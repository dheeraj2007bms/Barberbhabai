import React, { useEffect, useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking, AnalyticsData } from '../types';
import { useAuth } from '../lib/AuthContext';
import { Card, Button } from '../components/ui';
import { cn } from '../lib/utils';

export const AnalyticsScreen = () => {
  const [earningsData, setEarningsData] = useState<AnalyticsData[]>([]);
  const [servicesData, setServicesData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'all' | 'custom'>('7days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const { user } = useAuth();

  useEffect(() => {
    if (user && timeRange !== 'custom') {
      fetchAnalytics();
    }
  }, [user, timeRange]);

  const generateDateRange = (startDateStr: string, endDateStr: string): string[] => {
    const dates: string[] = [];
    const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
    const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);
    
    let current = new Date(sYear, sMonth - 1, sDay);
    const end = new Date(eYear, eMonth - 1, eDay);
    
    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const fetchAnalytics = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'bookings'),
        where('barberId', '==', user.uid),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const bookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];

      // Calculate date range bounds
      const today = new Date();
      let startDateStr = '';
      let endDateStr = today.toISOString().split('T')[0];

      if (timeRange === '7days') {
        const start = new Date();
        start.setDate(today.getDate() - 6);
        startDateStr = start.toISOString().split('T')[0];
      } else if (timeRange === '30days') {
        const start = new Date();
        start.setDate(today.getDate() - 29);
        startDateStr = start.toISOString().split('T')[0];
      } else if (timeRange === 'all') {
        if (bookings.length > 0) {
          startDateStr = bookings[0].createdAt.split('T')[0];
        } else {
          const start = new Date();
          start.setDate(today.getDate() - 29);
          startDateStr = start.toISOString().split('T')[0];
        }
      } else {
        if (!customStart || !customEnd) {
          setLoading(false);
          return;
        }
        startDateStr = customStart;
        endDateStr = customEnd;
      }

      // Generate all continuous dates in the interval
      const allDates = generateDateRange(startDateStr, endDateStr);
      
      // Initialize earnings map with 0 values for every date
      const earningsMap: { [date: string]: { total: number, count: number } } = {};
      allDates.forEach(d => {
        earningsMap[d] = { total: 0, count: 0 };
      });

      // Populate bookings that fall into this range
      bookings.forEach(b => {
        const date = b.createdAt.split('T')[0];
        if (earningsMap[date] !== undefined) {
          earningsMap[date].total += b.price;
          earningsMap[date].count += 1;
        }
      });

      const earningsArray = allDates.map(date => ({
        _id: date,
        total: earningsMap[date].total,
        count: earningsMap[date].count
      }));

      // Process Services (Group by Name) for bookings in selected date range
      const serviceMap: { [name: string]: number } = {};
      bookings.forEach(b => {
        const date = b.createdAt.split('T')[0];
        if (date >= startDateStr && date <= endDateStr) {
          serviceMap[b.serviceName] = (serviceMap[b.serviceName] || 0) + 1;
        }
      });

      const servicesArray = Object.keys(serviceMap).map(name => ({
        _id: name,
        count: serviceMap[name]
      })).sort((a, b) => b.count - a.count);

      setEarningsData(earningsArray);
      setServicesData(servicesArray);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalEarnings = earningsData.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalClients = earningsData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="space-y-10 pb-20 p-6 bg-stone-50 min-h-screen">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold uppercase tracking-tight">Performance Analytics</h2>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest italic">Operational intelligence center</p>
      </div>

      {/* Date Range Selector */}
      <div className="space-y-4 bg-white border border-stone-200 p-6 shadow-sm">
        <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-2">Configure Range</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'all', label: 'All Time' },
            { id: 'custom', label: 'Custom Range' },
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id as any)}
              className={cn(
                "px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all",
                timeRange === r.id 
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-md" 
                  : "bg-stone-50 text-stone-400 border-stone-200 hover:text-zinc-900 hover:border-zinc-900"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {timeRange === 'custom' && (
          <div className="flex flex-col sm:flex-row gap-4 items-end pt-4 border-t border-stone-100 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex-1 w-full space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Start Coordinates</label>
              <input 
                type="date" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)} 
                className="w-full border border-stone-200 px-3 py-2 text-xs font-bold uppercase focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none"
              />
            </div>
            <div className="flex-1 w-full space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">End Coordinates</label>
              <input 
                type="date" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)} 
                className="w-full border border-stone-200 px-3 py-2 text-xs font-bold uppercase focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none"
              />
            </div>
            <Button size="sm" className="h-9 px-6 w-full sm:w-auto" onClick={fetchAnalytics}>
              Apply Filter
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-white border-stone-200 shadow-sm p-6 space-y-1">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-2">Total Earnings</p>
              <p className="text-2xl font-bold tracking-tight">₹{totalEarnings}</p>
            </Card>
            <Card className="bg-white border-stone-200 shadow-sm p-6 space-y-1">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-2">Total Subjects</p>
              <p className="text-2xl font-bold tracking-tight">{totalClients}</p>
            </Card>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.3em]">Financial Trajectory</h3>
            <div className="h-[300px] w-full bg-white border border-stone-200 p-4 shadow-sm">
              {earningsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={earningsData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="_id" 
                      tick={{ fontSize: 10, fontWeight: 'bold' }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => val.split('-').slice(1).join('/')}
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', textTransform: 'uppercase' }}
                    />
                    <Line type="monotone" dataKey="total" stroke="#18181b" strokeWidth={3} dot={{ r: 4, fill: '#18181b' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-stone-200 text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                  No financial meta-data recorded
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.3em]">Popular Engagements</h3>
            <div className="h-[300px] w-full bg-white border border-stone-200 p-4 shadow-sm">
              {servicesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={servicesData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="_id" 
                      type="category" 
                      width={100}
                      tick={{ fontSize: 9, fontWeight: 'bold' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#18181b" radius={[0, 4, 4, 0]}>
                      {servicesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`rgba(24, 24, 27, ${1 - (index * 0.15)})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-stone-200 text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                  No engagement metrics
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

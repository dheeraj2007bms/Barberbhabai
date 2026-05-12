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
import { Card } from '../components/ui';

export const AnalyticsScreen = () => {
  const [earningsData, setEarningsData] = useState<AnalyticsData[]>([]);
  const [servicesData, setServicesData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    if (!user) return;
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

      // Process Earnings (Group by Date)
      const earningsMap: { [date: string]: { total: number, count: number } } = {};
      bookings.forEach(b => {
        const date = new Date(b.createdAt).toISOString().split('T')[0];
        if (!earningsMap[date]) earningsMap[date] = { total: 0, count: 0 };
        earningsMap[date].total += b.price;
        earningsMap[date].count += 1;
      });

      const earningsArray = Object.keys(earningsMap).map(date => ({
        _id: date,
        total: earningsMap[date].total,
        count: earningsMap[date].count
      }));

      // Process Services (Group by Name)
      const serviceMap: { [name: string]: number } = {};
      bookings.forEach(b => {
        serviceMap[b.serviceName] = (serviceMap[b.serviceName] || 0) + 1;
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  const totalEarnings = earningsData.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalClients = earningsData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="space-y-10 pb-20 p-6 bg-stone-50 min-h-screen">
      <h2 className="text-2xl font-bold uppercase tracking-tight">Performance Analytics</h2>

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
    </div>
  );
};

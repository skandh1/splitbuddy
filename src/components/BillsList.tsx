import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { Receipt, Check, Clock, Image, QrCode, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import QRModal from './QRModal';

interface Bill {
  id: string;
  description: string;
  totalAmount: number;
  splitAmount: number;
  paidBy: string;
  paidByUsername: string;
  participants: {
    uid: string;
    username: string;
    paid: boolean;
  }[];
  createdAt: string;
  status: string;
  proofType?: 'none' | 'image' | 'qr';
  proofUrl?: string;
}

export default function BillsList() {
  const { currentUser } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'bills'),
      where('participants', 'array-contains', {
        uid: currentUser.uid,
        username: currentUser.displayName,
        paid: false
      })
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData: Bill[] = [];
      snapshot.forEach((doc) => {
        billsData.push({ id: doc.id, ...doc.data() } as Bill);
      });
      setBills(billsData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handlePayBill = async (billId: string) => {
    try {
      const billRef = doc(db, 'bills', billId);
      await updateDoc(billRef, {
        'participants': bills
          .find(b => b.id === billId)
          ?.participants.map(p => 
            p.uid === currentUser?.uid 
              ? { ...p, paid: true }
              : p
          )
      });
      toast.success('Payment marked as complete');
    } catch (error) {
      toast.error('Failed to update payment status');
    }
  };

  const handleShowQR = (bill: Bill) => {
    setSelectedBill(bill);
    setShowQR(true);
  };

  return (
    <div className="space-y-4">
      {bills.map((bill) => (
        <div key={bill.id} className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold">{bill.description}</h3>
              <p className="text-sm text-gray-600">
                Created by {bill.paidByUsername}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                ${bill.splitAmount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">
                Your share of ${bill.totalAmount.toFixed(2)}
              </p>
            </div>
          </div>
          
          {bill.proofType && bill.proofType !== 'none' && bill.proofUrl && (
            <div className="mb-4 p-3 bg-gray-50 rounded-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                {bill.proofType === 'image' ? <Image size={20} /> : <QrCode size={20} />}
                <span className="text-sm text-gray-600">
                  Payment {bill.proofType === 'image' ? 'receipt' : 'QR code'} available
                </span>
              </div>
              <a
                href={bill.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                <ExternalLink size={20} />
              </a>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {bill.participants.find(p => p.uid === currentUser?.uid)?.paid ? (
                <span className="flex items-center text-green-600">
                  <Check size={16} className="mr-1" />
                  Paid
                </span>
              ) : (
                <span className="flex items-center text-orange-600">
                  <Clock size={16} className="mr-1" />
                  Pending
                </span>
              )}
            </div>
            {!bill.participants.find(p => p.uid === currentUser?.uid)?.paid && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleShowQR(bill)}
                  className="flex items-center gap-2 bg-white border border-blue-600 text-blue-600 px-4 py-2 rounded-md hover:bg-blue-50 transition-colors"
                >
                  <QrCode size={16} />
                  Show QR
                </button>
                <button
                  onClick={() => handlePayBill(bill.id)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Check size={16} />
                  Mark as Paid
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      {bills.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <Receipt size={24} className="mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">No pending bills</p>
        </div>
      )}
      
      {selectedBill && (
        <QRModal
          isOpen={showQR}
          onClose={() => setShowQR(false)}
          friend={{
            username: selectedBill.paidByUsername,
            uid: selectedBill.paidBy
          }}
          amount={selectedBill.splitAmount}
          billId={selectedBill.id}
        />
      )}
    </div>
  );
}
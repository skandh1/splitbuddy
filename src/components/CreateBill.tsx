import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { Receipt, Plus, Minus, Image, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';

interface Friend {
  username: string;
  uid: string;
}

export default function CreateBill() {
  const { currentUser } = useAuth();
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [proofType, setProofType] = useState<'none' | 'image' | 'qr'>('none');
  const [proofUrl, setProofUrl] = useState('');

  useEffect(() => {
    const fetchFriends = async () => {
      if (!currentUser) return;
      
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      if (userData?.friends) {
        const usersRef = collection(db, 'users');
        const friendsData: Friend[] = [];
        
        for (const username of userData.friends) {
          const friendQuery = await getDoc(doc(usersRef, username));
          if (friendQuery.exists()) {
            friendsData.push({
              username: friendQuery.data().username,
              uid: friendQuery.id
            });
          }
        }
        setFriends(friendsData);
      }
    };

    fetchFriends();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !totalAmount || selectedFriends.length === 0) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const amount = parseFloat(totalAmount);
      const splitAmount = amount / (selectedFriends.length + 1);

      const billData = {
        description,
        totalAmount: amount,
        splitAmount,
        paidBy: currentUser?.uid,
        paidByUsername: currentUser?.displayName,
        participants: [
          ...selectedFriends.map(f => ({
            uid: f.uid,
            username: f.username,
            paid: false
          })),
          {
            uid: currentUser?.uid,
            username: currentUser?.displayName,
            paid: true
          }
        ],
        createdAt: new Date().toISOString(),
        status: 'pending',
        proofType,
        proofUrl
      };

      await addDoc(collection(db, 'bills'), billData);
      toast.success('Bill created successfully');
      setDescription('');
      setTotalAmount('');
      setSelectedFriends([]);
      setProofType('none');
      setProofUrl('');
    } catch (error) {
      toast.error('Failed to create bill');
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (friend: Friend) => {
    setSelectedFriends(prev => 
      prev.some(f => f.uid === friend.uid)
        ? prev.filter(f => f.uid !== friend.uid)
        : [...prev, friend]
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Receipt size={20} />
        Create New Bill
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Dinner at Restaurant"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Amount
          </label>
          <input
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Proof
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setProofType('image')}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md border ${
                proofType === 'image' 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              <Image size={20} />
              Image URL
            </button>
            <button
              type="button"
              onClick={() => setProofType('qr')}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md border ${
                proofType === 'qr' 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              <QrCode size={20} />
              QR Code URL
            </button>
          </div>
          {proofType !== 'none' && (
            <input
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder={`Enter ${proofType === 'image' ? 'image' : 'QR code'} URL`}
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Split with
          </label>
          <div className="space-y-2">
            {friends.map((friend) => (
              <button
                key={friend.uid}
                type="button"
                onClick={() => toggleFriend(friend)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  selectedFriends.some(f => f.uid === friend.uid)
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                } border`}
                disabled={loading}
              >
                <span>{friend.username}</span>
                {selectedFriends.some(f => f.uid === friend.uid) ? (
                  <Minus size={16} />
                ) : (
                  <Plus size={16} />
                )}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Receipt size={20} />
          Create Bill
        </button>
      </form>
    </div>
  );
}
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { user, companyData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!companyData) {
        router.replace('/register');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, companyData, loading, router]);

  return (
    <div className="loading-spinner">
      <div className="spinner" />
    </div>
  );
}

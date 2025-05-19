"use client";

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Overview } from '@/components/dashboard/Overview';
import { FacebookAccounts } from '@/components/dashboard/facebook/FacebookAccounts';
import { InstagramAccounts } from '@/components/dashboard/instagram/InstagramAccounts';
import { TwitterAccounts } from '@/components/dashboard/twitter/TwitterAccounts';

type ActiveSection = 'overview' | 'facebook' | 'instagram' | 'twitter' | 'linkedin';

export default function Dashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          localStorage.removeItem('userEmail');
          router.push('/');
          return;
        }

        const email = localStorage.getItem('userEmail');
        
        if (!email) {
          router.push('/');
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (userError || !userData) {
          localStorage.removeItem('userEmail');
          router.push('/');
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error checking user:', error);
        localStorage.removeItem('userEmail');
        router.push('/');
      }
    };

    checkUser();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('userEmail');
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1877F2]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-[#1877F2]">Social Media Automator</h1>
            </div>
            <Button 
              variant="outline"
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        <Sidebar 
          onFacebookClick={() => setActiveSection('facebook')}
          onInstagramClick={() => setActiveSection('instagram')}
          onTwitterClick={() => setActiveSection('twitter')}
          onLinkedinClick={() => setActiveSection('linkedin')}
          onOverviewClick={() => setActiveSection('overview')}
          activeSection={activeSection}
        />

        {/* Content Area */}
        <main className="flex-1 p-8 overflow-auto">
          {activeSection === 'overview' && <Overview />}
          {activeSection === 'facebook' && <FacebookAccounts />}
          {activeSection === 'instagram' && <div>Instagram Accounts (Coming Soon)</div>}
          {activeSection === 'twitter' && <TwitterAccounts />}
          {activeSection === 'linkedin' && <div>LinkedIn Accounts (Coming Soon)</div>}
        </main>
      </div>
    </div>
  );
} 
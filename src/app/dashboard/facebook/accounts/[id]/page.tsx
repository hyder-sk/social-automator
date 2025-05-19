'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreatePost } from '@/components/dashboard/facebook/actions/CreatePost';
import { LikeAction } from '@/components/dashboard/facebook/actions/LikeAction';
import { FollowAction } from '@/components/dashboard/facebook/actions/FollowAction';
import { FriendRequestAction } from '@/components/dashboard/facebook/actions/FriendRequestAction';
import { toast } from 'sonner';

interface FacebookAccount {
  id: string;
  username: string;
  email: string;
  status: string;
  last_verified_at: string;
}

export default function AccountDetailsPage() {
  const params = useParams();
  const [account, setAccount] = useState<FacebookAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        const { data, error } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('id', params.id)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setAccount(data);
      } catch (error) {
        console.error('Error fetching account:', error);
        toast.error('Failed to fetch account details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccount();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading account details...</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Account not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Account Management</h1>
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              account.status === 'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {account.status}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Username</p>
              <p>{account.username}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p>{account.email}</p>
            </div>
            {/* <div>
              <p className="text-sm font-medium text-gray-500">Last Verified</p>
              <p>{new Date(account.last_verified_at).toLocaleString()}</p>
            </div> */}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="create-post" className="space-y-4">
        <TabsList>
          <TabsTrigger value="create-post">Create Post</TabsTrigger>
          <TabsTrigger value="like">Like Post</TabsTrigger>
          <TabsTrigger value="follow">Follow Page</TabsTrigger>
          {/* <TabsTrigger value="friend">Send Friend Request</TabsTrigger> */}
        </TabsList>

        <TabsContent value="create-post">
          <CreatePost accountId={account.id} />
        </TabsContent>

        <TabsContent value="like">
          <LikeAction accountId={account.id} />
        </TabsContent>

        <TabsContent value="follow">
          <FollowAction accountId={account.id} />
        </TabsContent>

        <TabsContent value="friend">
          <FriendRequestAction accountId={account.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
} 
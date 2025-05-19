'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Facebook } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';

interface FacebookOAuthProps {
  onSuccess?: () => void;
}

export function FacebookOAuth({ onSuccess }: FacebookOAuthProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    proxy_ip: '',
    proxy_port: '',
  });
  const supabase = createClient();

  const handleFacebookLogin = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get the session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      // Validate proxy information
      if (!formData.proxy_ip || !formData.proxy_port) {
        throw new Error('Proxy IP and Port are required');
      }

      // Verify the account using browser automation
      const verifyResponse = await fetch('/api/facebook/verify-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          proxy_ip: formData.proxy_ip,
          proxy_port: formData.proxy_port,
        }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        if (verifyResponse.status === 409) {
          toast.error('This Facebook account is already added');
          return;
        }
        throw new Error(errorData.details || 'Failed to verify account');
      }

      const verifyData = await verifyResponse.json();

      // Store account in database
      const { error } = await supabase
        .from('social_accounts')
        .insert([
          {
            user_id: user.id,
            platform: 'facebook',
            type: 'manual',
            username: verifyData.username || formData.email.split('@')[0],
            email: formData.email,
            password: formData.password,
            proxy_ip: formData.proxy_ip,
            proxy_port: parseInt(formData.proxy_port),
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
        ]);

      if (error) throw error;

      toast.success('Facebook account added successfully');
      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error adding Facebook account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add Facebook account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#1877F2] hover:bg-[#0B5ED7] text-white">
          <Facebook className="mr-2 h-4 w-4" />
          Add Facebook Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Facebook Account</DialogTitle>
          <DialogDescription>
            Connect your Facebook account using OAuth to add it to your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter Facebook email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter Facebook password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proxy_ip">Proxy IP</Label>
            <Input
              id="proxy_ip"
              type="text"
              value={formData.proxy_ip}
              onChange={(e) => setFormData({ ...formData, proxy_ip: e.target.value })}
              placeholder="Enter proxy IP address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proxy_port">Proxy Port</Label>
            <Input
              id="proxy_port"
              type="number"
              value={formData.proxy_port}
              onChange={(e) => setFormData({ ...formData, proxy_port: e.target.value })}
              placeholder="Enter proxy port"
            />
          </div>
          <Button 
            onClick={handleFacebookLogin}
            disabled={isLoading}
            className="w-full bg-[#1877F2] hover:bg-[#0B5ED7] text-white"
          >
            {isLoading ? 'Adding Account...' : 'Add Account'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
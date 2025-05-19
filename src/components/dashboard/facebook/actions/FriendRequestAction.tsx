'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FriendRequestActionProps {
  accountId: string;
}

export function FriendRequestAction({ accountId }: FriendRequestActionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    targetUrl: '',
    action: 'send', // send or cancel
    message: '', // Optional message for friend request
  });
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      const response = await fetch('/api/facebook/friend-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          accountId,
          targetUrl: formData.targetUrl,
          action: formData.action,
          message: formData.message || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `Failed to ${formData.action} friend request`);
      }

      toast.success(`Successfully ${formData.action}ed friend request`);
      setFormData({
        targetUrl: '',
        action: 'send',
        message: '',
      });
    } catch (error) {
      console.error(`Error performing friend request action:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${formData.action} friend request`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="action">Action Type</Label>
            <Select
              value={formData.action}
              onValueChange={(value) => setFormData({ ...formData, action: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select action type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="send">Send Friend Request</SelectItem>
                <SelectItem value="cancel">Cancel Friend Request</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetUrl">Target Profile URL</Label>
            <Input
              id="targetUrl"
              type="url"
              value={formData.targetUrl}
              onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
              placeholder="Enter Facebook profile URL"
              required
            />
          </div>

          {formData.action === 'send' && (
            <div className="space-y-2">
              <Label htmlFor="message">Message (Optional)</Label>
              <Input
                id="message"
                type="text"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Add a message to your friend request"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Processing...' : `${formData.action === 'send' ? 'Send' : 'Cancel'} Friend Request`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 
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

interface FollowActionProps {
  accountId: string;
}

export function FollowAction({ accountId }: FollowActionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    targetUrl: '',
    action: 'follow', // follow or unfollow
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

      const response = await fetch('/api/facebook/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          accountId,
          targetUrl: formData.targetUrl,
          action: formData.action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(data.error);
        throw new Error(`Failed to ${formData.action} page`);
      }

      toast.success(`Successfully ${formData.action}ed page`);
      setFormData({
        targetUrl: '',
        action: 'follow',
      });
    } catch (error) {
      console.error(`Error performing ${formData.action} action:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${formData.action} page`);
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
                <SelectItem value="follow">Follow Page</SelectItem>
                <SelectItem value="unfollow">Unfollow Page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetUrl">Target Page URL</Label>
            <Input
              id="targetUrl"
              type="url"
              value={formData.targetUrl}
              onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
              placeholder="Enter Facebook page URL"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Processing...' : `${formData.action === 'follow' ? 'Follow' : 'Unfollow'} Page`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 
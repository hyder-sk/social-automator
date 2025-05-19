'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FollowActionProps {
  accountId: string;
}

type ActionType = 'follow' | 'unfollow';

export function FollowAction({ accountId }: FollowActionProps) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<ActionType>('follow');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/twitter/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          accountId,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} user`);
      }

      toast.success(`User ${action}ed successfully`);
      setUsername('');
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${action} user`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Follow/Unfollow User</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Enter Twitter username (without @)"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace('@', ''))}
              required
            />
          </div>
          <div className="space-y-2">
            <Select
              value={action}
              onValueChange={(value: ActionType) => setAction(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="follow">Follow User</SelectItem>
                <SelectItem value="unfollow">Unfollow User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            type="submit" 
            disabled={isLoading || !username.trim()}
            variant={action === 'unfollow' ? "destructive" : "default"}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {action === 'unfollow' ? 'Unfollowing User...' : 'Following User...'}
              </>
            ) : (
              action === 'unfollow' ? 'Unfollow User' : 'Follow User'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 
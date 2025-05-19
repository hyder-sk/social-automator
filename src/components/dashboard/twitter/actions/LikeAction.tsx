'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface LikeActionProps {
  accountId: string;
}

export function LikeAction({ accountId }: LikeActionProps) {
  const [tweetUrl, setTweetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/twitter/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tweetUrl: tweetUrl,
          accountId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to like tweet');
      }

      toast.success('Tweet liked successfully');
      setTweetUrl('');
    } catch (error) {
      console.error('Error liking tweet:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to like tweet');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Like Tweet</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="url"
              placeholder="Enter tweet URL"
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isLoading || !tweetUrl.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Liking Tweet...
              </>
            ) : (
              'Like Tweet'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 
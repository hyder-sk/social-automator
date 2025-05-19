'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateCommentProps {
  accountId: string;
}

export function CreateComment({ accountId }: CreateCommentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [targetTweet, setTargetTweet] = useState('');
  const [scheduleType, setScheduleType] = useState<'once' | 'repeating' | 'interval'>('once');
  const [scheduleData, setScheduleData] = useState({
    interval: 60, // minutes
    repeatType: 'daily',
    repeatTime: '12:00',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/twitter/create-comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          comment,
          targetTweet,
          scheduleType,
          scheduleData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create comment task');
      }

      toast.success('Comment task created successfully');
      setComment('');
      setTargetTweet('');
    } catch (error) {
      console.error('Error creating comment task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create comment task');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Comment Task</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="targetTweet">Target Tweet URL</Label>
            <Input
              id="targetTweet"
              placeholder="https://twitter.com/username/status/123456789"
              value={targetTweet}
              onChange={(e) => setTargetTweet(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Comment</Label>
            <Textarea
              id="comment"
              placeholder="Enter your comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[100px]"
              maxLength={280}
              required
            />
            <p className="text-sm text-gray-500 text-right">
              {comment.length}/280 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label>Schedule Type</Label>
            <Select
              value={scheduleType}
              onValueChange={(value: 'once' | 'repeating' | 'interval') => setScheduleType(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select schedule type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Once</SelectItem>
                <SelectItem value="repeating">Repeating</SelectItem>
                <SelectItem value="interval">Every X minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scheduleType === 'repeating' && (
            <div className="space-y-2">
              <Label>Repeat Type</Label>
              <Select
                value={scheduleData.repeatType}
                onValueChange={(value) => setScheduleData(prev => ({ ...prev, repeatType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select repeat type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>

              <Label>Time</Label>
              <Input
                type="time"
                value={scheduleData.repeatTime}
                onChange={(e) => setScheduleData(prev => ({ ...prev, repeatTime: e.target.value }))}
              />
            </div>
          )}

          {scheduleType === 'interval' && (
            <div className="space-y-2">
              <Label>Interval (minutes)</Label>
              <Input
                type="number"
                min="1"
                value={scheduleData.interval}
                onChange={(e) => setScheduleData(prev => ({ ...prev, interval: parseInt(e.target.value) }))}
              />
            </div>
          )}

          <Button type="submit" disabled={isLoading || !comment.trim() || !targetTweet.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Task...
              </>
            ) : (
              'Create Comment Task'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 
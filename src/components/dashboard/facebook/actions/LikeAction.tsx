'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LikeActionProps {
  accountId: string;
}

export function LikeAction({ accountId }: LikeActionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'post',
    url: '',
    reaction: 'like',
    commentText: '',
  });
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Please log in to continue');
      }

      // Validate URL format
      if (!formData.url.includes('facebook.com')) {
        throw new Error('Please provide a valid Facebook post URL');
      }

      const response = await fetch('/api/facebook/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          type: formData.type,
          url: formData.url,
          reaction: formData.reaction,
          commentText: formData.type === 'comment' ? formData.commentText : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to perform action');
      }

      toast.success('Action completed successfully');
      setFormData({
        type: 'post',
        url: '',
        reaction: 'like',
        commentText: '',
      });
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to perform action');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* <div className="space-y-2">
            <Label htmlFor="type">Content Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="post">Post</SelectItem>
                <SelectItem value="comment">Comment</SelectItem>
              </SelectContent>
            </Select>
          </div> */}

          <div className="space-y-2">
            <Label htmlFor="url">Content URL</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="Enter post or comment URL"
              required
            />
          </div>

          {formData.type === 'post' && (
            <div className="space-y-2">
              <Label htmlFor="reaction">Reaction Type</Label>
              <Select
                value={formData.reaction}
                onValueChange={(value) => setFormData({ ...formData, reaction: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reaction type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="like">Like 👍</SelectItem>
                  <SelectItem value="love">Love ❤️</SelectItem>
                  <SelectItem value="care">Care 🤗</SelectItem>
                  <SelectItem value="haha">Haha 😄</SelectItem>
                  <SelectItem value="wow">Wow 😮</SelectItem>
                  <SelectItem value="sad">Sad 😢</SelectItem>
                  <SelectItem value="angry">Angry 😠</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.type === 'comment' && (
            <div className="space-y-2">
              <Label htmlFor="commentText">Comment Text</Label>
              <Textarea
                id="commentText"
                value={formData.commentText}
                onChange={(e) => setFormData({ ...formData, commentText: e.target.value })}
                placeholder="Enter your comment"
                className="min-h-[100px]"
                required
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Processing...' : formData.type === 'post' ? 'Submit Reaction' : 'Post Comment'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 
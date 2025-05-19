'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageIcon, VideoIcon, X } from 'lucide-react';

interface CreatePostProps {
  accountId: string;
}

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export function CreatePost({ accountId }: CreatePostProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    content: '',
    scheduleType: 'now',
    scheduleTime: '',
  });
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Please upload an image or video file');
      return;
    }

    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File size should be less than 100MB');
      return;
    }

    const preview = URL.createObjectURL(file);
    setMediaFile({
      file,
      preview,
      type: isImage ? 'image' : 'video'
    });
  };

  const removeMedia = () => {
    if (mediaFile?.preview) {
      URL.revokeObjectURL(mediaFile.preview);
    }
    setMediaFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session found');
      }

      // Create FormData to handle file upload
      const formDataToSend = new FormData();
      formDataToSend.append('accountId', accountId);
      formDataToSend.append('content', formData.content);
      formDataToSend.append('scheduleType', formData.scheduleType);
      
      if (formData.scheduleType === 'scheduled') {
        formDataToSend.append('scheduleTime', formData.scheduleTime);
      }

      if (mediaFile) {
        formDataToSend.append('media', mediaFile.file);
        formDataToSend.append('mediaType', mediaFile.type);
      }
      const response = await fetch('/api/facebook/create-post', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Failed to create post');
      }

      toast.success('Post created successfully');
      setFormData({
        content: '',
        scheduleType: 'now',
        scheduleTime: '',
      });
      removeMedia();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create post');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Post Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="What's on your mind?"
              className="min-h-[100px]"
              required
            />
          </div>

          {/* <div className="space-y-2">
            <Label>Media</Label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
              >
                {mediaFile ? (
                  mediaFile.type === 'image' ? <ImageIcon className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4" />
                    <span>Add Media</span>
                  </>
                )}
              </Button>
              {mediaFile && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {mediaFile.file.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeMedia}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {mediaFile && (
              <div className="mt-2">
                {mediaFile.type === 'image' ? (
                  <img
                    src={mediaFile.preview}
                    alt="Preview"
                    className="max-h-48 rounded-lg object-contain"
                  />
                ) : (
                  <video
                    src={mediaFile.preview}
                    controls
                    className="max-h-48 rounded-lg"
                  />
                )}
              </div>
            )}
          </div> */}

          {/* <div className="space-y-2">
            <Label htmlFor="scheduleType">When to Post</Label>
            <Select
              value={formData.scheduleType}
              onValueChange={(value) => setFormData({ ...formData, scheduleType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select when to post" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Post Now</SelectItem>
                <SelectItem value="scheduled">Schedule Post</SelectItem>
              </SelectContent>
            </Select>
          </div> */}

          {formData.scheduleType === 'scheduled' && (
            <div className="space-y-2">
              <Label htmlFor="scheduleTime">Schedule Time</Label>
              <input
                id="scheduleTime"
                type="datetime-local"
                value={formData.scheduleTime}
                onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating Post...' : formData.scheduleType === 'now' ? 'Post Now' : 'Schedule Post'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 
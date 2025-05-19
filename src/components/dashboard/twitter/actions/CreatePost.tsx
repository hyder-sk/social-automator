'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Image as ImageIcon, X } from 'lucide-react';
import Image from 'next/image';

interface CreatePostProps {
  accountId: string;
}

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export function CreatePost({ accountId }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Check if adding new files would exceed the 4 media limit
    if (mediaFiles.length + files.length > 4) {
      toast.error('Maximum 4 media files allowed');
      return;
    }

    // Process each file
    files.forEach(file => {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum size is 5MB`);
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast.error(`${file.name} is not a supported file type`);
        return;
      }

      // Create preview URL
      const preview = URL.createObjectURL(file);
      setMediaFiles(prev => [...prev, {
        file,
        preview,
        type: file.type.startsWith('image/') ? 'image' : 'video'
      }]);
    });
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Create FormData to handle file uploads
      const formData = new FormData();
      formData.append('content', content);
      formData.append('accountId', accountId);
      
      // Append media files
      mediaFiles.forEach((media, index) => {
        formData.append(`media${index}`, media.file);
      });

      const response = await fetch('/api/twitter/create-post', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create tweet');
      }

      toast.success('Tweet created successfully');
      setContent('');
      setMediaFiles([]);
    } catch (error) {
      console.error('Error creating tweet:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create tweet');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Tweet</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="What's happening?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px]"
              maxLength={280}
            />
            <p className="text-sm text-gray-500 text-right">
              {content.length}/280 characters
            </p>
          </div>

          {/* Media Preview */}
          {mediaFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {mediaFiles.map((media, index) => (
                <div key={index} className="relative aspect-square">
                  {media.type === 'image' ? (
                    <Image
                      src={media.preview}
                      alt={`Media ${index + 1}`}
                      fill
                      className="object-cover rounded-lg"
                    />
                  ) : (
                    <video
                      src={media.preview}
                      className="w-full h-full object-cover rounded-lg"
                      controls
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleMediaSelect}
                accept="image/*"
                multiple
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={mediaFiles.length >= 4}
              >
                <ImageIcon className="h-5 w-5 text-blue-500" />
              </Button>
              <span className="text-sm text-gray-500">
                {mediaFiles.length}/4 media
              </span>
            </div>
            <Button type="submit" disabled={isLoading || (!content.trim() && mediaFiles.length === 0)}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Tweet...
                </>
              ) : (
                'Create Tweet'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 
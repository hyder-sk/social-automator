'use client';

import { Button } from "@/components/ui/button";
import { Facebook, Instagram, Twitter, Linkedin, LayoutDashboard } from "lucide-react";

interface SidebarProps {
  onFacebookClick: () => void;
  onInstagramClick: () => void;
  onTwitterClick: () => void;
  onLinkedinClick: () => void;
  onOverviewClick: () => void;
  activeSection: 'overview' | 'facebook' | 'instagram' | 'twitter' | 'linkedin';
}

export function Sidebar({
  onFacebookClick,
  onInstagramClick,
  onTwitterClick,
  onLinkedinClick,
  onOverviewClick,
  activeSection
}: SidebarProps) {
  return (
    <div className="w-64 bg-white shadow-sm h-full">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Menu</h2>
        <div className="space-y-2">
          <Button
            variant={activeSection === 'overview' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={onOverviewClick}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Overview
          </Button>
          <Button
            variant={activeSection === 'facebook' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={onFacebookClick}
          >
            <Facebook className="mr-2 h-4 w-4" />
            Facebook
          </Button>
          <Button
            variant={activeSection === 'instagram' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={onInstagramClick}
          >
            <Instagram className="mr-2 h-4 w-4" />
            Instagram
          </Button>
          <Button
            variant={activeSection === 'twitter' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={onTwitterClick}
          >
            <Twitter className="mr-2 h-4 w-4" />
            Twitter
          </Button>
          <Button
            variant={activeSection === 'linkedin' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={onLinkedinClick}
          >
            <Linkedin className="mr-2 h-4 w-4" />
            LinkedIn
          </Button>
        </div>
      </div>
    </div>
  );
} 
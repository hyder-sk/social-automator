'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import AuthForm from '@/components/AuthForm';
import Features from '@/components/Features';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#1877F2] to-[#1DA1F2] bg-clip-text text-transparent">
              Social Media Automator
            </h1>
            <div className="flex space-x-4">
              <Button
                variant={isLogin ? "default" : "outline"}
                onClick={() => setIsLogin(true)}
                className="bg-[#1877F2] hover:bg-[#0B5ED7]"
              >
                Login
              </Button>
              <Button
                variant={!isLogin ? "default" : "outline"}
                onClick={() => setIsLogin(false)}
                className="bg-[#E4405F] hover:bg-[#C13584]"
              >
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main>
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-5xl font-bold text-gray-900 leading-tight">
                Automate Your <span className="text-[#1877F2]">Social Media</span> Presence
              </h2>
              <p className="text-xl text-gray-600">
                Manage multiple social media accounts, schedule posts, and analyze performance all in one place.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2 bg-[#1877F2]/10 px-4 py-2 rounded-full">
                  <span className="text-[#1877F2] font-semibold">✓</span>
                  <span className="text-gray-700">Facebook Integration</span>
                </div>
                <div className="flex items-center space-x-2 bg-[#E4405F]/10 px-4 py-2 rounded-full">
                  <span className="text-[#E4405F] font-semibold">✓</span>
                  <span className="text-gray-700">Instagram Automation</span>
                </div>
                <div className="flex items-center space-x-2 bg-[#1DA1F2]/10 px-4 py-2 rounded-full">
                  <span className="text-[#1DA1F2] font-semibold">✓</span>
                  <span className="text-gray-700">Twitter Management</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <AuthForm isLogin={isLogin} />
            </div>
          </div>
        </div>
        <Features />
      </main>
    </div>
  );
}

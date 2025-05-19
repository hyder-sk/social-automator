'use client';

import React from 'react';
import { FaFacebook, FaInstagram } from 'react-icons/fa';

interface SidebarProps {
  onFacebookClick?: () => void;
  onInstagramClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onFacebookClick, onInstagramClick }) => {
  return (
    <div className="fixed left-0 top-0 h-screen w-16 bg-gray-800 text-white flex flex-col items-center py-4">
      <div className="flex flex-col space-y-6">
        <button
          onClick={onFacebookClick}
          className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          title="Facebook"
        >
          <FaFacebook size={24} />
        </button>
        <button
          onClick={onInstagramClick}
          className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          title="Instagram"
        >
          <FaInstagram size={24} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar; 
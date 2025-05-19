'use client';

import React from 'react';
import { FaFacebook, FaInstagram, FaTwitter } from 'react-icons/fa';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: <FaFacebook className="text-white" size={24} />,
    title: 'Facebook Integration',
    description: 'Manage your Facebook pages and profiles with advanced automation tools',
    gradient: 'from-[#1877F2] to-[#0B5ED7]'
  },
  {
    icon: <FaInstagram className="text-white" size={24} />,
    title: 'Instagram Automation',
    description: 'Schedule posts, manage stories, and engage with your audience automatically',
    gradient: 'from-[#E4405F] to-[#C13584]'
  },
  {
    icon: <FaTwitter className="text-white" size={24} />,
    title: 'Twitter Management',
    description: 'Automate tweets, replies, and engagement with your Twitter audience',
    gradient: 'from-[#1DA1F2] to-[#0D8BD9]'
  }
];

const Features: React.FC = () => {
  return (
    <section className="py-16 bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            Powerful <span className="text-blue-600">Social Media</span> Management
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Streamline your social media presence with our comprehensive automation tools
          </p>
        </div>
        <div className="mt-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm"
              >
                <CardHeader>
                  <div className={`flex items-center justify-center h-16 w-16 rounded-xl bg-gradient-to-r ${feature.gradient} text-white group-hover:scale-110 transition-transform duration-300`}>
                    {feature.icon}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="mt-2 text-gray-600">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features; 
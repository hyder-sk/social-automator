'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart2, Clock, AlertCircle, Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

interface TaskStats {
  total: number;
  passed: number;
  failed: number;
}

interface SocialMetrics {
  accounts: number;
  tasks: TaskStats;
  last24Hours: TaskStats;
}

export function Overview() {
  // Sample data - replace with actual data from your backend
  const metrics = {
    facebook: {
      accounts: 3,
      tasks: {
        total: 150,
        passed: 120,
        failed: 30
      },
      last24Hours: {
        total: 25,
        passed: 20,
        failed: 5
      }
    },
    instagram: {
      accounts: 2,
      tasks: {
        total: 100,
        passed: 85,
        failed: 15
      },
      last24Hours: {
        total: 15,
        passed: 12,
        failed: 3
      }
    },
    twitter: {
      accounts: 1,
      tasks: {
        total: 50,
        passed: 40,
        failed: 10
      },
      last24Hours: {
        total: 8,
        passed: 6,
        failed: 2
      }
    },
    linkedin: {
      accounts: 1,
      tasks: {
        total: 30,
        passed: 25,
        failed: 5
      },
      last24Hours: {
        total: 5,
        passed: 4,
        failed: 1
      }
    }
  };

  const SocialCard = ({ 
    platform, 
    icon: Icon, 
    metrics 
  }: { 
    platform: string; 
    icon: any; 
    metrics: SocialMetrics 
  }) => {
    const successRate = (metrics.tasks.passed / metrics.tasks.total) * 100;
    const last24HoursRate = (metrics.last24Hours.passed / metrics.last24Hours.total) * 100;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Icon className="h-6 w-6" />
            <CardTitle className="capitalize">{platform}</CardTitle>
          </div>
          <CardDescription>{metrics.accounts} connected accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Overall Success Rate</span>
              <span>{successRate.toFixed(1)}%</span>
            </div>
            <Progress value={successRate} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Last 24 Hours</span>
              <span>{last24HoursRate.toFixed(1)}%</span>
            </div>
            <Progress value={last24HoursRate} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Total Tasks</p>
              <p className="text-2xl font-bold">{metrics.tasks.total}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Failed Tasks</p>
              <p className="text-2xl font-bold text-red-500">{metrics.tasks.failed}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <p className="text-gray-500">Monitor your social media automation performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SocialCard platform="facebook" icon={Facebook} metrics={metrics.facebook} />
        <SocialCard platform="instagram" icon={Instagram} metrics={metrics.instagram} />
        <SocialCard platform="twitter" icon={Twitter} metrics={metrics.twitter} />
        <SocialCard platform="linkedin" icon={Linkedin} metrics={metrics.linkedin} />
      </div>

      {/* Recent Failed Tasks */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Recent Failed Tasks</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(metrics).map(([platform, data]) => (
            data.last24Hours.failed > 0 && (
              <Card key={platform}>
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    {platform === 'facebook' && <Facebook className="h-5 w-5" />}
                    {platform === 'instagram' && <Instagram className="h-5 w-5" />}
                    {platform === 'twitter' && <Twitter className="h-5 w-5" />}
                    {platform === 'linkedin' && <Linkedin className="h-5 w-5" />}
                    <CardTitle className="capitalize">{platform}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-500">{data.last24Hours.failed}</p>
                  <p className="text-sm text-gray-500">Failed tasks in last 24 hours</p>
                </CardContent>
              </Card>
            )
          ))}
        </div>
      </div>
    </div>
  );
} 
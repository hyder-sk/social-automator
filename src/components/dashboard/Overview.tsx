'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart2, Clock, AlertCircle, Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { createClient } from '@/lib/supabase/client';
import { FailedTasksDialog } from './FailedTasksDialog';
import { TaskDetailsDialog } from './TaskDetailsDialog';
import { useRouter } from 'next/navigation';

interface TaskLog {
  id: string;
  execution_time: string;
  result: string;
  message: string;
  proxy_used: string;
}

interface Task {
  id: string;
  type: string;
  status: string;
  created_at: string;
  task_logs: TaskLog[];
  social_accounts: {
    platform: string;
  };
}

interface TaskStats {
  total: number;
  passed: number;
  failed: number;
}

interface SocialMetrics {
  accounts: number;
  tasks: TaskStats;
  last24Hours: TaskStats;
  failedTasks?: Task[];
}

interface SocialAccount {
  platform: string;
  status: string;
}

interface TaskWithRelations {
  id: string;
  type: string;
  status: string;
  created_at: string;
  social_accounts: {
    platform: string;
  };
  task_logs: TaskLog[];
}

export function Overview() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Record<string, SocialMetrics>>({
    facebook: {
      accounts: 0,
      tasks: { total: 0, passed: 0, failed: 0 },
      last24Hours: { total: 0, passed: 0, failed: 0 }
    },
    instagram: {
      accounts: 0,
      tasks: { total: 0, passed: 0, failed: 0 },
      last24Hours: { total: 0, passed: 0, failed: 0 }
    },
    twitter: {
      accounts: 0,
      tasks: { total: 0, passed: 0, failed: 0 },
      last24Hours: { total: 0, passed: 0, failed: 0 }
    },
    linkedin: {
      accounts: 0,
      tasks: { total: 0, passed: 0, failed: 0 },
      last24Hours: { total: 0, passed: 0, failed: 0 }
    }
  });

  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [selectedPlatformForDetails, setSelectedPlatformForDetails] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      // Fetch accounts count with status
      const { data: accounts } = await supabase
        .from('social_accounts')
        .select('platform, status')
        .eq('status', 'active');

      // Fetch tasks and task logs
      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          id,
          type,
          status,
          created_at,
          social_accounts (
            platform
          ),
          task_logs (
            id,
            execution_time,
            result,
            message,
            proxy_used
          )
        `)
        .order('created_at', { ascending: false }) as { data: Task[] | null };

      // Process the data
      const newMetrics = { ...metrics };
      
      // Reset counts
      Object.keys(newMetrics).forEach(platform => {
        newMetrics[platform] = {
          accounts: 0,
          tasks: { total: 0, passed: 0, failed: 0 },
          last24Hours: { total: 0, passed: 0, failed: 0 },
          failedTasks: []
        };
      });

      // Count only active accounts
      accounts?.forEach((account: SocialAccount) => {
        if (newMetrics[account.platform] && account.status === 'active') {
          newMetrics[account.platform].accounts++;
        }
      });

      // Process tasks and logs
      tasks?.forEach(task => {
        const platform = task.social_accounts?.platform;
        if (!platform || !newMetrics[platform]) return;

        const taskStats = newMetrics[platform].tasks;
        const last24HoursStats = newMetrics[platform].last24Hours;
        const now = new Date();
        const taskDate = new Date(task.created_at);
        const isLast24Hours = now.getTime() - taskDate.getTime() <= 24 * 60 * 60 * 1000;

        taskStats.total++;
        if (isLast24Hours) {
          last24HoursStats.total++;
        }

        // Process task logs
        task.task_logs?.forEach(log => {
          if (log.result === 'success') {
            taskStats.passed++;
            if (isLast24Hours) last24HoursStats.passed++;
          } else if (log.result === 'failed') {
            taskStats.failed++;
            if (isLast24Hours) last24HoursStats.failed++;
            
            // Add to failed tasks if it's a failed task
            if (task.status === 'failed') {
              if (!newMetrics[platform].failedTasks) {
                newMetrics[platform].failedTasks = [];
              }
              newMetrics[platform].failedTasks?.push(task);
            }
          }
        });
      });

      setMetrics(newMetrics);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const handleFailedTasksClick = (platform: string) => {
    setSelectedPlatform(platform);
    setIsDialogOpen(true);
  };

  const handleTaskDetailsClick = (platform: string) => {
    router.push(`/dashboard/tasks/${platform}`);
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
    const successRate = metrics.tasks.total > 0 ? (metrics.tasks.passed / metrics.tasks.total) * 100 : 0;
    const last24HoursRate = metrics.last24Hours.total > 0 ? (metrics.last24Hours.passed / metrics.last24Hours.total) * 100 : 0;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Icon className="h-6 w-6" />
            <CardTitle className="capitalize">{platform}</CardTitle>
          </div>
          <CardDescription>
            <div className="flex items-center justify-between">
              <span>{metrics.accounts} active accounts</span>
              <span className="text-sm font-medium">
                {successRate.toFixed(1)}% success rate
              </span>
            </div>
          </CardDescription>
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

      {/* Recent Tasks Overview */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Recent Tasks Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(metrics).map(([platform, data]) => (
            <Card 
              key={platform}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleTaskDetailsClick(platform)}
            >
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
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Total</p>
                      <p className="text-xl font-bold">{data.last24Hours.total}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Passed</p>
                      <p className="text-xl font-bold text-green-600">{data.last24Hours.passed}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Failed</p>
                      <p className="text-xl font-bold text-red-500">{data.last24Hours.failed}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Last 24 Hours</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedPlatform && (
        <FailedTasksDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          platform={selectedPlatform}
          tasks={metrics[selectedPlatform].failedTasks || []}
        />
      )}
    </div>
  );
} 
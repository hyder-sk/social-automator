'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { addDays } from "date-fns";
import { createClient } from '@/lib/supabase/client';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface TaskLog {
  id: string;
  execution_time: string;
  result: 'success' | 'failed';
  message: string;
  proxy_used: string | null;
}

interface Task {
  id: string;
  type: string;
  status: string;
  created_at: string;
  social_accounts: {
    platform: string;
  };
  task_logs: TaskLog[];
}

export default function TaskDetailsPage() {
  const params = useParams();
  const platform = params.platform as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('total');
  const [dateRange, setDateRange] = useState({
    from: addDays(new Date(), -7),
    to: new Date(),
  });
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, [platform]);

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!platform) {
        throw new Error('Platform is required');
      }

      console.log('Fetching tasks for platform:', platform);

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          type,
          status,
          created_at,
          social_accounts!tasks_social_account_id_fkey (
            id,
            platform,
            user_id
          ),
          task_logs (
            id,
            execution_time,
            result,
            message,
            proxy_used
          )
        `)
        .eq('user_id', user.id)
        .eq('social_accounts.platform', platform.toLowerCase())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      if (!data) {
        console.log('No tasks found for platform:', platform);
        setTasks([]);
        return;
      }

      console.log('Raw tasks data:', data);

      const tasks = data.map(task => ({
        ...task,
        social_accounts: task.social_accounts?.[0] || { platform: platform }
      })) as Task[];

      console.log('Processed tasks:', tasks);
      setTasks(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      toast.error('Failed to fetch tasks. Please try again.');
      setTasks([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const taskDate = new Date(task.created_at);
    const isInDateRange = taskDate >= dateRange.from && taskDate <= dateRange.to;
    
    console.log('Filtering task:', {
      id: task.id,
      status: task.status,
      isInDateRange,
      statusFilter,
      willShow: statusFilter === 'total' ? isInDateRange :
               statusFilter === 'passed' ? (isInDateRange && task.status === 'completed') :
               statusFilter === 'failed' ? (isInDateRange && task.status === 'failed') :
               isInDateRange
    });
    
    if (statusFilter === 'total') return isInDateRange;
    if (statusFilter === 'passed') return isInDateRange && task.status === 'completed';
    if (statusFilter === 'failed') return isInDateRange && task.status === 'failed';
    
    return isInDateRange;
  });

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold capitalize">{platform} Task Details</h1>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total">All Tasks</SelectItem>
            <SelectItem value="passed">Passed Tasks</SelectItem>
            <SelectItem value="failed">Failed Tasks</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker
          value={dateRange}
          onChange={(value) => {
            if (value?.from && value?.to) {
              setDateRange({ from: value.from, to: value.to });
            }
          }}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Task ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Proxy Used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-mono text-sm">{task.id}</TableCell>
                <TableCell className="capitalize">{task.type}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' :
                    task.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status}
                  </span>
                </TableCell>
                <TableCell>{new Date(task.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {task.task_logs[0]?.result === 'success' ? 'Success' : 'Failed'}
                </TableCell>
                <TableCell 
                  className="max-w-[200px] cursor-pointer hover:bg-gray-50"
                  onClick={() => task.task_logs[0]?.message && setSelectedMessage(task.task_logs[0].message)}
                >
                  <div className="truncate">
                    {task.task_logs[0]?.message || 'N/A'}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {task.task_logs[0]?.proxy_used || 'N/A'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Message</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <pre className="whitespace-pre-wrap break-words bg-gray-50 p-4 rounded-lg text-sm">
              {selectedMessage}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
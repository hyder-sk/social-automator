import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "../../components/ui/date-range-picker";
import { addDays } from "date-fns";
import { DateRange } from "react-day-picker";

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
  task_logs: TaskLog[];
  social_accounts: {
    platform: string;
  };
}

interface TaskDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  platform: string;
  tasks: Task[];
}

export function TaskDetailsDialog({ isOpen, onClose, platform, tasks }: TaskDetailsDialogProps) {
  const [statusFilter, setStatusFilter] = useState<string>('total');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: addDays(new Date(), -7),
    to: new Date(),
  });

  const filteredTasks = tasks.filter(task => {
    const taskDate = new Date(task.created_at);
    const isInDateRange = dateRange.from && dateRange.to && 
      taskDate >= dateRange.from && taskDate <= dateRange.to;
    
    if (statusFilter === 'total') return isInDateRange;
    if (statusFilter === 'passed') return isInDateRange && task.status === 'completed';
    if (statusFilter === 'failed') return isInDateRange && task.status === 'failed';
    
    return isInDateRange;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">{platform} Task Details</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center gap-4 mb-4">
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
            onChange={(value: DateRange | undefined) => {
              if (value?.from && value?.to) {
                setDateRange({ from: value.from, to: value.to });
              }
            }}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task ID</TableHead>
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
                <TableCell className="font-mono">{task.id.slice(0, 8)}...</TableCell>
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
                <TableCell className="max-w-[200px] truncate">
                  {task.task_logs[0]?.message || 'N/A'}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {task.task_logs[0]?.proxy_used || 'N/A'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
} 
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

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
}

interface FailedTasksDialogProps {
  isOpen: boolean;
  onClose: () => void;
  platform: string;
  tasks: Task[];
}

export function FailedTasksDialog({
  isOpen,
  onClose,
  platform,
  tasks,
}: FailedTasksDialogProps) {
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              Failed Tasks - {platform}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Task ID: {task.id}</h4>
                    <p className="text-sm text-gray-500">
                      Created {formatDistanceToNow(new Date(task.created_at))} ago
                    </p>
                  </div>
                  <Badge variant="destructive">{task.status}</Badge>
                </div>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">Execution Time</TableHead>
                        <TableHead className="w-[100px]">Result</TableHead>
                        <TableHead className="w-[400px]">Message</TableHead>
                        <TableHead className="w-[150px]">Proxy Used</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {task.task_logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {formatDistanceToNow(new Date(log.execution_time))} ago
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={log.result === "failed" ? "destructive" : "default"}
                            >
                              {log.result}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => setSelectedMessage(log.message)}
                              className="text-left hover:text-blue-600 transition-colors"
                            >
                              {log.message}
                            </button>
                          </TableCell>
                          <TableCell>{log.proxy_used}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Error Message Details</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <pre className="whitespace-pre-wrap break-words bg-gray-50 p-4 rounded-lg">
              {selectedMessage}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 
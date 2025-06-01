'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Power, PowerOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TwitterAccountForm } from './TwitterAccountForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface TwitterAccount {
  id: string;
  username: string;
  email: string;
  status: 'active' | 'inactive' | 'deleted';
  created_at: string;
}

export function TwitterAccounts() {
  const [accounts, setAccounts] = useState<TwitterAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeactivatedDialog, setShowDeactivatedDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<TwitterAccount | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('platform', 'twitter')
        .is('deleted_at', null)  // Only get non-deleted accounts
        .neq('status', 'deleted') // Also exclude accounts with deleted status
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to fetch Twitter accounts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('social_accounts')
        .update({ 
          deleted_at: new Date().toISOString(),
          status: 'deleted'
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Account deleted successfully');
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    }
  };

  const handleStatusToggle = async (id: string, currentStatus: 'active' | 'inactive' | 'deleted') => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from('social_accounts')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Account ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      fetchAccounts();
    } catch (error) {
      console.error('Error updating account status:', error);
      toast.error('Failed to update account status');
    }
  };

  const handleRowClick = (account: TwitterAccount) => {
    if (account.status === 'inactive' || account.status === 'deleted') {
      setSelectedAccount(account);
      setShowDeactivatedDialog(true);
    } else {
      router.push(`/dashboard/twitter/accounts/${account.id}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Twitter Accounts</h2>
        <TwitterAccountForm onSuccess={fetchAccounts} />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Loading accounts...
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No Twitter accounts found. Add your Twitter account to get started.
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow 
                  key={account.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(account)}
                >
                  <TableCell>{account.username}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        account.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {account.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(account.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()} // Prevent row click when clicking dropdown
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusToggle(account.id, account.status);
                          }}
                        >
                          {account.status === 'active' ? (
                            <>
                              <PowerOff className="mr-2 h-4 w-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Power className="mr-2 h-4 w-4" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(account.id);
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDeactivatedDialog} onOpenChange={setShowDeactivatedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account Deactivated</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500">
              This account is currently deactivated. Please activate the account first to proceed.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowDeactivatedDialog(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                if (selectedAccount) {
                  handleStatusToggle(selectedAccount.id, selectedAccount.status);
                  setShowDeactivatedDialog(false);
                }
              }}
            >
              Activate Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
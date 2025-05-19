import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function InstagramAccounts() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Instagram Accounts</h2>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Sample Instagram Account Card */}
        <Card>
          <CardHeader>
            <CardTitle>@example_instagram</CardTitle>
            <CardDescription>Business Account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Followers</span>
                <span className="font-medium">1,234</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Following</span>
                <span className="font-medium">567</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Posts</span>
                <span className="font-medium">89</span>
              </div>
              <div className="pt-4">
                <Button variant="outline" className="w-full">
                  View Details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
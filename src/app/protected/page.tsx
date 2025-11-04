import { redirect } from "next/navigation";
import { createClient } from "@/libs/supabase/server";
import { Button, Card } from "antd";
import Link from "next/link";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-2xl">
        <Card title={<div className="text-2xl">Protected Page</div>}>
          <div className="text-sm text-muted-foreground mb-4">
            You are authenticated and can view this page
          </div>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <h3 className="font-semibold mb-2">User Information</h3>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">ID:</span> {data.user.id}
                </p>
                <p>
                  <span className="font-medium">Email:</span> {data.user.email}
                </p>
                {data.user.user_metadata?.display_name && (
                  <p>
                    <span className="font-medium">Display Name:</span>{" "}
                    {data.user.user_metadata.display_name}
                  </p>
                )}
                <p>
                  <span className="font-medium">Created:</span>{" "}
                  {new Date(data.user.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button>
                <Link href="/test">Test API</Link>
              </Button>
              <Button>Logout</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, ListTodo, Clock, Plus } from "lucide-react";
import { format } from "date-fns";

export default function Projects() {
  const { business } = useBusiness();
  const [activeTab, setActiveTab] = useState("projects");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const statusColors: Record<string, string> = { planning: "bg-blue-500/10 text-blue-500", in_progress: "bg-yellow-500/10 text-yellow-500", review: "bg-purple-500/10 text-purple-500", completed: "bg-green-500/10 text-green-500", on_hold: "bg-orange-500/10 text-orange-500" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Project Management</h1>
        <p className="text-muted-foreground">Track internal and client-facing projects end-to-end</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><FolderKanban className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{projects.length}</p><p className="text-xs text-muted-foreground">Total Projects</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ListTodo className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{projects.filter((p: any) => p.status === "in_progress").length}</p><p className="text-xs text-muted-foreground">In Progress</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{projects.filter((p: any) => p.status === "completed").length}</p><p className="text-xs text-muted-foreground">Completed</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="projects">All Projects</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Projects</h3><Button><Plus className="h-4 w-4 mr-1" />New Project</Button></div>
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((p: any) => (
                <Card key={p.id} className="cursor-pointer hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[p.status] || ""}`}>{p.status.replace("_", " ")}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.description || "No description"}</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Budget: GHS {Number(p.budget).toLocaleString()}</span>
                      <span>Spent: GHS {Number(p.actual_cost).toLocaleString()}</span>
                    </div>
                    {p.budget > 0 && <Progress value={Math.min((p.actual_cost / p.budget) * 100, 100)} className="h-1.5" />}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="text-center py-12 text-muted-foreground"><FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No projects yet. Create one to start tracking work.</p></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="tasks"><Card><CardContent className="text-center py-12 text-muted-foreground"><ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Task management — create a project first.</p></CardContent></Card></TabsContent>
        <TabsContent value="timeline"><Card><CardContent className="text-center py-12 text-muted-foreground"><Clock className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Gantt chart timeline — coming soon.</p></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}

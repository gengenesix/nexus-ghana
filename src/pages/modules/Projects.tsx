import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, ListTodo, Clock, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ProjectDialog from "@/components/projects/ProjectDialog";
import { GanttChart } from "@/components/projects/GanttChart";

export default function Projects() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("projects");
  const [dialog, setDialog] = useState<{ open: boolean; project?: any }>({ open: false });
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["project_tasks", business?.id],
    queryFn: async () => {
      const projectIds = projects.map((p: any) => p.id);
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase.from("project_tasks").select("*").in("project_id", projectIds).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: projects.length > 0,
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projects"] }); toast.success("Project deleted"); },
    onError: (err: any) => toast.error(err.message),
  });

  const statusColors: Record<string, string> = { planning: "bg-blue-500/10 text-blue-500", in_progress: "bg-yellow-500/10 text-yellow-500", review: "bg-purple-500/10 text-purple-500", completed: "bg-green-500/10 text-green-500", on_hold: "bg-orange-500/10 text-orange-500" };

  const filteredTasks = selectedProject ? tasks.filter((t: any) => t.project_id === selectedProject) : tasks;
  const selectedProj = selectedProject ? projects.find((p: any) => p.id === selectedProject) : null;

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
          <TabsTrigger value="timeline">Timeline (Gantt)</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Projects</h3><Button onClick={() => setDialog({ open: true })}><Plus className="h-4 w-4 mr-1" />New Project</Button></div>
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((p: any) => (
                <Card key={p.id} className="hover:border-primary/50 group relative cursor-pointer" onClick={() => { setSelectedProject(p.id); setActiveTab("tasks"); }}>
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
                    <div className="absolute top-2 right-12 opacity-0 group-hover:opacity-100 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setDialog({ open: true, project: p }); }}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteProject.mutate(p.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="text-center py-12 text-muted-foreground"><FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No projects yet. Create one to start tracking work.</p></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Tasks</h3>
              {selectedProject && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedProject(null)}>
                  {selectedProj?.name} ✕
                </Badge>
              )}
            </div>
          </div>
          <Card><CardContent className="pt-4">
            {filteredTasks.length > 0 ? (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Project</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Start</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Hours</TableHead></TableRow></TableHeader>
                <TableBody>{filteredTasks.map((t: any) => {
                  const proj = projects.find((p: any) => p.id === t.project_id);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell className="text-muted-foreground">{proj?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{t.priority || "medium"}</Badge></TableCell>
                      <TableCell><Badge className={`capitalize ${statusColors[t.status] || ""}`}>{t.status.replace("_", " ")}</Badge></TableCell>
                      <TableCell>{t.start_date ? format(new Date(t.start_date), "MMM d") : "—"}</TableCell>
                      <TableCell>{t.due_date ? format(new Date(t.due_date), "MMM d") : "—"}</TableCell>
                      <TableCell className="text-right font-mono">{t.hours_actual || 0}/{t.hours_estimated || 0}</TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>{selectedProject ? "No tasks for this project." : "No tasks yet."}</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">Gantt Timeline</h3>
            {projects.map((p: any) => (
              <Badge
                key={p.id}
                variant={selectedProject === p.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)}
              >
                {p.name}
              </Badge>
            ))}
          </div>
          <GanttChart
            tasks={filteredTasks}
            projectStart={selectedProj?.start_date}
            projectEnd={selectedProj?.end_date}
          />
        </TabsContent>
      </Tabs>

      <ProjectDialog open={dialog.open} onOpenChange={(o) => setDialog({ open: o })} project={dialog.project} />
    </div>
  );
}

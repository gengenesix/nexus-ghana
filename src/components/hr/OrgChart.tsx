import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OrgChartProps {
  employees: any[];
}

interface OrgNode {
  id: string;
  name: string;
  position: string;
  department: string;
  status: string;
  children: OrgNode[];
}

function buildOrgTree(employees: any[]): OrgNode[] {
  const deptGroups: Record<string, any[]> = {};
  employees.forEach((e) => {
    const dept = e.department || "Unassigned";
    (deptGroups[dept] ??= []).push(e);
  });

  return Object.entries(deptGroups).map(([dept, emps]) => ({
    id: `dept-${dept}`,
    name: dept,
    position: "Department",
    department: dept,
    status: "active",
    children: emps.map((e: any) => ({
      id: e.id,
      name: `${e.first_name} ${e.last_name}`,
      position: e.position || "Staff",
      department: dept,
      status: e.status,
      children: [],
    })),
  }));
}

function OrgNodeCard({ node, level }: { node: OrgNode; level: number }) {
  const isDept = level === 0;

  return (
    <div className="flex flex-col items-center">
      <Card className={`${isDept ? "border-primary/30 bg-primary/5" : "hover:border-primary/30"} transition-colors min-w-[160px]`}>
        <CardContent className="p-3 text-center">
          <p className={`font-medium text-sm ${isDept ? "text-primary" : ""}`}>{node.name}</p>
          <p className="text-[11px] text-muted-foreground">{node.position}</p>
          {!isDept && (
            <Badge variant={node.status === "active" ? "default" : "secondary"} className="text-[10px] mt-1">
              {node.status}
            </Badge>
          )}
        </CardContent>
      </Card>
      {node.children.length > 0 && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-4 flex-wrap justify-center">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-border" />
                <OrgNodeCard node={child} level={level + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChart({ employees }: OrgChartProps) {
  const tree = buildOrgTree(employees.filter((e: any) => e.status === "active"));

  if (tree.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <p>No active employees to display. Add employees with departments.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Organizational Chart</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="flex gap-8 justify-center py-4 min-w-max">
          {tree.map((dept) => (
            <OrgNodeCard key={dept.id} node={dept} level={0} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

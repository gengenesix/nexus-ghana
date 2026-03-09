import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseCsv, generateCsvTemplate } from "@/lib/export";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Download, FileText, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "products" | "customers";
}

const FIELD_MAPS = {
  products: {
    required: ["name"],
    fields: { "name": "name", "sku": "sku", "cost price": "cost_price", "selling price": "selling_price", "quantity": "qty", "reorder level": "reorder_level" },
  },
  customers: {
    required: ["name"],
    fields: { "name": "name", "phone": "phone", "email": "email", "region": "region", "notes": "notes" },
  },
};

export default function CsvImportDialog({ open, onOpenChange, type }: CsvImportDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });

  const fieldMap = FIELD_MAPS[type];

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setStep("preview");
    };
    reader.readAsText(file);
  }, []);

  const downloadTemplate = () => {
    const csv = generateCsvTemplate(type);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${type}_template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const mapRow = (row: string[]): Record<string, any> | null => {
    const record: Record<string, any> = { business_id: business!.id };
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    for (const [csvField, dbField] of Object.entries(fieldMap.fields)) {
      const idx = normalizedHeaders.indexOf(csvField);
      if (idx !== -1 && row[idx]) {
        const val = row[idx];
        if (["cost_price", "selling_price", "qty", "reorder_level"].includes(dbField)) {
          record[dbField] = Number(val) || 0;
        } else {
          record[dbField] = val;
        }
      }
    }

    // Check required fields
    for (const req of fieldMap.required) {
      if (!record[req]) return null;
    }
    return record;
  };

  const doImport = async () => {
    setStep("importing");
    let success = 0, failed = 0;

    const records = rows.map(mapRow).filter(Boolean) as Record<string, any>[];
    const tableName = type === "products" ? "products" : "customers";

    // Batch insert in chunks of 50
    for (let i = 0; i < records.length; i += 50) {
      const chunk = records.slice(i, i + 50);
      const { error } = await supabase.from(tableName).insert(chunk as any);
      if (error) {
        failed += chunk.length;
      } else {
        success += chunk.length;
      }
    }
    failed += rows.length - records.length; // unmappable rows

    setImportResult({ success, failed });
    setStep("done");
    queryClient.invalidateQueries({ queryKey: [tableName] });
    if (success > 0) toast.success(`Imported ${success} ${type}`);
  };

  const reset = () => {
    setStep("upload"); setHeaders([]); setRows([]); setImportResult({ success: 0, failed: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Import {type === "products" ? "Products" : "Customers"}</DialogTitle>
          <DialogDescription>Upload a CSV file to bulk-import records</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drop a CSV file or click to browse</p>
              <input type="file" accept=".csv" onChange={handleFile} className="block mx-auto text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Need a template?</p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download Template
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{rows.length} rows found</Badge>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>Back</Button>
                <Button size="sm" onClick={doImport}>Import {rows.length} Records</Button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>{headers.map((h, i) => <TableHead key={i} className="text-xs">{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 20).map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => <TableCell key={ci} className="text-xs">{cell}</TableCell>)}
                    </TableRow>
                  ))}
                  {rows.length > 20 && (
                    <TableRow><TableCell colSpan={headers.length} className="text-center text-xs text-muted-foreground">... and {rows.length - 20} more rows</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importing records...</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">{importResult.success} records imported</p>
              {importResult.failed > 0 && (
                <p className="text-sm text-destructive flex items-center gap-1 justify-center mt-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {importResult.failed} rows failed
                </p>
              )}
            </div>
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

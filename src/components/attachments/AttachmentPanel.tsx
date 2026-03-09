import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Trash2, Loader2, FileText, Image, File } from "lucide-react";
import { toast } from "sonner";

interface AttachmentPanelProps {
  recordType: string;
  recordId: string;
}

const iconForMime = (mime: string) => {
  if (mime?.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mime?.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
};

export default function AttachmentPanel({ recordType, recordId }: AttachmentPanelProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ["attachments", recordType, recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("business_id", business!.id)
        .eq("record_type", recordType)
        .eq("record_id", recordId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business && !!recordId,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business) return;
    setUploading(true);
    try {
      const path = `${business.id}/${recordType}/${recordId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("attachments").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("attachments").getPublicUrl(path);
      const { error } = await supabase.from("attachments").insert({
        business_id: business.id,
        record_type: recordType,
        record_id: recordId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["attachments", recordType, recordId] });
      toast.success("File attached");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (att: any) => {
      const { error } = await supabase.from("attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", recordType, recordId] });
      toast.success("Attachment removed");
    },
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Attachments ({attachments.length})</p>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          Upload
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((att: any) => (
            <div key={att.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              {iconForMime(att.mime_type)}
              <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:underline text-primary">
                {att.file_name}
              </a>
              <span className="text-xs text-muted-foreground">{formatSize(att.file_size || 0)}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(att)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

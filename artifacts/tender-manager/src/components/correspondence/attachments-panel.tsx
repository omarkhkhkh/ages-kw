import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { correspondenceApi } from "@/lib/api";
import { objectPathToUrl } from "@/components/file-upload";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, Download, Trash2, Loader2, UploadCloud } from "lucide-react";

const G = "#D4A534";
const GD = "#A87C20";
const GR = "#132a18";

interface Props {
  letterId: number;
}

export default function AttachmentsPanel({ letterId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["correspondence-attachments", letterId],
    queryFn: () => correspondenceApi.listAttachments(letterId),
  });

  const addMutation = useMutation({
    mutationFn: (data: { fileName: string; fileUrl: string; mimeType?: string; fileSize?: number }) =>
      correspondenceApi.addAttachment(letterId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["correspondence-attachments", letterId] });
      toast({ title: "✅ تم رفع المرفق" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: number) => correspondenceApi.deleteAttachment(letterId, attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["correspondence-attachments", letterId] }),
  });

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      addMutation.mutate({
        fileName: res.metadata.name,
        fileUrl: res.objectPath,
        mimeType: res.metadata.contentType,
        fileSize: res.metadata.size,
      });
    },
    onError: (err) => toast({ title: "فشل رفع الملف", description: err.message, variant: "destructive" }),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
    e.target.value = "";
  };

  return (
    <div dir="rtl">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Paperclip size={14} color={GD} />
          <span style={{ fontSize: 13, fontWeight: 800, color: GR }}>المرفقات</span>
          <span style={{ fontSize: 11.5, color: "#9ca3af" }}>({attachments.length})</span>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7,
            background: "white", border: `1px solid ${G}88`, color: GD, fontSize: 11.5, fontWeight: 700,
            cursor: isUploading ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}
        >
          {isUploading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <UploadCloud size={12} />}
          {isUploading ? `${progress}%` : "إضافة مرفق"}
        </button>
        <input ref={inputRef} type="file" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} onChange={handleFile} />
      </div>

      {isLoading ? (
        <div style={{ fontSize: 12, color: "#9ca3af" }}>جارِ التحميل...</div>
      ) : attachments.length === 0 ? (
        <div style={{ fontSize: 12, color: "#9ca3af", padding: "10px 0" }}>لا توجد مرفقات</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {attachments.map((att: any) => (
            <div
              key={att.id}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                border: "1px solid #eee", fontSize: 12,
              }}
            >
              <Paperclip size={12} color="#9ca3af" />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>
                {att.fileName}
              </span>
              <a
                href={objectPathToUrl(att.fileUrl) ?? correspondenceApi.downloadUrl(att.id)}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb", display: "flex" }}
              >
                <Download size={13} />
              </a>
              <button
                onClick={() => deleteMutation.mutate(att.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", display: "flex", padding: 0 }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

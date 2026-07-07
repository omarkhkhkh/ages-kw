/**
 * FileUpload — reusable file upload button using Replit Object Storage.
 *
 * Props:
 *   objectPath  — current stored path (e.g. "/objects/uploads/uuid")
 *   onChange    — called with new objectPath (or null on clear)
 *   accept      — MIME filter, default "application/pdf,image/*"
 *   label       — optional button label override
 *   disabled    — disable the control
 */
import { useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { Paperclip, Upload, X, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";

const G  = "#D4A534";
const GD = "#A87C20";

interface Props {
  objectPath?: string | null;
  onChange: (path: string | null) => void;
  accept?: string;
  label?: string;
  disabled?: boolean;
}

/** Convert stored objectPath to a browser-accessible URL */
export function objectPathToUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  // already a full URL (legacy http link from old text field)
  if (objectPath.startsWith("http")) return objectPath;
  // presigned object path
  return `/api/storage${objectPath}`;
}

/** Guess a short display name from the objectPath or original URL */
function displayName(path: string): string {
  if (path.startsWith("http")) {
    try { return decodeURIComponent(new URL(path).pathname.split("/").pop() || "رابط خارجي"); } catch { return "رابط خارجي"; }
  }
  return "ملف محفوظ";
}

export default function FileUpload({ objectPath, onChange, accept = "application/pdf,image/*,.doc,.docx,.xls,.xlsx", label = "رفع ملف", disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { uploadFile, isUploading, progress, error } = useUpload({
    onSuccess: (res: { objectPath: string }) => onChange(res.objectPath),
    onError:   (err: Error) => console.error("upload error", err),
  });

  const handleFile = async (file: File) => {
    if (!file) return;
    await uploadFile(file);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";       // allow re-selecting the same file
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const viewUrl = objectPathToUrl(objectPath);

  /* ── Uploaded / existing file chip ── */
  if (objectPath && !isUploading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${G}44`, background: "#fdf8ec", flexWrap: "wrap" }}>
        <CheckCircle2 size={15} color="#16a34a" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "#374151", flex: 1, wordBreak: "break-all" }}>{displayName(objectPath)}</span>
        {viewUrl && (
          <a href={viewUrl} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#2563eb", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            <ExternalLink size={11} /> عرض
          </a>
        )}
        {!disabled && (
          <>
            <button type="button" onClick={() => inputRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, background: "white", border: `1px solid ${G}88`, color: GD, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <Upload size={11} /> تغيير
            </button>
            <button type="button" onClick={() => onChange(null)}
              style={{ display: "flex", alignItems: "center", padding: 4, borderRadius: 6, background: "#fff1f2", border: "1px solid #fecaca", color: "#dc2626", cursor: "pointer" }}>
              <X size={12} />
            </button>
          </>
        )}
        <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={handleInput} />
      </div>
    );
  }

  /* ── Uploading state ── */
  if (isUploading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#f9fafb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={15} color={G} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>جاري الرفع... {progress}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "#e5e7eb", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg,${G},${GD})`, width: `${progress}%`, transition: "width 0.3s" }} />
        </div>
      </div>
    );
  }

  /* ── Drop zone / upload button ── */
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 6, padding: "16px 14px", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
        border: `2px dashed ${dragOver ? G : "#d1d5db"}`,
        background: dragOver ? "#fdf8ec" : "#fafafa",
        transition: "all 0.15s", opacity: disabled ? 0.6 : 1,
      }}>
      <Paperclip size={18} color={dragOver ? G : "#9ca3af"} />
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: dragOver ? GD : "#374151" }}>{label}</span>
        <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>اسحب ملفاً هنا أو انقر للاختيار</p>
        <p style={{ fontSize: 10, color: "#9ca3af", margin: "1px 0 0" }}>PDF • صور • Word • Excel</p>
      </div>
      {error && <p style={{ fontSize: 11, color: "#dc2626", margin: 0 }}>{error.message}</p>}
      <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={handleInput} disabled={disabled} />
    </div>
  );
}

/* CSS for spin animation — injected once */
if (typeof document !== "undefined" && !document.getElementById("fu-spin")) {
  const s = document.createElement("style");
  s.id = "fu-spin";
  s.textContent = "@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}

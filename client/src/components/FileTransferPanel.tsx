import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import {
  Download,
  UploadCloud,
  File,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Search,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import type { FileMetadata } from "@shared/schema";
import { getDownloadUrl, getPreviewUrl, MAX_FILE_SIZE } from "@/hooks/use-files";
import { useToast } from "@/hooks/use-toast";

interface FileTransferPanelProps {
  files: FileMetadata[];
  onUpload: (file: File) => void;
  isUploading: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string, filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return <ImageIcon className="w-5 h-5 text-indigo-600" />;
  }
  if (mimeType === "application/pdf" || ext === "pdf") {
    return <FileText className="w-5 h-5 text-rose-600" />;
  }
  if (
    mimeType.startsWith("text/") ||
    ["txt", "md", "json", "js", "ts", "py", "html", "css", "yaml", "yml"].includes(ext)
  ) {
    return <FileCode className="w-5 h-5 text-emerald-600" />;
  }
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) {
    return <FileArchive className="w-5 h-5 text-amber-600" />;
  }
  return <File className="w-5 h-5 text-slate-500" />;
}

export function FileTransferPanel({
  files,
  onUpload,
  isUploading,
}: FileTransferPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [textPreviewContent, setTextPreviewContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        if (file.size > MAX_FILE_SIZE) {
          toast({
            variant: "destructive",
            title: "File Too Large",
            description: `"${file.name}" exceeds the 50MB upload limit.`,
          });
          continue;
        }
        onUpload(file);
      }
    },
    [onUpload, toast]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: false,
    maxSize: MAX_FILE_SIZE,
  });

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const query = searchQuery.toLowerCase();
    return files.filter((f) => f.originalName.toLowerCase().includes(query));
  }, [files, searchQuery]);

  const handleOpenPreview = async (file: FileMetadata) => {
    setPreviewFile(file);
    setTextPreviewContent(null);

    const isText =
      file.mimeType.startsWith("text/") ||
      ["txt", "md", "json", "js", "ts", "py", "html", "css"].includes(
        file.originalName.split(".").pop()?.toLowerCase() || ""
      );

    if (isText) {
      setIsLoadingPreview(true);
      try {
        const previewUrl = getPreviewUrl(file.id);
        const res = await fetch(previewUrl);
        if (res.ok) {
          const text = await res.text();
          setTextPreviewContent(text);
        }
      } catch (err) {
        console.error("Failed to load text preview:", err);
      } finally {
        setIsLoadingPreview(false);
      }
    }
  };

  const isImagePreview = (file: FileMetadata) =>
    file.mimeType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
      file.originalName.split(".").pop()?.toLowerCase() || ""
    );

  const isPdfPreview = (file: FileMetadata) =>
    file.mimeType === "application/pdf" ||
    file.originalName.toLowerCase().endsWith(".pdf");

  return (
    <>
      <Card className="h-full border border-slate-200/90 shadow-sm flex flex-col overflow-hidden bg-white rounded-2xl">
        {/* Header */}
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100/80">
                <UploadCloud className="w-4 h-4" />
              </span>
              <span>File Transfer</span>
            </CardTitle>

            <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-5 flex flex-col gap-4 overflow-hidden">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-150
              flex flex-col items-center justify-center gap-2
              ${
                isDragActive
                  ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]"
                  : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
              }
            `}
          >
            <input {...getInputProps()} />

            <div
              className={`p-2.5 rounded-full ${
                isDragActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              <UploadCloud className="w-6 h-6" />
            </div>

            <div className="space-y-0.5">
              <p className="text-xs md:text-sm font-semibold text-slate-800">
                {isDragActive ? "Drop files to upload instantly" : "Click or drag files to upload"}
              </p>
              <p className="text-[11px] text-slate-500">
                Documents, images, code &bull; Max 25MB per file
              </p>
            </div>

            {isUploading && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex items-center justify-center rounded-xl z-10">
                <div className="flex items-center gap-2.5 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-lg">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Uploading to session...</span>
                </div>
              </div>
            )}
          </div>

          {/* Search bar if multiple files */}
          {files.length > 2 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search transferred files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg border-slate-200 bg-slate-50/50"
              />
            </div>
          )}

          {/* File List */}
          <div className="flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1 pr-2">
              {filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-2">
                  <File className="w-10 h-10 stroke-1 text-slate-300" />
                  <p className="text-xs">
                    {searchQuery
                      ? "No files matching your search"
                      : "No files uploaded to this session yet"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pb-2">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                          {getFileIcon(file.mimeType, file.originalName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="font-medium text-xs text-slate-900 truncate leading-snug"
                            title={file.originalName}
                          >
                            {file.originalName}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {formatBytes(file.size)} &bull;{" "}
                            {formatDistanceToNow(new Date(file.uploadedAt || Date.now()), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Preview button */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenPreview(file)}
                          className="h-8 w-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Preview file"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {/* Download button */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                          title="Download file"
                          asChild
                        >
                          <a
                            href={getDownloadUrl(file.id)}
                            download={file.originalName}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-5 rounded-2xl">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-sm font-semibold truncate text-slate-900 pr-6">
              {previewFile?.originalName}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-mono">
              {previewFile ? formatBytes(previewFile.size) : ""} &bull;{" "}
              {previewFile?.mimeType}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-3 min-h-[200px] flex items-center justify-center">
            {previewFile && isImagePreview(previewFile) && (
              <img
                src={getPreviewUrl(previewFile.id)}
                alt={previewFile.originalName}
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-xs"
              />
            )}

            {previewFile && isPdfPreview(previewFile) && (
              <iframe
                src={getPreviewUrl(previewFile.id)}
                title={previewFile.originalName}
                className="w-full h-[60vh] rounded-lg border border-slate-200"
              />
            )}

            {previewFile && textPreviewContent !== null && (
              <pre className="w-full max-h-[60vh] overflow-auto p-4 text-xs font-mono bg-slate-900 text-slate-100 rounded-lg leading-relaxed whitespace-pre-wrap select-text">
                {textPreviewContent}
              </pre>
            )}

            {previewFile && isLoadingPreview && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                <span>Loading preview...</span>
              </div>
            )}

            {previewFile &&
              !isImagePreview(previewFile) &&
              !isPdfPreview(previewFile) &&
              textPreviewContent === null &&
              !isLoadingPreview && (
                <div className="text-center space-y-3 py-6">
                  <File className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-600">
                    Preview is not available for this file format. You can download it directly.
                  </p>
                </div>
              )}
          </div>

          <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewFile(null)}
              className="text-xs rounded-lg"
            >
              Close
            </Button>

            {previewFile && (
              <Button size="sm" className="text-xs rounded-lg bg-slate-900 hover:bg-slate-800" asChild>
                <a
                  href={getDownloadUrl(previewFile.id)}
                  download={previewFile.originalName}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download File
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

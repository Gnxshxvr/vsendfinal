import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Download, File, FileIcon, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import type { FileMetadata } from "@shared/schema";
import { getDownloadUrl } from "@/hooks/use-files";
import { motion, AnimatePresence } from "framer-motion";

interface FileTransferPanelProps {
  files: FileMetadata[];
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export function FileTransferPanel({ files, onUpload, isUploading }: FileTransferPanelProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => onUpload(file));
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <Card className="h-full border-0 shadow-lg shadow-black/5 flex flex-col bg-white/50 backdrop-blur-sm">
      <CardHeader className="border-b border-border/50 bg-white/50 px-6 py-4">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="bg-blue-500/10 text-blue-600 p-2 rounded-lg">
            <UploadCloud className="w-4.5 h-4.5" />
          </span>
          File Transfer
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 p-6 flex flex-col gap-6">
        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
            flex flex-col items-center justify-center gap-2 group
            ${isDragActive 
              ? "border-primary bg-primary/5 scale-[0.99]" 
              : "border-border hover:border-primary/50 hover:bg-secondary/50"
            }
          `}
        >
          <input {...getInputProps()} />
          <div className={`p-4 rounded-full bg-secondary transition-colors group-hover:bg-primary/10 ${isDragActive ? "bg-primary/20" : ""}`}>
            <UploadCloud className={`w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors ${isDragActive ? "text-primary" : ""}`} />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {isDragActive ? "Drop files here" : "Click or drag files to upload"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Any file type supported
            </p>
          </div>
          {isUploading && (
             <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
               <div className="flex flex-col items-center gap-2">
                 <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                 <span className="text-sm font-medium">Uploading...</span>
               </div>
             </div>
          )}
        </div>

        {/* File List */}
        <div className="flex-1 min-h-0 flex flex-col">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1 uppercase tracking-wider text-[11px]">
            Transferred Files ({files.length})
          </h3>
          
          <ScrollArea className="flex-1 -mx-4 px-4">
            <AnimatePresence initial={false}>
              {files.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-50"
                >
                  <File className="w-12 h-12 mb-2 stroke-1" />
                  <p className="text-sm">No files shared yet</p>
                </motion.div>
              ) : (
                <div className="space-y-2 pb-4">
                  {files.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <FileIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate pr-4 text-foreground">
                            {file.originalName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB • {formatDistanceToNow(new Date(file.uploadedAt || Date.now()), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
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
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}


import { Session, FileMetadata, insertSessionSchema, sessions } from "@shared/schema";
import { randomBytes } from "crypto";

export interface IStorage {
  createSession(): Promise<Session>;
  getSessionByCode(code: string): Promise<Session | undefined>;
  saveFile(file: FileMetadata): Promise<FileMetadata>;
  getFiles(sessionId: number): Promise<FileMetadata[]>;
  getFile(fileId: number): Promise<FileMetadata | undefined>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private sessionFiles: Map<number, FileMetadata[]>;
  private files: Map<number, FileMetadata>;
  private currentSessionId: number;
  private currentFileId: number;

  constructor() {
    this.sessions = new Map();
    this.sessionFiles = new Map();
    this.files = new Map();
    this.currentSessionId = 1;
    this.currentFileId = 1;
  }

  async createSession(): Promise<Session> {
    const id = this.currentSessionId++;
    // Generate a 6-digit numeric code
    let code = "";
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.sessions.has(code));

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const session: Session = {
      id,
      code,
      createdAt: new Date(),
      expiresAt,
    };

    this.sessions.set(code, session);
    return session;
  }

  async getSessionByCode(code: string): Promise<Session | undefined> {
    const session = this.sessions.get(code);
    if (!session) return undefined;
    
    // Check expiration
    if (new Date() > session.expiresAt) {
      this.sessions.delete(code);
      return undefined;
    }
    
    return session;
  }

  async saveFile(file: FileMetadata): Promise<FileMetadata> {
    // Note: To use Cloudinary, you should wrap this in the Cloudinary SDK upload.
    // Example: 
    // const result = await cloudinary.uploader.upload(file.path);
    // file.filename = result.secure_url; 
    
    const id = this.currentFileId++;
    const newFile: FileMetadata = { ...file, id };
    
    this.files.set(id, newFile);
    
    const currentFiles = this.sessionFiles.get(file.sessionId) || [];
    this.sessionFiles.set(file.sessionId, [...currentFiles, newFile]);
    
    return newFile;
  }

  async getFiles(sessionId: number): Promise<FileMetadata[]> {
    return this.sessionFiles.get(sessionId) || [];
  }

  async getFile(fileId: number): Promise<FileMetadata | undefined> {
    return this.files.get(fileId);
  }
}

export const storage = new MemStorage();

// ── Contratos compartilhados api ↔ web ↔ worker ────────────────────────────────

export type UserRole = "guest" | "producer" | "admin";
export type AlbumStatus = "pending" | "scanning" | "ready" | "error" | "archived";
export type PhotoStatus = "pending" | "processing" | "done" | "error";
export type EnrollmentStatus = "pending" | "done" | "error";
export type MatchStatus = "auto" | "confirmed" | "rejected";

export type Bbox = { x: number; y: number; w: number; h: number };

export interface ApiOk<T> {
  ok: true;
  data: T;
}
export interface ApiErr {
  ok: false;
  error: string;
}
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  hasEnrollment: boolean;
  enrollmentStatus: EnrollmentStatus | null;
  googleConnected: boolean;
  // true se falta aceitar os Termos/Privacidade (nunca aceitou ou versão mudou)
  needsTermsAcceptance: boolean;
}

export interface AlbumSummary {
  id: string;
  name: string;
  status: AlbumStatus;
  error: string | null;
  driveFolderId: string;
  photoCount: number;
  doneCount: number;
  faceCount: number;
  peopleCount: number;
  watermarkEnabled: boolean;
  scannedAt: string | null;
  createdAt: string;
}

// cluster de faces (mesma pessoa) dentro de um álbum
export interface PersonSummary {
  id: string;
  faceCount: number;
  photoCount: number;
  coverCropUrl: string | null;
}

export interface PhotoItem {
  id: string;
  name: string;
  status: PhotoStatus;
  thumbUrl: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
  faceCount: number;
  takenAt: string | null;
}

export interface ScanStatus {
  album: AlbumStatus;
  total: number;
  done: number;
  errors: number;
  pending: number;
}

export interface MyAlbum {
  id: string;
  name: string;
  matchCount: number;
  coverUrl: string | null; // thumb de uma foto matched do próprio usuário
}

export interface MyPhoto {
  id: string;
  name: string;
  thumbUrl: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
  faceId: string;
  distance: number | null;
  matchStatus: "auto" | "confirmed";
  // pra desenhar o quadrado sobre o rosto (coords em px da foto original)
  faceBbox: Bbox | null;
  photoWidth: number | null;
  photoHeight: number | null;
  takenAt: string | null;
}

// enrollment do usuário logado + métricas de "força do perfil" (GET /api/enrollment)
export interface EnrollmentInfo {
  id: string;
  status: EnrollmentStatus;
  error: string | null;
  source: string;
  frameCount: number;
  confirmedCount: number;
  strength: number; // 0-100
  createdAt: string;
}

export interface NotificationItem {
  photoId: string;
  albumId: string;
  albumName: string;
  thumbUrl: string | null;
  matchedAt: string;
}

export interface NotificationsResponse {
  unreadCount: number;
  items: NotificationItem[];
}

// foto do álbum completo (guest, "Todas as fotos") com faces pra autoidentificação
export interface AllAlbumFace {
  faceId: string;
  bbox: Bbox;
  claimedByMe: boolean;
}

export interface AllAlbumPhoto {
  id: string;
  name: string;
  thumbUrl: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  faces: AllAlbumFace[];
}

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  hasEnrollment: boolean;
}

// ── Fila Redis (api → worker → api) ────────────────────────────────────────────

export const JOBS_QUEUE = "facelab:jobs";
export const RESULTS_CHANNEL = "facelab:results";

export interface ProcessPhotoJob {
  type: "process_photo";
  photoId: string;
  imagePath: string;
}

export interface EnrollJob {
  type: "enroll";
  enrollmentId: string;
  frameDir: string;
}

export type WorkerJob = ProcessPhotoJob | EnrollJob;

export interface FaceResult {
  bbox: Bbox;
  detScore: number;
  cropPath: string; // relativo a MEDIA_DIR, ex: crops/<uuid>.webp
  embedding: number[]; // 512 floats, L2-normalizado
}

export interface PhotoFacesResult {
  type: "photo_faces";
  photoId: string;
  status: "done" | "error";
  error?: string;
  width?: number;
  height?: number;
  thumbPath?: string; // relativo a MEDIA_DIR
  faces?: FaceResult[];
}

export interface EnrollmentResult {
  type: "enrollment";
  enrollmentId: string;
  status: "done" | "error";
  error?: string;
  embedding?: number[];
  frameCount?: number;
}

export type WorkerResult = PhotoFacesResult | EnrollmentResult;

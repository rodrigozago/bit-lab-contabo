import type {
  EmbroideryProject,
  CreateProjectRequest,
  UpdateProjectRequest,
  ExportRequest,
  ExportJob,
  ApiResponse,
  AnalyzeJobStatus,
  LocalAnalyzeParams,
  EmbroideryElement,
  CanvasSize,
  StitchPreviewJobStatus,
} from "@ponto-studio/shared";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

export const api = {
  projects: {
    list: () => request<EmbroideryProject[]>("/projects"),
    get: (id: string) => request<EmbroideryProject>(`/projects/${id}`),
    create: (body: CreateProjectRequest) =>
      request<EmbroideryProject>("/projects", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: UpdateProjectRequest) =>
      request<EmbroideryProject>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<null>(`/projects/${id}`, { method: "DELETE" }),
  },
  export: {
    create: (body: ExportRequest) =>
      request<ExportJob>("/export", { method: "POST", body: JSON.stringify(body) }),
    poll: (jobId: string) => request<ExportJob>(`/export/${jobId}`),
  },
  analyze: {
    // Análise local (processamento digital, sem IA) — cria o job no worker
    local: async (file: File, params: LocalAnalyzeParams): Promise<{ jobId: string }> => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("colors", String(params.colors));
      fd.append("minRegionPct", String(params.minRegionPct));
      fd.append("detail", String(params.detail));
      fd.append("colorTolerance", String(params.colorTolerance));
      fd.append("maxAreas", String(params.maxAreas));
      const res = await fetch(`${BASE}/analyze/local`, { method: "POST", body: fd });
      const json = (await res.json()) as ApiResponse<{ jobId: string }>;
      if (!json.ok) throw new Error(json.error);
      return json.data;
    },
    poll: (jobId: string) => request<AnalyzeJobStatus>(`/analyze/local/${jobId}`),
  },
  preview: {
    // Gera o preview de linhas de ponto de um elemento (mesmo motor do DST)
    create: (body: { element: EmbroideryElement; canvas: CanvasSize }) =>
      request<{ jobId: string }>("/preview", { method: "POST", body: JSON.stringify(body) }),
    poll: (jobId: string) => request<AnalyzeJobStatus>(`/preview/${jobId}`),
  },
  stitchPreview: {
    // Sequência de pontos do projeto inteiro, pro player de simulação (EXP-2)
    create: (projectId: string) =>
      request<{ jobId: string }>("/stitch-preview", { method: "POST", body: JSON.stringify({ projectId }) }),
    poll: (jobId: string) => request<StitchPreviewJobStatus>(`/stitch-preview/${jobId}`),
  },
  upload: {
    image: async (file: File): Promise<{ fileId: string; url: string }> => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/upload`, { method: "POST", body: fd });
      const json = (await res.json()) as ApiResponse<{ fileId: string; url: string }>;
      if (!json.ok) throw new Error(json.error);
      return json.data;
    },
  },
};

/** Aguarda a análise local terminar e resolve com o SVG resultante. */
export async function pollAnalysisUntilDone(jobId: string, intervalMs = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const job = await api.analyze.poll(jobId);
        if (job.status === "done") {
          clearInterval(timer);
          if (!job.svg) return reject(new Error("Análise terminou sem SVG"));
          resolve(job.svg);
        } else if (job.status === "error") {
          clearInterval(timer);
          reject(new Error(job.errorMessage ?? "Falha na análise da imagem"));
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, intervalMs);
  });
}

/** Aguarda o preview de bordado terminar e resolve com o SVG de pontos. */
export async function pollPreviewUntilDone(jobId: string, intervalMs = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const job = await api.preview.poll(jobId);
        if (job.status === "done") {
          clearInterval(timer);
          if (!job.svg) return reject(new Error("Preview terminou sem SVG"));
          resolve(job.svg);
        } else if (job.status === "error") {
          clearInterval(timer);
          reject(new Error(job.errorMessage ?? "Falha ao gerar preview"));
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, intervalMs);
  });
}

/** Aguarda os dados do player de simulação (EXP-2) e resolve com o pattern. */
export async function pollStitchDataUntilDone(jobId: string, intervalMs = 1000) {
  return new Promise<NonNullable<StitchPreviewJobStatus["pattern"]>>((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const job = await api.stitchPreview.poll(jobId);
        if (job.status === "done") {
          clearInterval(timer);
          if (!job.pattern) return reject(new Error("Stitch preview terminou sem dados"));
          resolve(job.pattern);
        } else if (job.status === "error") {
          clearInterval(timer);
          reject(new Error(job.errorMessage ?? "Falha ao gerar dados do player"));
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, intervalMs);
  });
}

export async function pollUntilDone(
  jobId: string,
  onUpdate: (job: ExportJob) => void,
  intervalMs = 1500
): Promise<ExportJob> {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const job = await api.export.poll(jobId);
        onUpdate(job);
        if (job.status === "done" || job.status === "error") {
          clearInterval(timer);
          if (job.status === "done") resolve(job);
          else reject(new Error(job.errorMessage ?? "Export failed"));
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, intervalMs);
  });
}

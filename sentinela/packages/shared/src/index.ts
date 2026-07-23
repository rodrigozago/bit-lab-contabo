export type TargetType = "candidato" | "partido" | "influenciador";
export type SourceType = "news" | "twitter" | "instagram";
export type Sentiment = "positivo" | "negativo" | "neutro";
export type TenantRole = "owner" | "member";

export interface Tenant {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  criadoEm: string;
}

export interface MonitoringTarget {
  id: string;
  tenantId: string;
  tipo: TargetType;
  nome: string;
  contasRedes: Record<string, string>;
  ativo: boolean;
}

export interface Keyword {
  id: string;
  tenantId: string;
  termo: string;
  ativo: boolean;
}

export interface Mention {
  id: string;
  tenantId: string;
  targetId: string | null;
  keywordId: string | null;
  texto: string;
  url: string | null;
  publicadoEm: string | null;
  sentimento: Sentiment | null;
  score: number | null;
  entidades: string[];
  criadoEm: string;
}

export interface Me {
  sub: string;
  email: string;
  isAdmin: boolean;
  tenants: { id: string; nome: string; slug: string; role: TenantRole }[];
}

export type ScrapeWorker = "ingest-news" | "ingest-social" | "analysis";
export type ScrapeStatus = "ok" | "error";

export interface ScrapeRun {
  id: string;
  worker: ScrapeWorker;
  sourceId: string | null;
  sourceLabel: string | null;
  status: ScrapeStatus;
  mensagem: string | null;
  itens: number;
  executadoEm: string;
}

export interface SourceStatus {
  id: string;
  tipo: SourceType;
  urlOuHandle: string;
  ativo: boolean;
  ultimaExecucao: string | null;
  ultimoStatus: ScrapeStatus | null;
}

export interface SocialAccountSummary {
  id: string;
  username: string;
  ativo: boolean;
  proxyUrl: string | null;
  criadoEm: string;
}

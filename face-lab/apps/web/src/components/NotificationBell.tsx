import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import type { NotificationsResponse } from "@face-lab/shared";
import { api } from "@/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const POLL_MS = 60_000;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// sino com as últimas fotos encontradas — só in-app por ora (sem e-mail)
export function NotificationBell() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [open, setOpen] = useState(false);

  function load() {
    api<NotificationsResponse>("/api/me/notifications").then(setData).catch(() => {});
  }

  useEffect(() => {
    if (!me) return;
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && data && data.unreadCount > 0) {
      await api("/api/me/notifications/seen", { method: "POST", body: JSON.stringify({}) });
      setData((d) => (d ? { ...d, unreadCount: 0 } : d));
    }
  }

  if (!me) return null;
  const unread = data?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Fotos encontradas</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {data?.items.length ? (
            data.items.map((item) => (
              <button
                key={item.photoId}
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(`/me/albums/${item.albumId}`);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden bg-secondary">
                  {item.thumbUrl && <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.albumName}</p>
                  <p className="text-xs text-muted-foreground">{relativeTime(item.matchedAt)}</p>
                </div>
              </button>
            ))
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma foto encontrada ainda.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

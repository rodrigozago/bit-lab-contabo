import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { api } from "../api/client.ts";
import { useToast } from "./Toast.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";

/** Coleta só o que o navegador expõe sem pedir permissão nenhuma (sem
 * geolocalização por GPS — a localização aproximada já vem do IP no
 * backend, ver services/geoip.ts na API). */
function collectBrowserInfo() {
  return {
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

/** Botão flutuante fixo no lado direito da tela — só renderizado quando
 * logado (ver App.tsx, montado dentro do AuthGate). Envia o feedback por
 * e-mail via services/mailClient.ts na API; não fica salvo em lugar
 * nenhum além da caixa de entrada de quem recebe. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const toast = useToast();

  async function handleSubmit() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.feedback.send({ message: message.trim(), browser: collectBrowserInfo() });
      toast.info("Feedback enviado — obrigado!");
      setMessage("");
      setOpen(false);
    } catch {
      toast.error("Não consegui enviar o feedback agora — tente de novo em instantes.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        size="icon"
        variant="secondary"
        className="fixed top-1/2 right-4 z-40 size-11 -translate-y-1/2 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Enviar feedback"
      >
        <MessageCircle className="size-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar feedback</DialogTitle>
            <DialogDescription>
              Conta pra gente o que achou, o que travou ou o que faltou. Vai direto pra quem cuida do produto.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escreva seu feedback aqui..."
            rows={5}
            maxLength={4000}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={sending || !message.trim()}>
              {sending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import type { Meta, StoryObj } from "@storybook/react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const meta: Meta = {
  title: "UI/Overlays",
};
export default meta;

type Story = StoryObj;

export const DialogConfirmacao: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Abrir dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regerar miniaturas?</DialogTitle>
          <DialogDescription>
            Alterar a marca d'água exige reprocessar as 47 miniaturas deste álbum. Isso pode levar alguns minutos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost">Cancelar</Button>
          <Button>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const PopoverNotificacoes: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Notificações</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="border-b p-3 font-medium">Notificações</div>
        <div className="p-3 text-sm">
          <p className="font-medium">Casamento Ana & João</p>
          <p className="text-muted-foreground">12 fotos novas suas · há 2h</p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const SheetMenuMobile: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-64 flex-col gap-y-10">
        <SheetTitle className="text-2xl font-extrabold tracking-tighter">FACE LAB</SheetTitle>
        <nav className="flex flex-col gap-9">
          <span className="w-fit border-b border-foreground pb-1 text-[13px] uppercase tracking-widest">Minhas Fotos</span>
          <span className="w-fit text-[13px] uppercase tracking-widest text-muted-foreground">Meu Rosto</span>
          <span className="w-fit text-[13px] uppercase tracking-widest text-muted-foreground">Álbuns</span>
        </nav>
      </SheetContent>
    </Sheet>
  ),
};

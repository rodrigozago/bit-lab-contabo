import type { Meta, StoryObj } from "@storybook/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const meta: Meta = {
  title: "UI/Data Display",
};
export default meta;

type Story = StoryObj;

export const Avatares: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/80?img=12" />
        <AvatarFallback>JP</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AM</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const ProgressBar: Story = {
  render: () => (
    <div className="w-80 space-y-6">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Força do perfil</span>
          <span className="font-medium">72%</span>
        </div>
        <Progress value={72} className="mt-2" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Indeterminado (processando)</p>
        <Progress className="mt-2 animate-pulse" />
      </div>
    </div>
  ),
};

export const Skeletons: Story = {
  render: () => (
    <div className="w-80 space-y-3">
      <Skeleton className="aspect-[4/3] w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  ),
};

export const TabelaDeUsuarios: Story = {
  render: () => (
    <Table className="w-[560px]">
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>joao@exemplo.com</TableCell>
          <TableCell><Badge variant="secondary">producer</Badge></TableCell>
          <TableCell><Badge variant="free">FREE</Badge></TableCell>
        </TableRow>
        <TableRow>
          <TableCell>ana@exemplo.com</TableCell>
          <TableCell><Badge variant="secondary">guest</Badge></TableCell>
          <TableCell><Badge>Ativo</Badge></TableCell>
        </TableRow>
        <TableRow>
          <TableCell>admin@exemplo.com</TableCell>
          <TableCell><Badge>admin</Badge></TableCell>
          <TableCell><Badge variant="premium">Premium</Badge></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

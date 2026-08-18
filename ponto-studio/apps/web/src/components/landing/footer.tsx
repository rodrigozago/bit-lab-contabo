import { ModeToggle } from "@/components/mode-toggle";
import { Logo } from "@/components/logo";
import {
  Footer as FooterContainer,
  FooterBottom,
  FooterColumn,
  FooterContent,
} from "@/components/ui/footer";
import { Section } from "@/components/ui/section";

const COLUMNS = [
  {
    title: "Produto",
    links: [
      { text: "Recursos", href: "#recursos" },
      { text: "Como funciona", href: "#como-funciona" },
      { text: "Gratuito", href: "#precos" },
      { text: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Conta",
    links: [
      { text: "Entrar", href: "/app" },
      { text: "Criar conta", href: "/app" },
    ],
  },
  {
    title: "Legal",
    links: [
      { text: "Termos de uso", href: "#" },
      { text: "Privacidade", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <Section className="border-b-0 pb-0">
      <div className="max-w-container mx-auto">
        <FooterContainer>
          <FooterContent>
            <FooterColumn className="col-span-2 sm:col-span-3 md:col-span-1">
              <a href="/" className="flex items-center gap-2 text-xl font-bold">
                <Logo size={28} variant="transparent" />
                Bordado Digital
              </a>
              <p className="text-muted-foreground text-sm text-balance">
                Digitalize bordados direto do navegador.
              </p>
            </FooterColumn>
            {COLUMNS.map((column) => (
              <FooterColumn key={column.title}>
                <h3 className="text-sm font-semibold">{column.title}</h3>
                {column.links.map((link) => (
                  <a
                    key={`${column.title}-${link.text}`}
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm"
                  >
                    {link.text}
                  </a>
                ))}
              </FooterColumn>
            ))}
          </FooterContent>
          <FooterBottom>
            <span>© {new Date().getFullYear()} Bordado Digital. Todos os direitos reservados.</span>
            <ModeToggle variant="ghost" />
          </FooterBottom>
        </FooterContainer>
      </div>
    </Section>
  );
}

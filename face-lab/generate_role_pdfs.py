#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera 2 PDFs para Face Lab Alpha:
1. Producer (Fotógrafo/Produtor de Eventos)
2. Guest/End User (Cliente/Convidado)
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Image as RLImage, Preformatted
)
from reportlab.lib import colors
from io import BytesIO

def create_producer_pdf():
    """Cria PDF para Producer (Fotógrafo/Produtor de Eventos)"""

    doc = SimpleDocTemplate(
        "Face_Lab_Producer_Guide.pdf",
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=1*inch,
        bottomMargin=0.75*inch,
    )

    story = []
    styles = getSampleStyleSheet()

    # Estilos customizados
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=HexColor('#1e40af'),
        spaceAfter=12,
        alignment=1,  # center
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=HexColor('#3b82f6'),
        spaceAfter=10,
        spaceBefore=12,
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        alignment=4,  # justify
    )

    # Título
    story.append(Paragraph("Face Lab — Guia do Producer 🐱⚡", title_style))
    story.append(Paragraph("Versão Alpha: Gato-Veloz-v0.1", styles['Normal']))
    story.append(Spacer(1, 0.3*inch))

    # Seção 1: O que é Face Lab?
    story.append(Paragraph("O que é Face Lab?", heading_style))
    story.append(Paragraph(
        """Face Lab é uma plataforma revolucionária que transforma pastas de fotos de eventos em galerias personalizadas por pessoa. Você conecta seu Google Drive, criamos álbuns automaticamente, e seus convidados recebem suas próprias fotos sem você precisar fazer seleção manual.""",
        body_style
    ))
    story.append(Spacer(1, 0.2*inch))

    # Seção 2: Quem é o Producer?
    story.append(Paragraph("Quem é o Producer?", heading_style))
    story.append(Paragraph(
        """<b>Producer = Fotógrafo ou Produtor de Eventos</b><br/>
        Você é o producer se:<br/>
        • É fotógrafo e tira fotos de eventos<br/>
        • É produtor/organizador de eventos (casamentos, formaturas, festas)<br/>
        • Quer compartilhar fotos de forma inteligente com os participantes<br/>
        • Tem uma pasta no Google Drive com as fotos do evento<br/>
        <br/>
        <b>Seu papel no Face Lab:</b><br/>
        Conectar seu Google Drive → criar álbuns → face lab faz o resto!""",
        body_style
    ))
    story.append(Spacer(1, 0.2*inch))

    # Seção 3: Por que usar Face Lab?
    story.append(Paragraph("Por que usar Face Lab?", heading_style))

    benefits = [
        ["✅ Sem Trabalho Manual", "Não precisa selecionar fotos de cada pessoa — face lab faz automaticamente"],
        ["✅ Satisfação Total", "Seus convidados amam encontrar suas fotos em minutos"],
        ["✅ Privacidade Garantida", "Cada um vê só suas fotos — não expõe rostos de terceiros"],
        ["✅ Mais Negócios", "Convidados compartilham + indicam seus serviços"],
        ["✅ Fotos Sempre no Drive", "Suas fotos originais ficam seguras no seu Google Drive"],
    ]

    table = Table(benefits, colWidths=[1.5*inch, 4*inch])
    table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, HexColor('#f3f4f6')]),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.3*inch))

    # PAGE BREAK
    story.append(PageBreak())

    # Seção 4: Como Começar
    story.append(Paragraph("Como Começar — 5 Passos", heading_style))

    steps = [
        ["1", "Faça login em face.bit-lab.tech com sua conta bit-lab-auth"],
        ["2", "Abra \"Álbuns\" no menu → clique \"Conectar Google Drive\""],
        ["3", "Autorize o Face Lab a ler seu Drive (não modifica nada)"],
        ["4", "Crie novo álbum: nome + link da pasta do Drive"],
        ["5", "Clique \"Re-escanear\" → face lab processa suas fotos"],
    ]

    table = Table(steps, colWidths=[0.5*inch, 5*inch])
    table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#1e40af')),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, HexColor('#e5e7eb')),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.3*inch))

    # Seção 5: O que Acontece Depois?
    story.append(Paragraph("O que Acontece Depois?", heading_style))
    story.append(Paragraph(
        """<b>Você compartilha o link do Face Lab com seus convidados:</b><br/>
        1. Convidados fazem login e cadastram seu rosto (webcam ou fotos)<br/>
        2. Face Lab automaticamente encontra todas as fotos deles<br/>
        3. Ele vê suas fotos em \"Minhas Fotos\" → confirma ou rejeita<br/>
        4. Convidado pode baixar direto do Google Drive<br/>
        <br/>
        <b>Você vê estatísticas em Admin:</b><br/>
        • Quantas fotos foram processadas<br/>
        • Quantos convidados se cadastraram<br/>
        • Série temporal de uso (base para cobranças futuras)""",
        body_style
    ))
    story.append(Spacer(1, 0.2*inch))

    # Seção 6: Dicas Importantes
    story.append(Paragraph("💡 Dicas Importantes", heading_style))

    tips = [
        "<b>Compartilhamento da Pasta:</b> A pasta deve estar compartilhada como \"qualquer pessoa com o link\". Face Lab avisa se não estiver, mas permite criar mesmo assim.",
        "<b>Nomes dos Álbuns:</b> Use nomes descritivos (\"Casamento João & Maria\", \"Festa de 15 Sophia\", \"Formatura 2026\").",
        "<b>Organização:</b> Coloque só fotos do evento em cada pasta — Face Lab processa tudo automaticamente.",
        "<b>Tempo de Processamento:</b> ~50-100 fotos por minuto. Um evento com 500 fotos leva ~5-10 minutos.",
        "<b>Privacidade:</b> Convidados só veem SUAS fotos. Não exposição de terceiros.",
        "<b>Edição de Álbum:</b> Pode mudar nome anytime. Pode deletar (apaga thumbs do disco).",
    ]

    for tip in tips:
        story.append(Paragraph("• " + tip, body_style))
        story.append(Spacer(1, 0.05*inch))

    story.append(Spacer(1, 0.2*inch))

    # PAGE BREAK
    story.append(PageBreak())

    # Seção 7: Perguntas Frequentes
    story.append(Paragraph("Perguntas Frequentes", heading_style))

    faqs = [
        ("P: Minhas fotos originais são armazenadas no Face Lab?",
         "Não! Suas fotos ficam no seu Google Drive. Face Lab só guarda miniaturas e recortes de rosto."),

        ("P: Os convidados conseguem ver fotos de outras pessoas?",
         "Não. Cada um vê apenas suas próprias fotos. Privacidade garantida."),

        ("P: Posso re-escanear se adicionar fotos depois?",
         "Sim! Clique \"Re-escanear\" anytime. Fotos novas serão processadas, as antigas puladas."),

        ("P: Quanto tempo demora processar fotos?",
         "~1 minuto para 50 fotos. Depende do tamanho. Face Lab respeita rate limits pra não sobrecarregar."),

        ("P: Os convidados precisam pagar?",
         "Não. Convidados são grátis. Você (producer) é quem faz a conta."),

        ("P: Posso usar em eventos internos (corporativo)?",
         "Sim! Casamentos, formaturas, festas, eventos corporativos, retiros, qualquer coisa."),
    ]

    for q, a in faqs:
        story.append(Paragraph(f"<b>{q}</b>", body_style))
        story.append(Paragraph(a, body_style))
        story.append(Spacer(1, 0.1*inch))

    story.append(Spacer(1, 0.3*inch))

    # Seção 8: Suporte
    story.append(Paragraph("Precisa de Ajuda?", heading_style))
    story.append(Paragraph(
        """<b>Email:</b> rodrigo@bit-lab.tech<br/>
        <b>GitHub Issues:</b> github.com/rodrigozago/face-lab-issues/issues<br/>
        <br/>
        <b>Documentação Disponível na App:</b><br/>
        • Acesse https://face.bit-lab.tech/resources<br/>
        • Downloads dos guias (Producer e Guest)<br/>
        <br/>
        🐱⚡ <b>Face Lab Alpha — Gato-Veloz-v0.1 — Julho 2026</b>""",
        body_style
    ))

    doc.build(story)
    print("✅ PDF Producer criado: Face_Lab_Producer_Guide.pdf")


def create_guest_pdf():
    """Cria PDF para Guest/End User (Cliente/Convidado)"""

    doc = SimpleDocTemplate(
        "Face_Lab_Guest_Guide.pdf",
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=1*inch,
        bottomMargin=0.75*inch,
    )

    story = []
    styles = getSampleStyleSheet()

    # Estilos customizados
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=HexColor('#1e40af'),
        spaceAfter=12,
        alignment=1,  # center
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=HexColor('#3b82f6'),
        spaceAfter=10,
        spaceBefore=12,
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        alignment=4,  # justify
    )

    # Título
    story.append(Paragraph("Face Lab — Guia do Convidado 🐱⚡", title_style))
    story.append(Paragraph("Versão Alpha: Gato-Veloz-v0.1", styles['Normal']))
    story.append(Spacer(1, 0.3*inch))

    # Seção 1: O que é Face Lab?
    story.append(Paragraph("O que é Face Lab?", heading_style))
    story.append(Paragraph(
        """Face Lab é uma forma inteligente de você encontrar suas fotos em eventos. O fotógrafo organiza as fotos, você cadastra seu rosto uma vez, e automaticamente recebe todas as fotos do evento em que você aparece.""",
        body_style
    ))
    story.append(Spacer(1, 0.2*inch))

    # Seção 2: Quem é o Guest/Convidado?
    story.append(Paragraph("Quem é o Guest/Convidado?", heading_style))
    story.append(Paragraph(
        """<b>Guest = Você! Cliente/Convidado do Evento</b><br/>
        Você é guest se:<br/>
        • Foi convidado para um evento (casamento, formatura, festa, evento corporativo)<br/>
        • O fotógrafo/produtor criou um álbum no Face Lab<br/>
        • Recebeu um link (tipo face.bit-lab.tech) pra acessar<br/>
        • Quer encontrar suas fotos de forma fácil<br/>
        <br/>
        <b>Seu papel no Face Lab:</b><br/>
        Cadastrar seu rosto uma vez → encontrar TODAS as suas fotos automaticamente!""",
        body_style
    ))
    story.append(Spacer(1, 0.2*inch))

    # Seção 3: Por que isso é incrível?
    story.append(Paragraph("Por que isso é incrível?", heading_style))

    benefits = [
        ["⏱️ Rápido", "Encontra suas 100+ fotos em segundos (não manual)"],
        ["🔍 Preciso", "IA facial reconhece você — não confunde com outra pessoa"],
        ["🔒 Privado", "Você vê SÓ suas fotos, não de estranhos"],
        ["📸 Sem Limite", "Quantas fotos o fotógrafo tirou, você vê todas"],
        ["💻 Fácil", "Basta fazer login e cadastrar rosto — pronto!"],
        ["⬇️ Baixar Tudo", "Download direto do Google Drive"],
    ]

    table = Table(benefits, colWidths=[1.2*inch, 4.3*inch])
    table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, HexColor('#f3f4f6')]),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.3*inch))

    # PAGE BREAK
    story.append(PageBreak())

    # Seção 4: Primeiros Passos
    story.append(Paragraph("Como Começar — 5 Passos", heading_style))

    steps = [
        ["1", "Receba link do fotógrafo (tipo face.bit-lab.tech)"],
        ["2", "Acesse o link → clique em \"Entrar\""],
        ["3", "Faça login com sua conta (crie uma se for primeira vez)"],
        ["4", "Vá pra \"Meu Rosto\" → cadastre seu rosto (webcam ou 3-8 fotos)"],
        ["5", "Aguarde ~10-30s → \"Pronto!\" → suas fotos aparecem em \"Minhas Fotos\""],
    ]

    table = Table(steps, colWidths=[0.5*inch, 5*inch])
    table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#1e40af')),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -2), 0.5, HexColor('#e5e7eb')),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.3*inch))

    # Seção 5: Cadastrando seu Rosto
    story.append(Paragraph("Cadastrando seu Rosto", heading_style))
    story.append(Paragraph(
        """<b>Opção 1: Webcam (Recomendado)</b><br/>
        • 4 passos guiados: frente → esquerda → direita → sorriso<br/>
        • Leva ~30 segundos<br/>
        • IA valida cada foto: iluminação, rosto único<br/>
        • Frames são apagados após processamento<br/>
        <br/>
        <b>Opção 2: Upload de Fotos</b><br/>
        • Se webcam não funcionar<br/>
        • Selecione 3-8 fotos do seu rosto<br/>
        • .jpg ou .png<br/>
        • Mesma qualidade, processo um pouco mais lento<br/>
        <br/>
        <b>Dicas:</b><br/>
        • Luz clara de frente (não contra luz)<br/>
        • Rosto ocupando ~30-50% da câmera<br/>
        • Sem óculos escuros ou máscaras (se possível)<br/>
        • Fundo limpo ajuda, mas não é obrigatório""",
        body_style
    ))
    story.append(Spacer(1, 0.2*inch))

    # PAGE BREAK
    story.append(PageBreak())

    # Seção 6: Vendo suas Fotos
    story.append(Paragraph("Vendo suas Fotos — Minhas Fotos", heading_style))
    story.append(Paragraph(
        """<b>Menu \"Minhas Fotos\":</b><br/>
        Mostra todos os álbuns onde você aparece + contagem de fotos.<br/>
        <br/>
        <b>Grid de Fotos (abra um álbum):</b><br/>
        • Sua foto com seu rosto em destaque (quadrado na imagem)<br/>
        • Quadrado <b>PRETO</b> = Face Lab encontrou (automático)<br/>
        • Quadrado <b>VERDE</b> = você confirmou (\"Sou eu!\")<br/>
        • Número = precisão da IA (0.3-0.5 é normal)<br/>
        <br/>
        <b>Botões por foto:</b><br/>
        • ❤️ \"Sou eu!\" = confirma (Face Lab aprende, busca em outros eventos)<br/>
        • ❌ \"Não sou eu!\" = rejeita (essa pessoa não aparece mais pra você)<br/>
        • ⬇️ \"Baixar\" = download do Google Drive<br/>
        • 🔗 \"Ver no Drive\" = abre no Google Drive""",
        body_style
    ))
    story.append(Spacer(1, 0.2*inch))

    # Seção 7: O que acontece quando confirmo?
    story.append(Paragraph("O que acontece quando confirmo \"Sou eu!\"?", heading_style))
    story.append(Paragraph(
        """Quando você confirma uma foto:<br/>
        <br/>
        <b>1. Aquela foto vira verde</b> (confirmada)<br/>
        Você passou de "Face Lab acha que é você" → "você confirmou"<br/>
        <br/>
        <b>2. Todas as fotos da mesma pessoa no evento ficam verdes</b><br/>
        Se você aparece 15x no casamento com ângulos diferentes, todas viram verdes<br/>
        <br/>
        <b>3. Face Lab busca em OUTROS eventos também</b><br/>
        Se você foi em 3 casamentos diferentes esse ano, a IA procura sua face nos 3<br/>
        → Você descobre fotos suas em eventos que não sabia que tinha!<br/>
        <br/>
        <b>Resultado:</b> Um clique = semanas de trabalho manual economizadas! 🚀""",
        body_style
    ))
    story.append(Spacer(1, 0.2*inch))

    # Seção 8: Dúvidas Comuns
    story.append(Paragraph("Dúvidas Comuns", heading_style))

    faqs = [
        ("P: Meu rosto fica salvo no Face Lab?",
         "Não. Face Lab guarda um \"fingerprint\" (número) do seu rosto, não sua foto. Após cadastro, frames são apagados."),

        ("P: Outras pessoas veem minhas fotos?",
         "Não. Cada pessoa vê SÓ suas fotos. Privacidade total."),

        ("P: Posso rejeitar uma pessoa inteira?",
         "Sim! \"Não sou eu!\" → aquela pessoa nunca mais aparece pra você (mesmo em outros eventos)."),

        ("P: As fotos são originais do fotógrafo?",
         "Sim. Face Lab só guarda miniaturas. Originais estão no Google Drive do fotógrafo. Você baixa direto de lá."),

        ("P: Posso usar em celular?",
         "Sim! Face Lab é responsivo. E pode instalar como app nativo (Menu → \"Instalar app\")."),

        ("P: Quanto tempo demora aparecer minhas fotos?",
         "Quando o fotógrafo faz \"Re-escanear\", suas fotos aparecem em segundos (se você já cadastrou rosto)."),
    ]

    for q, a in faqs:
        story.append(Paragraph(f"<b>{q}</b>", body_style))
        story.append(Paragraph(a, body_style))
        story.append(Spacer(1, 0.1*inch))

    story.append(Spacer(1, 0.2*inch))

    # PAGE BREAK
    story.append(PageBreak())

    # Seção 9: Troubleshooting
    story.append(Paragraph("Se algo não funcionar...", heading_style))

    troubleshoots = [
        ("Não consigo fazer login",
         "Verifique se cookies estão habilitados. Tente em aba anônima. Verifique se auth.bit-lab.tech está acessível."),

        ("Enrollment deu erro (\"Nenhum rosto encontrado\")",
         "Tente em local mais claro. Sua face deve estar de frente. Tente upload de fotos se webcam não funciona."),

        ("Enviei fotos mas status não muda",
         "Aguarde 10-30s. O worker está processando. Se demorar muito, reporte em GitHub Issues."),

        ("Vejo poucos resultados de fotos",
         "Confira: (1) Seu rosto foi cadastrado? (2) Fotógrafo fez Re-escanear? (3) Filtro aplicado?"),

        ("Fotos não carregam",
         "Limpe cache (Ctrl+Shift+Delete). Tente em browser diferente. Abra DevTools (F12) → Console pra ver erros."),

        ("Recebí um erro genérico",
         "Reporte no GitHub Issues com: browser, OS, screenshot do erro, steps que fez."),
    ]

    for problem, solution in troubleshoots:
        story.append(Paragraph(f"<b>❌ {problem}</b>", body_style))
        story.append(Paragraph(f"<b>✅ {solution}</b>", body_style))
        story.append(Spacer(1, 0.1*inch))

    story.append(Spacer(1, 0.3*inch))

    # Seção 10: Suporte
    story.append(Paragraph("Precisa de Ajuda?", heading_style))
    story.append(Paragraph(
        """<b>Email:</b> rodrigo@bit-lab.tech<br/>
        <b>GitHub Issues:</b> github.com/rodrigozago/face-lab-issues/issues<br/>
        <br/>
        <b>URL da Aplicação:</b><br/>
        https://face.bit-lab.tech<br/>
        <br/>
        <b>Documentação:</b><br/>
        • Acesse https://face.bit-lab.tech/resources<br/>
        • Downloads dos guias (Producer e Guest)<br/>
        <br/>
        🐱⚡ <b>Face Lab Alpha — Gato-Veloz-v0.1 — Julho 2026</b><br/>
        <br/>
        Bora encontrar suas fotos! 📸""",
        body_style
    ))

    doc.build(story)
    print("✅ PDF Guest criado: Face_Lab_Guest_Guide.pdf")


if __name__ == "__main__":
    print("\n🐱 Gerando PDFs de Face Lab...\n")
    create_producer_pdf()
    create_guest_pdf()
    print("\n✨ Ambos os PDFs foram criados com sucesso!")
    print("   • Face_Lab_Producer_Guide.pdf")
    print("   • Face_Lab_Guest_Guide.pdf\n")

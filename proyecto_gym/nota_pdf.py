"""nota_pdf.py - Nota de pago en PDF (reportlab, texto vectorial: siempre legible). Compartido por Recepción y la nube."""


def pdf_nota(gimnasio, d):
    """Devuelve bytes del PDF o None si reportlab no está instalado."""
    try:
        from io import BytesIO
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A5
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
    except ImportError:
        return None
    rosa = colors.HexColor("#E619A8")
    gris = colors.HexColor("#6E6E73")
    oscuro = colors.HexColor("#1a1a1a")
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A5)
    w, h = A5
    y = h - 20 * mm
    c.setFillColor(rosa)
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(w / 2, y, str(gimnasio).upper())
    y -= 7 * mm
    c.setFillColor(oscuro)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(w / 2, y, str(d["titulo"]))
    y -= 5 * mm
    c.setStrokeColor(rosa)
    c.setLineWidth(1.6)
    c.line(15 * mm, y, w - 15 * mm, y)
    y -= 10 * mm
    filas = [
        ("Nota N.º", d["numero"]), ("Fecha", d["fecha"]), ("Miembro", d["nombre"]),
        ("CI", d["ci"]), ("Plan", d["plan"]), ("Inicio", d["inicio"]),
        ("Vencimiento", d["vence"]), ("Método de pago", d["metodo"]),
    ]
    for etiqueta, valor in filas:
        c.setFillColor(gris)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(18 * mm, y, f"{etiqueta}:")
        c.setFillColor(oscuro)
        c.setFont("Helvetica", 10.5)
        c.drawString(52 * mm, y, str(valor or "-")[:48])
        y -= 7 * mm
    y -= 2 * mm
    c.setFillColor(colors.HexColor("#F5F5F7"))
    c.roundRect(15 * mm, y - 12 * mm, w - 30 * mm, 16 * mm, 3 * mm, stroke=0, fill=1)
    c.setFillColor(oscuro)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(20 * mm, y - 6.5 * mm, "TOTAL PAGADO")
    c.setFillColor(rosa)
    c.setFont("Helvetica-Bold", 15)
    c.drawRightString(w - 20 * mm, y - 6.5 * mm, f"Bs {float(d['monto']):.2f}")
    y -= 24 * mm
    c.setFillColor(gris)
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(w / 2, y, f"Gracias por tu pago. Nos vemos en {gimnasio}.")
    c.showPage()
    c.save()
    return buf.getvalue()

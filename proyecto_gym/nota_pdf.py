"""nota_pdf.py - Nota de pago en PDF (reportlab). Compartido por Recepción y la nube."""


def pdf_nota(gimnasio, d):
    """Devuelve bytes del PDF o None si reportlab no está instalado."""
    try:
        from io import BytesIO
        from reportlab.lib.pagesizes import A5
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
    except ImportError:
        return None
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A5)
    w, h = A5
    y = h - 22 * mm
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(w / 2, y, gimnasio)
    y -= 8 * mm
    c.setFont("Helvetica", 11)
    c.drawCentredString(w / 2, y, d["titulo"])
    y -= 5 * mm
    c.line(15 * mm, y, w - 15 * mm, y)
    y -= 9 * mm
    filas = [
        ("Nota N°", d["numero"]), ("Fecha", d["fecha"]), ("Socio", d["nombre"]),
        ("CI", d["ci"]), ("Plan", d["plan"]), ("Inicio", d["inicio"]),
        ("Vencimiento", d["vence"]), ("Método de pago", d["metodo"]),
    ]
    for etiqueta, valor in filas:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(18 * mm, y, f"{etiqueta}:")
        c.setFont("Helvetica", 10)
        c.drawString(55 * mm, y, str(valor or "-"))
        y -= 7 * mm
    y -= 2 * mm
    c.line(15 * mm, y, w - 15 * mm, y)
    y -= 10 * mm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(18 * mm, y, "TOTAL PAGADO:")
    c.drawRightString(w - 18 * mm, y, f"Bs {d['monto']:.2f}")
    y -= 14 * mm
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(w / 2, y, f"Gracias por tu pago. ¡Nos vemos en {gimnasio}!")
    c.showPage()
    c.save()
    return buf.getvalue()

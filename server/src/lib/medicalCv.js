import { PORTFOLIO_SECTIONS, refHref, refLabel } from './portfolio';
import { userTitle } from './constants';
import { prettyTag } from './constants';

/**
 * Builds a clean, standard one-column Medical CV (A4) from the profile and academic portfolio and
 * downloads it. jsPDF is loaded only when someone asks for a CV.
 */
export async function downloadMedicalCv(user) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18; // margin
  const width = W - M * 2;
  const BRAND = [29, 78, 216]; // Tectum blue #1d4ed8
  const INK = [15, 37, 51];
  const MUTED = [90, 105, 120];
  let y = M;

  const ensure = (h) => {
    if (y + h > H - M - 8) {
      doc.addPage();
      y = M;
    }
  };
  const write = (text, { size = 10.5, style = 'normal', color = INK, gap = 1.6, indent = 0 } = {}) => {
    if (!text) return;
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text), width - indent);
    const lh = size * 0.42;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, M + indent, y);
      y += lh;
    }
    y += gap;
  };

  // ---- header ----
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 4, 'F');
  y = M + 4;
  write(user.name, { size: 22, style: 'bold', gap: 1 });
  write([userTitle(user), user.institution].filter(Boolean).join('  ·  '), { size: 12, color: BRAND, gap: 1.5 });
  const contact = [user.email, `Tectum profile: ${window.location.origin}/profile/${user._id}`].filter(Boolean).join('   |   ');
  write(contact, { size: 9, color: MUTED, gap: 3 });
  if (user.verificationStatus === 'verified') write('Identity verified on Tectum', { size: 9, color: BRAND, style: 'bold', gap: 3 });

  const heading = (title) => {
    ensure(14);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(...BRAND);
    doc.text(title.toUpperCase(), M, y);
    y += 1.8;
    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 5;
  };

  if (user.bio?.trim()) {
    heading('Profile');
    write(user.bio.trim(), { gap: 2 });
  }
  if (user.specialtyTags?.length) {
    heading('Clinical interests');
    write(user.specialtyTags.map((t) => prettyTag(t).replace(/\b\w/g, (c) => c.toUpperCase())).join('  ·  '), { gap: 2 });
  }

  // ---- portfolio sections ----
  for (const s of PORTFOLIO_SECTIONS) {
    const items = user.portfolio?.[s.key] ?? [];
    if (!items.length) continue;
    heading(s.title);
    for (const e of items) {
      const r = s.read(e);
      ensure(12);
      // date on the right of the title line
      if (r.date) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...MUTED);
        doc.text(r.date, W - M, y, { align: 'right' });
      }
      const dateW = r.date ? doc.getTextWidth(r.date) + 4 : 0;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      const titleLines = doc.splitTextToSize(r.title || '', width - dateW);
      titleLines.forEach((line, i) => {
        if (i) ensure(5);
        doc.text(line, M, y);
        y += 4.8;
      });
      if (r.detail) write(r.detail, { size: 10, color: MUTED, gap: 0.8 });
      const href = refHref(r.link);
      if (href) {
        ensure(5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...BRAND);
        doc.textWithLink(`${refLabel(r.link)}: ${href}`, M, y, { url: href });
        y += 4.4;
      }
      y += 2.4;
    }
  }

  if (!PORTFOLIO_SECTIONS.some((s) => user.portfolio?.[s.key]?.length)) {
    heading('Academic portfolio');
    write('No publications, rotations, presentations or certifications added yet.', { color: MUTED });
  }

  // ---- footer on every page ----
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${user.name}  ·  Medical CV  ·  generated from Tectum on ${stamp}`, M, H - 10);
    doc.text(`${i} / ${pages}`, W - M, H - 10, { align: 'right' });
  }

  const safe = user.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'Tectum';
  doc.save(`${safe}-Medical-CV.pdf`);
}

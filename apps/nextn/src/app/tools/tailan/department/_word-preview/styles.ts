import type { CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────
//  ДИЗАЙН СТИЛЬ ТОДОРХОЙЛОЛТУУД
//  Эдгээрийг өөрчлөхөд бүх хуудсанд нөлөөлнө.
//  _WordPreview.tsx-с гаргаж авсан — утга, зан төлөв ижил хэвээр.
// ─────────────────────────────────────────────────────────────

// bigTitle → хуудасны дээд гарчиг (том үсэг)
// Жнэ: "ДАТА АНАЛИЗЫН АЛБАНЫ 2026 ОНЫ I-Р УЛИРЛЫН"
export const bigTitle: CSSProperties = {
  textAlign: "center",
  fontWeight: "bold",
  fontSize: "11pt",
  letterSpacing: "1px",
  marginBottom: "3pt",
};

// secH → секцийн гарчиг (1., 2., 3. гэх мэт)
// Жнэ: "1. ДАТА БҮТЭЭГДЭХҮҮНИЙ ҮЙЛ АЖИЛЛАГАА"
export const secH: CSSProperties = {
  fontWeight: "bold",
  fontSize: "11pt",
  marginTop: "16pt",
  marginBottom: "4pt",
  textAlign: "center",
  letterSpacing: "0.5px",
};

// secSub → секцийн дэд гарчиг (хаалтан дотор байдаг)
// Жнэ: "(Харилцагчийн үйлчилгээ...)"
export const secSub: CSSProperties = {
  fontWeight: "bold",
  fontSize: "11pt",
  marginBottom: "7pt",
  color: "#000",
  textAlign: "center",
};

// thKpi → KPI хүснэгтийн HEADER нүдний стиль
// ⚠️  background: "#f29447"  ← s1, s2 header-ийн оранж өнгө
//    Энийг өөрчлөхөд s1 болон s2 хүснэгтийн header өнгө өөрчлөгдөнө
//    s3, s4 header нь доор тус тусдаа { ...thKpi, background: "#f29447" }
//    гэж override хийгддэг тул тэдгээрт нөлөөлөхгүй
export const thKpi: CSSProperties = {
  border: "0.5px solid #000",
  padding: "4px 6px",
  fontWeight: "bold",
  background: "#f29447", // ← S1, S2 HEADER ОРАНЖ ӨНГ — энд солих
  fontSize: "10pt", // ← хүснэгтийн header 10pt
  color: "#000",
  textAlign: "center",
};

// tdKpi → KPI хүснэгтийн МЭДЭЭЛЛИЙН нүдний үндсэн стиль
// ex параметрээр нэмэлт стилийг давхарлана (spread)
// Жнэ: tdKpi({ background: "#dde8f5" }) → цэнхэр фон нэмсэн нүд
export const tdKpi = (ex?: CSSProperties): CSSProperties => ({
  border: "0.5px solid #000",
  padding: "3px 5px",
  fontSize: "10pt", // ← хүснэгт дотор 10pt
  verticalAlign: "middle",
  color: "#000",
  ...ex,
});

// labelSt → тайлбар текстийн дэд гарчгийн стиль
// Жнэ: "Тайлбар:", "Амжилт, давуу тал:" гэх мэт
export const labelSt: CSSProperties = {
  fontWeight: "bold",
  fontSize: "11pt",
  color: "#000",
  marginBottom: "2pt",
  marginTop: "7pt",
};

// bodyTxt → тайлбар текстийн биеийн стиль
export const bodyTxt: CSSProperties = {
  fontSize: "11pt",
  lineHeight: "1.7",
  textAlign: "justify",
  color: "#000",
  whiteSpace: "pre-wrap",
};

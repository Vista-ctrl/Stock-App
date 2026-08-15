import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Package, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Home,
  Search, Plus, X, Pencil, Trash2, ImagePlus, AlertTriangle,
  LogOut, ChevronRight, Menu, Download, Check, ImageOff, Loader2,
} from "lucide-react";

/* ---------------------------------- tokens ---------------------------------- */
const C = {
  bg: "#F4F5F0",
  surface: "#FFFFFF",
  ink: "#20281F",
  inkSoft: "#535B4C",
  muted: "#8A8F80",
  line: "#E3E4DA",
  accent: "#C97A2B",
  accentSoft: "#F6E6D3",
  success: "#3F7D58",
  successSoft: "#E1EEE4",
  danger: "#B23A2E",
  dangerSoft: "#F7E3E0",
};

const UNITS = ["ชิ้น", "กล่อง", "แพ็ค", "ถุง", "ขวด", "ม้วน", "คู่", "ชุด", "กก.", "ลิตร"];
const CATEGORIES = ["วัตถุดิบ", "บรรจุภัณฑ์", "อุปกรณ์สำนักงาน", "สินค้าสำเร็จรูป", "อะไหล่", "อื่นๆ"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmtNum = (n) => Number(n || 0).toLocaleString("th-TH");
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return "-"; }
};

/* ------------------------------ configuration ------------------------------ */
/* แก้ 2 ค่านี้ก่อนใช้งานจริง — ดูวิธีได้ในคู่มือที่แนบมา */
const APPS_SCRIPT_URL = "วาง Web app URL จาก Google Apps Script ตรงนี้"; // เช่น https://script.google.com/macros/s/XXXX/exec
const GOOGLE_CLIENT_ID = "วาง OAuth Client ID จาก Google Cloud Console ตรงนี้"; // เช่น 123456-abc.apps.googleusercontent.com

const isConfigured = APPS_SCRIPT_URL.startsWith("http");
const isGoogleConfigured = GOOGLE_CLIENT_ID.includes(".apps.googleusercontent.com");

/* ------------------------------ API helpers ------------------------------ */
async function apiGetAll() {
  const res = await fetch(APPS_SCRIPT_URL + "?action=getAll");
  if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
  return res.json();
}
async function apiPost(body) {
  const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error("บันทึกข้อมูลไม่สำเร็จ");
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function resizeImage(file, maxDim = 720, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("ไม่ใช่ไฟล์รูปภาพที่ใช้งานได้"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* --------------------------------- small UI --------------------------------- */
function Toast({ toast }) {
  if (!toast) return null;
  const bg = toast.type === "error" ? C.danger : toast.type === "warn" ? C.accent : C.success;
  return (
    <div style={{
      position: "fixed", left: "50%", bottom: 88, transform: "translateX(-50%)",
      background: bg, color: "#fff", padding: "10px 18px", borderRadius: 10,
      fontSize: 14, fontWeight: 600, zIndex: 200, boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
      maxWidth: "90vw", textAlign: "center",
    }}>
      {toast.msg}
    </div>
  );
}

function Tag({ children, tone = "neutral" }) {
  const map = {
    neutral: { bg: C.line, fg: C.inkSoft },
    danger: { bg: C.dangerSoft, fg: C.danger },
    success: { bg: C.successSoft, fg: C.success },
    accent: { bg: C.accentSoft, fg: C.accent },
  };
  const t = map[tone];
  return (
    <span style={{ background: t.bg, color: t.fg, fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

/* a "stock tag" card shell — the signature motif: a punched grommet hole + dashed tear line */
function TagCard({ children, style }) {
  return (
    <div style={{
      position: "relative", background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: 14, overflow: "hidden", ...style,
    }}>
      <div style={{
        position: "absolute", top: 10, left: 10, width: 10, height: 10, borderRadius: "50%",
        background: C.bg, border: `1.5px solid ${C.line}`, zIndex: 2,
      }} />
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px", color: C.muted }}>
      <Icon size={34} strokeWidth={1.5} style={{ marginBottom: 10, opacity: 0.6 }} />
      <div style={{ fontWeight: 700, color: C.inkSoft, fontSize: 15 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* --------------------------------- login page --------------------------------- */
function decodeJwt(token) {
  const base = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base + "===".slice((base.length + 3) % 4);
  return JSON.parse(decodeURIComponent(escape(atob(padded))));
}

function LoginPage({ onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!isGoogleConfigured || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => {
        const payload = decodeJwt(resp.credential);
        onLogin({ name: payload.name, email: payload.email, picture: payload.picture });
      },
    });
    window.google.accounts.id.renderButton(btnRef.current, { theme: "outline", size: "large", width: 320, text: "signin_with", locale: "th" });
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    setTimeout(() => onLogin({ name: name.trim(), email: email.trim() }), 350);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Sarabun', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Package color="#fff" size={28} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>ระบบจัดการสต๊อกสินค้า</h1>
          <p style={{ fontSize: 13.5, color: C.muted, marginTop: 6 }}>เข้าสู่ระบบเพื่อจัดการคลังสินค้าของคุณ</p>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 22 }}>
          {isGoogleConfigured ? (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
              <div ref={btnRef} />
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: C.accent, background: C.accentSoft, padding: "8px 10px", borderRadius: 9, marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
                ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID ในไฟล์ App.jsx — ตอนนี้จึงใช้การเข้าสู่ระบบชั่วคราวด้านล่างไปก่อน
              </p>
              <form onSubmit={submit}>
                <label style={{ fontSize: 13, fontWeight: 700, color: C.inkSoft, display: "block", marginBottom: 6 }}>ชื่อผู้ใช้งาน</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น สมชาย ใจดี"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 14.5, marginBottom: 14, outline: "none", fontFamily: "inherit" }} />
                <label style={{ fontSize: 13, fontWeight: 700, color: C.inkSoft, display: "block", marginBottom: 6 }}>อีเมล</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@gmail.com"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 14.5, marginBottom: 18, outline: "none", fontFamily: "inherit" }} />
                <button type="submit" disabled={busy || !name.trim() || !email.trim()}
                  style={{
                    width: "100%", background: C.ink, color: "#fff", border: "none", borderRadius: 10,
                    padding: "12px 0", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 8, cursor: "pointer", opacity: busy ? 0.7 : 1,
                  }}>
                  {busy ? <Loader2 size={17} className="spin" /> : <ChevronRight size={17} />}
                  เข้าสู่ระบบชั่วคราว
                </button>
              </form>
            </>
          )}
          {!isConfigured && (
            <p style={{ fontSize: 11.5, color: C.muted, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
              ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL — ข้อมูลจะยังบันทึกลง Google Sheets จริงไม่ได้จนกว่าจะแก้ค่านี้ในไฟล์ App.jsx
            </p>
          )}
        </div>
      </div>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* --------------------------------- image modal --------------------------------- */
function ImageModal({ item, onClose }) {
  if (!item) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(20,22,17,0.72)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.surface, borderRadius: 16, padding: 14, maxWidth: "min(440px,92vw)",
        maxHeight: "88vh", display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: C.ink }}>{item.name}</span>
          <button onClick={onClose} style={{ background: C.bg, border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
            <X size={17} color={C.inkSoft} />
          </button>
        </div>
        <img src={item.url} alt={item.name} style={{
          width: "min(400px, 84vw)", height: "min(400px, 60vh)", objectFit: "contain",
          background: C.bg, borderRadius: 10, display: "block", margin: "0 auto",
        }} />
      </div>
    </div>
  );
}

/* --------------------------------- confirm modal --------------------------------- */
function ConfirmModal({ data, onCancel, onConfirm }) {
  if (!data) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,22,17,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 22, maxWidth: 340, width: "100%" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
          <AlertTriangle color={C.danger} size={22} />
          <div>
            <div style={{ fontWeight: 700, color: C.ink, fontSize: 15 }}>{data.title}</div>
            <div style={{ fontSize: 13.5, color: C.inkSoft, marginTop: 4 }}>{data.msg}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", color: C.inkSoft }}>ยกเลิก</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: C.danger, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>ยืนยันลบ</button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- product form modal --------------------------------- */
function ProductFormModal({ initial, onClose, onSave, existingImage }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(() => ({
    name: initial?.name || "", sku: initial?.sku || "", category: initial?.category || CATEGORIES[0],
    unit: initial?.unit || UNITS[0], qty: initial?.qty ?? 0, minQty: initial?.minQty ?? 0, note: initial?.note || "",
  }));
  const [imgData, setImgData] = useState(existingImage || null);
  const [imgBusy, setImgBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgBusy(true);
    try {
      const data = await resizeImage(file);
      setImgData(data);
    } catch { setError("อัปโหลดรูปภาพไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    setImgBusy(false);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("กรุณากรอกชื่อสินค้า"); return; }
    if (Number(form.qty) < 0 || Number(form.minQty) < 0) { setError("จำนวนต้องไม่ติดลบ"); return; }
    onSave({
      ...form, name: form.name.trim(), qty: Number(form.qty) || 0, minQty: Number(form.minQty) || 0,
    }, imgData, imgData !== existingImage);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,22,17,0.55)", zIndex: 250, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <form onSubmit={submit} style={{
        background: C.surface, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto",
        borderRadius: "18px 18px 0 0", padding: "18px 20px 24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0 }}>{isEdit ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h2>
          <button type="button" onClick={onClose} style={{ background: C.bg, border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}><X size={17} color={C.inkSoft} /></button>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div onClick={() => fileRef.current?.click()} style={{
            width: 84, height: 84, borderRadius: 12, background: C.bg, border: `1.5px dashed ${C.line}`,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, overflow: "hidden",
          }}>
            {imgBusy ? <Loader2 size={20} className="spin" color={C.muted} /> :
              imgData ? <img src={imgData} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
              <ImagePlus size={22} color={C.muted} />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display: "none" }} />
          <div style={{ fontSize: 12.5, color: C.muted, alignSelf: "center", lineHeight: 1.5 }}>
            แตะเพื่ออัปโหลดรูปสินค้าหรือป้ายสินค้า<br />
            {imgData && <button type="button" onClick={() => setImgData(null)} style={{ color: C.danger, background: "none", border: "none", padding: 0, fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}>ลบรูปภาพ</button>}
          </div>
        </div>

        <Field label="ชื่อสินค้า *"><input value={form.name} onChange={set("name")} placeholder="เช่น กล่องกระดาษ A4" style={inputStyle} /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="รหัสสินค้า (SKU)" flex><input value={form.sku} onChange={set("sku")} placeholder="เช่น BOX-001" style={inputStyle} /></Field>
          <Field label="หมวดหมู่" flex>
            <select value={form.category} onChange={set("category")} style={inputStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="จำนวนคงเหลือ" flex><input type="number" min="0" value={form.qty} onChange={set("qty")} style={inputStyle} /></Field>
          <Field label="หน่วยนับ" flex>
            <select value={form.unit} onChange={set("unit")} style={inputStyle}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        </div>
        <Field label="จำนวนขั้นต่ำ (แจ้งเตือนเมื่อต่ำกว่านี้)"><input type="number" min="0" value={form.minQty} onChange={set("minQty")} style={inputStyle} /></Field>
        <Field label="หมายเหตุ"><textarea value={form.note} onChange={set("note")} rows={2} style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }} /></Field>

        {error && <div style={{ color: C.danger, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{error}</div>}

        <button type="submit" style={{
          width: "100%", background: C.ink, color: "#fff", border: "none", borderRadius: 10,
          padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4,
        }}>{isEdit ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}</button>
      </form>
    </div>
  );
}

function Field({ label, children, flex }) {
  return (
    <div style={{ flex: flex ? 1 : undefined, marginBottom: 12 }}>
      <label style={{ fontSize: 12.5, fontWeight: 700, color: C.inkSoft, display: "block", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = { width: "100%", padding: "9px 11px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" };

/* --------------------------------- product card --------------------------------- */
function ProductCard({ p, image, onZoom, onEdit, onDelete }) {
  const low = p.qty <= p.minQty;
  const out = p.qty <= 0;
  return (
    <TagCard style={{ display: "flex", gap: 12, padding: "14px 14px 14px 18px" }}>
      <div onClick={() => image && onZoom({ url: image, name: p.name })} style={{
        width: 56, height: 56, borderRadius: 10, background: C.bg, flexShrink: 0, overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: image ? "zoom-in" : "default", border: `1px solid ${C.line}`,
      }}>
        {image ? <img src={image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageOff size={18} color={C.muted} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{p.sku || "ไม่มีรหัส"} · {p.category}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: out ? C.danger : C.ink }}>{fmtNum(p.qty)}</span>
          <span style={{ fontSize: 12, color: C.muted }}>{p.unit}</span>
          {out ? <Tag tone="danger">หมดสต๊อก</Tag> : low ? <Tag tone="accent">ใกล้หมด</Tag> : <Tag tone="success">ปกติ</Tag>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={() => onEdit(p)} style={iconBtn}><Pencil size={15} color={C.inkSoft} /></button>
        <button onClick={() => onDelete(p)} style={iconBtn}><Trash2 size={15} color={C.danger} /></button>
      </div>
    </TagCard>
  );
}
const iconBtn = { background: C.bg, border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

/* --------------------------------- pages --------------------------------- */
function MetricCard({ label, value, tone }) {
  const fg = tone === "danger" ? C.danger : tone === "accent" ? C.accent : C.ink;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: fg }}>{value}</div>
    </div>
  );
}

function DashboardPage({ products, transactions, images, onZoom, goto }) {
  const totalSku = products.length;
  const totalQty = products.reduce((s, p) => s + p.qty, 0);
  const low = products.filter((p) => p.qty <= p.minQty);
  const todayStr = new Date().toDateString();
  const todayTx = transactions.filter((t) => new Date(t.date).toDateString() === todayStr);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 18 }}>
        <MetricCard label="รายการสินค้าทั้งหมด" value={fmtNum(totalSku)} />
        <MetricCard label="จำนวนคงเหลือรวม" value={fmtNum(totalQty)} />
        <MetricCard label="สินค้าใกล้หมด/หมด" value={fmtNum(low.length)} tone={low.length ? "danger" : undefined} />
        <MetricCard label="รายการเคลื่อนไหววันนี้" value={fmtNum(todayTx.length)} tone="accent" />
      </div>

      <SectionHeader title="สินค้าที่ต้องเติมสต๊อก" action={low.length > 0 && <button onClick={() => goto("products")} style={linkBtn}>ดูทั้งหมด <ChevronRight size={14} /></button>} />
      {low.length === 0 ? <EmptyState icon={Check} title="สต๊อกสินค้าอยู่ในระดับปกติ" sub="ไม่มีสินค้าที่ต้องเติมในขณะนี้" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
          {low.slice(0, 5).map((p) => <ProductCard key={p.id} p={p} image={images[p.id]} onZoom={onZoom} onEdit={() => goto("products")} onDelete={() => goto("products")} />)}
        </div>
      )}

      <SectionHeader title="ความเคลื่อนไหวล่าสุด" />
      {transactions.length === 0 ? <EmptyState icon={ClipboardList} title="ยังไม่มีรายการเคลื่อนไหว" /> : (
        <TxTable rows={transactions.slice(0, 8)} />
      )}
    </div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0 10px" }}>
      <h3 style={{ fontSize: 14.5, fontWeight: 700, color: C.ink, margin: 0 }}>{title}</h3>
      {action}
    </div>
  );
}
const linkBtn = { background: "none", border: "none", color: C.accent, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 2, cursor: "pointer" };

function TxTable({ rows }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
      {rows.map((t, i) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
          borderBottom: i === rows.length - 1 ? "none" : `1px solid ${C.line}`,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: t.type === "in" ? C.successSoft : C.dangerSoft,
          }}>
            {t.type === "in" ? <ArrowDownToLine size={15} color={C.success} /> : <ArrowUpFromLine size={15} color={C.danger} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.productName}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{t.by} · {fmtDate(t.date)}</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: t.type === "in" ? C.success : C.danger }}>
            {t.type === "in" ? "+" : "-"}{fmtNum(t.qty)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductsPage({ products, images, onZoom, onAdd, onEdit, onDelete }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ทั้งหมด");
  const filtered = useMemo(() => products.filter((p) =>
    (cat === "ทั้งหมด" || p.category === cat) &&
    (p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku || "").toLowerCase().includes(q.toLowerCase()))
  ), [products, q, cat]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={16} color={C.muted} style={{ position: "absolute", left: 11, top: 11 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อหรือรหัสสินค้า"
            style={{ ...inputStyle, paddingLeft: 34 }} />
        </div>
        <button onClick={onAdd} style={{ background: C.ink, color: "#fff", border: "none", borderRadius: 9, padding: "0 16px", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
          <Plus size={16} /> เพิ่ม
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12, marginBottom: 4 }}>
        {["ทั้งหมด", ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)} style={{
            flexShrink: 0, padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            border: `1px solid ${cat === c ? C.ink : C.line}`, background: cat === c ? C.ink : "#fff", color: cat === c ? "#fff" : C.inkSoft,
          }}>{c}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="ไม่พบสินค้า" sub="ลองค้นหาด้วยคำอื่น หรือเพิ่มสินค้าใหม่" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((p) => <ProductCard key={p.id} p={p} image={images[p.id]} onZoom={onZoom} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

function MoveForm({ mode, products, images, onZoom, onSubmit }) {
  const isOut = mode === "out";
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const product = products.find((p) => p.id === productId);

  const submit = (e) => {
    e.preventDefault();
    setError("");
    if (!productId) { setError("กรุณาเลือกสินค้า"); return; }
    const n = Number(qty);
    if (!n || n <= 0) { setError("กรุณากรอกจำนวนให้ถูกต้อง"); return; }
    if (isOut && product && n > product.qty) { setError(`สต๊อกคงเหลือมีเพียง ${fmtNum(product.qty)} ${product.unit}`); return; }
    if (!who.trim()) { setError(isOut ? "กรุณากรอกชื่อผู้เบิก" : "กรุณากรอกแหล่งที่มา/ผู้ส่งสินค้า"); return; }
    onSubmit({ productId, qty: n, who: who.trim(), note: note.trim() });
    setProductId(""); setQty(""); setWho(""); setNote("");
  };

  return (
    <form onSubmit={submit} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
      <Field label="เลือกสินค้า *">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} style={inputStyle}>
          <option value="">-- เลือกสินค้า --</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} (คงเหลือ {fmtNum(p.qty)} {p.unit})</option>)}
        </select>
      </Field>

      {product && (
        <div onClick={() => images[product.id] && onZoom({ url: images[product.id], name: product.name })} style={{
          display: "flex", alignItems: "center", gap: 10, background: C.bg, borderRadius: 10, padding: 10, marginBottom: 12,
          cursor: images[product.id] ? "zoom-in" : "default",
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", background: "#fff", flexShrink: 0, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {images[product.id] ? <img src={images[product.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageOff size={16} color={C.muted} />}
          </div>
          <div style={{ fontSize: 12.5, color: C.inkSoft }}>คงเหลือปัจจุบัน <b style={{ color: C.ink }}>{fmtNum(product.qty)} {product.unit}</b></div>
        </div>
      )}

      <Field label={`จำนวนที่${isOut ? "เบิก" : "รับเข้า"} *`}>
        <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" style={inputStyle} />
      </Field>
      <Field label={isOut ? "ผู้เบิก / แผนก *" : "แหล่งที่มา / ผู้ส่งสินค้า *"}>
        <input value={who} onChange={(e) => setWho(e.target.value)} placeholder={isOut ? "เช่น ฝ่ายผลิต - คุณสมหญิง" : "เช่น บริษัท เอบีซี จำกัด"} style={inputStyle} />
      </Field>
      <Field label="หมายเหตุ">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }} />
      </Field>

      {error && <div style={{ color: C.danger, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{error}</div>}

      <button type="submit" style={{
        width: "100%", background: isOut ? C.danger : C.success, color: "#fff", border: "none", borderRadius: 10,
        padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        {isOut ? <ArrowUpFromLine size={17} /> : <ArrowDownToLine size={17} />}
        {isOut ? "บันทึกการเบิกสินค้า" : "บันทึกรับสินค้าเข้า"}
      </button>
    </form>
  );
}

function MovePage({ mode, products, images, transactions, onZoom, onSubmit }) {
  const rows = transactions.filter((t) => t.type === mode).slice(0, 10);
  return (
    <div>
      <MoveForm mode={mode} products={products} images={images} onZoom={onZoom} onSubmit={onSubmit} />
      <SectionHeader title={mode === "out" ? "ประวัติการเบิกล่าสุด" : "ประวัติการรับเข้าล่าสุด"} />
      {rows.length === 0 ? <EmptyState icon={ClipboardList} title="ยังไม่มีประวัติ" /> : <TxTable rows={rows} />}
    </div>
  );
}

function ReportPage({ products }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ทั้งหมด");
  const rows = useMemo(() => products.filter((p) => {
    const st = p.qty <= 0 ? "หมดสต๊อก" : p.qty <= p.minQty ? "ใกล้หมด" : "ปกติ";
    return (status === "ทั้งหมด" || status === st) && p.name.toLowerCase().includes(q.toLowerCase());
  }), [products, q, status]);

  const exportCsv = () => {
    const header = "ชื่อสินค้า,รหัสสินค้า,หมวดหมู่,คงเหลือ,หน่วย,ขั้นต่ำ,สถานะ\n";
    const body = rows.map((p) => {
      const st = p.qty <= 0 ? "หมดสต๊อก" : p.qty <= p.minQty ? "ใกล้หมด" : "ปกติ";
      return [p.name, p.sku, p.category, p.qty, p.unit, p.minQty, st].join(",");
    }).join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "รายงานสินค้าคงเหลือ.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={16} color={C.muted} style={{ position: "absolute", left: 11, top: 11 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสินค้า" style={{ ...inputStyle, paddingLeft: 34 }} />
        </div>
        <button onClick={exportCsv} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 9, padding: "0 14px", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, cursor: "pointer", color: C.inkSoft }}>
          <Download size={15} /> CSV
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12 }}>
        {["ทั้งหมด", "ปกติ", "ใกล้หมด", "หมดสต๊อก"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} style={{
            flexShrink: 0, padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            border: `1px solid ${status === s ? C.ink : C.line}`, background: status === s ? C.ink : "#fff", color: status === s ? "#fff" : C.inkSoft,
          }}>{s}</button>
        ))}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px", padding: "10px 14px", background: C.bg, fontSize: 12, fontWeight: 700, color: C.inkSoft }}>
          <span>สินค้า</span><span style={{ textAlign: "right" }}>คงเหลือ</span><span style={{ textAlign: "right" }}>สถานะ</span>
        </div>
        {rows.length === 0 ? <EmptyState icon={ClipboardList} title="ไม่พบข้อมูล" /> : rows.map((p, i) => {
          const out = p.qty <= 0, low = !out && p.qty <= p.minQty;
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px", padding: "11px 14px", alignItems: "center", borderTop: `1px solid ${C.line}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>{p.sku || "ไม่มีรหัส"}</div>
              </div>
              <div style={{ textAlign: "right", fontWeight: 700, fontSize: 13.5, color: C.ink }}>{fmtNum(p.qty)}</div>
              <div style={{ textAlign: "right" }}>{out ? <Tag tone="danger">หมด</Tag> : low ? <Tag tone="accent">ใกล้หมด</Tag> : <Tag tone="success">ปกติ</Tag>}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- nav shell --------------------------------- */
const NAV = [
  { id: "dashboard", label: "หน้าแรก", icon: Home },
  { id: "products", label: "สต๊อกสินค้า", icon: Package },
  { id: "out", label: "เบิกสินค้า", icon: ArrowUpFromLine },
  { id: "in", label: "รับเข้าสินค้า", icon: ArrowDownToLine },
  { id: "report", label: "รายงาน", icon: ClipboardList },
];

export default function StockApp() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [formModal, setFormModal] = useState(null); // 'new' | product
  const [confirm, setConfirm] = useState(null);
  const toastTimer = useRef(null);

  /* ทุกที่ในหน้าจอที่อ้างถึง images[productId] จะได้ URL รูปจาก Google Drive โดยตรง */
  const images = useMemo(() => {
    const map = {};
    products.forEach((p) => { if (p.imageUrl) map[p.id] = p.imageUrl; });
    return map;
  }, [products]);

  const notify = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const loadAll = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiGetAll();
      setProducts((data.products || []).map((p) => ({ ...p, qty: Number(p.qty) || 0, minQty: Number(p.minQty) || 0 })).reverse());
      setTransactions((data.transactions || []).map((t) => ({ ...t, qty: Number(t.qty) || 0 })).reverse());
    } catch (err) {
      notify("โหลดข้อมูลจาก Google Sheets ไม่สำเร็จ ตรวจสอบ APPS_SCRIPT_URL และการ Deploy", "error");
    }
    setLoading(false);
  }, [notify]);

  useEffect(() => { if (user) loadAll(); }, [user, loadAll]);

  const saveProduct = async (data, imgData, imgChanged) => {
    const isEdit = !!formModal?.id;
    const id = formModal?.id || uid();
    const product = {
      id, ...data,
      imageUrl: imgChanged ? (imgData ? "" : "") : (formModal?.imageUrl || ""),
    };
    try {
      const res = await apiPost({ action: "upsertProduct", product, imageBase64: imgChanged ? imgData : null });
      const finalImageUrl = imgChanged ? (res.imageUrl || "") : (formModal?.imageUrl || "");
      setProducts((prev) => {
        const withUpdate = { ...product, imageUrl: finalImageUrl, updatedAt: new Date().toISOString() };
        return isEdit ? prev.map((p) => (p.id === id ? withUpdate : p)) : [withUpdate, ...prev];
      });
      setFormModal(null);
      notify(isEdit ? "แก้ไขข้อมูลสินค้าแล้ว" : "เพิ่มสินค้าใหม่แล้ว");
    } catch (err) {
      notify("บันทึกไม่สำเร็จ: " + err.message, "error");
    }
  };

  const deleteProduct = async () => {
    const p = confirm;
    setConfirm(null);
    try {
      await apiPost({ action: "deleteProduct", id: p.id });
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
      notify("ลบสินค้าแล้ว", "warn");
    } catch (err) {
      notify("ลบไม่สำเร็จ: " + err.message, "error");
    }
  };

  const doMove = (mode) => async ({ productId, qty, who, note }) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    try {
      const res = await apiPost({ action: "move", productId, type: mode, qty, by: who, note });
      setProducts((prev) => prev.map((x) => (x.id === productId ? { ...x, qty: res.newQty } : x)));
      const tx = { id: uid(), productId, productName: p.name, type: mode, qty, by: who, note, date: new Date().toISOString() };
      setTransactions((prev) => [tx, ...prev]);
      notify(mode === "out" ? "บันทึกการเบิกสินค้าแล้ว" : "บันทึกรับสินค้าเข้าแล้ว");
    } catch (err) {
      notify("บันทึกไม่สำเร็จ: " + err.message, "error");
    }
  };

  if (!user) return <LoginPage onLogin={setUser} />;

  const pageTitle = NAV.find((n) => n.id === page)?.label || "";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Sarabun', sans-serif", color: C.ink }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
        * { box-sizing: border-box; font-family: 'Sarabun', sans-serif; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::selection { background: ${C.accentSoft}; }
      `}</style>

      <div style={{ display: "flex" }}>
        {/* desktop sidebar */}
        <aside className="sidebar" style={{
          width: 220, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.line}`,
          minHeight: "100vh", padding: "20px 14px", display: "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px 22px" }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package color="#fff" size={18} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>คลังสินค้า</span>
          </div>
          {NAV.map((n) => {
            const Icon = n.icon; const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                border: "none", background: active ? C.ink : "transparent", color: active ? "#fff" : C.inkSoft,
                fontWeight: 600, fontSize: 13.5, cursor: "pointer", marginBottom: 3, textAlign: "left",
              }}>
                <Icon size={17} /> {n.label}
              </button>
            );
          })}
          <div style={{ position: "absolute", bottom: 20, width: 190 }}>
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.accentSoft, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                {user.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              </div>
              <button onClick={() => setUser(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><LogOut size={16} color={C.muted} /></button>
            </div>
          </div>
        </aside>

        {/* main */}
        <main style={{ flex: 1, minWidth: 0, paddingBottom: 84 }}>
          <header style={{
            position: "sticky", top: 0, zIndex: 50, background: C.bg, padding: "16px 16px 6px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>{pageTitle}</h2>
            <div className="mobile-avatar" style={{ width: 32, height: 32, borderRadius: "50%", background: C.accentSoft, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
              {user.name[0]?.toUpperCase()}
            </div>
          </header>

          <div style={{ padding: "10px 16px 20px", maxWidth: 720 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: C.muted }}><Loader2 size={22} className="spin" /><div style={{ marginTop: 8, fontSize: 13.5 }}>กำลังโหลดข้อมูล...</div></div>
            ) : page === "dashboard" ? (
              <DashboardPage products={products} transactions={transactions} images={images} onZoom={setZoom} goto={setPage} />
            ) : page === "products" ? (
              <ProductsPage products={products} images={images} onZoom={setZoom}
                onAdd={() => setFormModal("new")} onEdit={(p) => setFormModal(p)}
                onDelete={(p) => setConfirm(p)} />
            ) : page === "out" ? (
              <MovePage mode="out" products={products} images={images} transactions={transactions} onZoom={setZoom} onSubmit={doMove("out")} />
            ) : page === "in" ? (
              <MovePage mode="in" products={products} images={images} transactions={transactions} onZoom={setZoom} onSubmit={doMove("in")} />
            ) : (
              <ReportPage products={products} />
            )}
          </div>
        </main>
      </div>

      {/* mobile bottom nav */}
      <nav className="bottomnav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.line}`,
        display: "flex", zIndex: 60, padding: "6px 4px calc(6px + env(safe-area-inset-bottom))",
      }}>
        {NAV.map((n) => {
          const Icon = n.icon; const active = page === n.id;
          return (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3, padding: "6px 0", cursor: "pointer", color: active ? C.accent : C.muted,
            }}>
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500 }}>{n.label}</span>
            </button>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 900px) {
          .sidebar { display: block !important; position: relative; }
          .bottomnav { display: none !important; }
          main { padding-bottom: 20px !important; }
          .mobile-avatar { display: none; }
        }
      `}</style>

      {formModal && (
        <ProductFormModal
          initial={formModal === "new" ? null : formModal}
          existingImage={formModal === "new" ? null : images[formModal.id]}
          onClose={() => setFormModal(null)}
          onSave={saveProduct}
        />
      )}
      <ImageModal item={zoom} onClose={() => setZoom(null)} />
      <ConfirmModal data={confirm ? { title: `ลบ "${confirm.name}"?`, msg: "การลบสินค้าจะลบข้อมูลและรูปภาพออกอย่างถาวร" } : null} onCancel={() => setConfirm(null)} onConfirm={deleteProduct} />
      <Toast toast={toast} />
    </div>
  );
}

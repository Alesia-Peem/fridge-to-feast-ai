// Vercel Serverless Function: POST /api/recipe
// เก็บ Gemini API Key ไว้ฝั่งเซิร์ฟเวอร์ (Environment Variable ชื่อ GEMINI_API_KEY บน Vercel)
// ผู้ใช้หน้าเว็บจึงไม่เห็น key และไม่ต้องกรอกเอง

// ถ้ารุ่นแรกคนใช้เยอะจนล้น (503) หรือโควตาเต็ม (429) จะลองรุ่น lite ต่อให้อัตโนมัติ
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const RETRY_STATUSES = [429, 500, 503];
const MEAL_TYPES = ['อาหารจานเดียว ทำง่ายๆ', 'ต้ม/แกง ร้อนๆ', 'ผัด/ทอด รสเด็ด', 'อาหารคลีน สุขภาพ'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'ใช้ได้เฉพาะ POST' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GEMINI_API_KEY' });
  }

  // จำกัดอินพุต กันคนเอา API Key ของเราไปใช้ถามเรื่องอื่น
  const { ingredients, mealType } = req.body || {};
  if (typeof ingredients !== 'string' || !ingredients.trim() || ingredients.length > 500) {
    return res.status(400).json({ error: 'กรุณาระบุวัตถุดิบ (ไม่เกิน 500 ตัวอักษร)' });
  }
  if (!MEAL_TYPES.includes(mealType)) {
    return res.status(400).json({ error: 'ประเภทอาหารไม่ถูกต้อง' });
  }

  const promptText = `คุณคือเชฟมืออาชีพ ช่วยคิดเมนูอาหาร 1 เมนูจากวัตถุดิบในตู้เย็น: "${ingredients.trim()}" ประเภท: "${mealType}"
ไม่จำเป็นต้องใช้ครบทุกอย่าง ให้ใช้วัตถุดิบที่ระบุว่า (ใกล้หมดอายุ) ก่อน และถือว่ามีเครื่องปรุงพื้นฐานอยู่แล้ว
ตอบเป็น JSON เท่านั้น โครงสร้าง:
{
  "title": "ชื่อเมนู",
  "category": "${mealType}",
  "ingredients": ["วัตถุดิบ 1", "วัตถุดิบ 2"],
  "steps": ["ขั้นตอน 1", "ขั้นตอน 2"],
  "tip": "เคล็ดลับ"
}`;

  try {
    let response, data;
    for (const model of GEMINI_MODELS) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      data = await response.json();
      if (!RETRY_STATUSES.includes(response.status)) break;
    }

    if (!response.ok) {
      return res.status(502).json({ error: data.error?.message || `Gemini HTTP ${response.status}` });
    }

    let rawText = data.candidates[0].content.parts.map(p => p.text || '').join('');
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return res.status(200).json(JSON.parse(rawText));

  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'เรียก Gemini ไม่สำเร็จ' });
  }
};

/**
 * 一天 · 工具函数 & 常量
 */

export const CAT_COLORS = {
  '工作':'#5B7B8A','生活':'#7A9E7E','健康':'#C65D3E','学习':'#8B6B8A',
  '社交':'#D4A84B','娱乐':'#C4873B','休息':'#9BB0C4','个人成长':'#6B8F71','其他':'#9C9C9C',
};

export const MOOD_EMOJIS = ['','😢','😞','😕','😐','🙂','😊','😄','😁','🤩','🥳'];

export const fmtDate = (d) => new Date(d).toISOString().split('T')[0];
export const today = () => fmtDate(new Date());
export const fmtHour = (h) => `${String(h).padStart(2,'0')}:00`;

// Toast system
let toastId = 0;
const toastListeners = new Set();
export function showToast(msg, type = 'info') {
  const t = { id: ++toastId, msg, type };
  toastListeners.forEach(fn => fn(t));
}
export function onToast(fn) { toastListeners.add(fn); return () => toastListeners.delete(fn); }

// Greeting by time of day
export function getGreeting(t) {
  const h = new Date().getHours();
  if (h < 12) return t('gm');
  if (h < 18) return t('ga');
  return t('ge');
}

// Emails about bookings and orders. Each function is safe to await: it never throws.
import { Db } from './db';
import { esc, layout, rows, sendMail } from './mail';
import { dateLabel, minutesLabel } from './time';
import { BOOKING_PAY, METHOD, ORDER_PAY } from './labels';

const inr = (n: number) => '₹' + Number(n).toLocaleString('en-IN');
const ownerEmail = () => process.env.OWNER_NOTIFY_EMAIL?.trim() || process.env.OWNER_EMAIL?.trim() || '';
const safely = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { console.error('[notify]', e); } };

/** To the owner: a new table booking whose advance payment has been received. */
export const notifyOwnerBooking = (b: any) => safely(() => sendMail(ownerEmail(), `New table booking ${b.code}: ${b.table_label}, ${dateLabel(b.booking_date)} ${minutesLabel(b.start_min)}`,
  layout('New table booking', rows([['Booking code', b.code], ['Table', `${b.table_label} (${b.table_seats} seats)`], ['Date', dateLabel(b.booking_date)], ['Time', `${minutesLabel(b.start_min)} to ${minutesLabel(b.end_min)}`],
    ['Guests', b.guests], ['Customer', b.customer_name], ['Phone', b.customer_phone], ['Email', b.customer_email], ['Notes', b.notes], ['Advance', `${inr(b.advance_paise / 100)}: ${BOOKING_PAY[b.payment_status] ?? b.payment_status}`]])
    + '<p>Please open your Owner Dashboard and accept or reject this booking.</p>')));

/** To the owner: a new food order (Cash on delivery, or online payment received). */
export const notifyOwnerOrder = (o: any) => safely(() => sendMail(ownerEmail(), `New ${o.order_type === 'dine_in' ? 'dine-in' : 'delivery'} order ${o.code}: ${inr(o.total)}`,
  layout('New food order', rows([['Order code', o.code], ['Type', o.order_type === 'dine_in' ? `Dine-in at ${o.table_label ?? 'table'}` : 'Delivery'], ['Customer', o.customer_name], ['Phone', o.customer_phone], ['Address', o.address], ['Instructions', o.instructions],
    ['Payment', `${METHOD[o.payment_method] ?? o.payment_method}: ${ORDER_PAY[o.payment_status] ?? o.payment_status}`], ['Total', inr(o.total)]])
    + `<p><b>Items</b></p><ul>${(o.items ?? []).map((i: any) => `<li>${esc(i.qty)} × ${esc(i.name)} (${esc(inr(i.unit_price))} each)</li>`).join('')}</ul><p>Please open your Owner Dashboard and accept the order.</p>`)));

/** To the customer after the owner acts on a booking: confirmed = success, rejected/cancelled = failure with the reason. */
export const notifyCustomerBooking = (b: any) => safely(async () => {
  if (!b?.customer_email) return;
  const details = rows([['Booking code', b.code], ['Table', b.table_label], ['Date', dateLabel(b.booking_date)], ['Time', `${minutesLabel(b.start_min)} to ${minutesLabel(b.end_min)}`], ['Guests', b.guests]]);
  const name = esc(String(b.customer_name).split(' ')[0]);
  if (b.status === 'confirmed') {
    await sendMail(b.customer_email, `Your table is confirmed (${b.code})`, layout('Booking confirmed ✔', `<p>Hi ${name}, great news! Your table booking is <b style="color:#1a7f37">confirmed</b>. We look forward to welcoming you.</p>${details}<p>Please arrive on time. Your table is held for you.</p>`));
  } else if (b.status === 'rejected' || b.status === 'cancelled') {
    const refund = b.payment_status === 'refund_pending' ? `<p>Your advance of <b>${esc(inr(b.advance_paise / 100))}</b> will be refunded by the restaurant.</p>` : '';
    await sendMail(b.customer_email, `Your booking ${b.code} was ${b.status === 'rejected' ? 'not accepted' : 'cancelled'}`,
      layout(b.status === 'rejected' ? 'Booking not accepted ✖' : 'Booking cancelled ✖', `<p>Hi ${name}, we are sorry. Your table booking could not be honoured.</p><p><b>Reason:</b> ${esc(b.status_reason || 'Not given')}</p>${details}${refund}<p>You are welcome to book another time on our website.</p>`));
  }
});

/** To the customer after the owner acts on an order: accepted = success, cancelled = failure with the reason. */
export const notifyCustomerOrder = (db: Db, o: any) => safely(async () => {
  const u = await db.prepare('SELECT name, email FROM users WHERE id = ?').get(o.user_id); if (!u?.email) return;
  const name = esc(String(u.name).split(' ')[0]);
  const summary = rows([['Order code', o.code], ['Total', inr(o.total)]]) + `<ul>${(o.items ?? []).map((i: any) => `<li>${esc(i.qty)} × ${esc(i.name)}</li>`).join('')}</ul>`;
  if (o.status === 'accepted') {
    await sendMail(u.email, `Your order ${o.code} is accepted`, layout('Order accepted ✔', `<p>Hi ${name}, your order has been <b style="color:#1a7f37">accepted</b> and the kitchen is on it.</p>${summary}`));
  } else if (o.status === 'cancelled') {
    const refund = o.payment_status === 'refund_pending' ? '<p>Your payment will be refunded by the restaurant.</p>' : '';
    await sendMail(u.email, `Your order ${o.code} was cancelled`, layout('Order cancelled ✖', `<p>Hi ${name}, we are sorry. Your order could not be completed.</p><p><b>Reason:</b> ${esc(o.cancel_reason || 'Not given')}</p>${summary}${refund}`));
  }
});
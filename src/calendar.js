const { google } = require('googleapis');
const config = require('./config');

let calendar = null;

function getCalendarClient() {
  if (!config.calendar.enabled) return null;
  if (calendar) return calendar;

  const auth = new google.auth.OAuth2(
    config.calendar.clientId,
    config.calendar.clientSecret,
    config.calendar.redirectUri
  );
  auth.setCredentials({ refresh_token: config.calendar.refreshToken });
  calendar = google.calendar({ version: 'v3', auth });
  return calendar;
}

/**
 * Get next N available slots starting from tomorrow
 */
async function getAvailableSlots(count = 3) {
  const cal = getCalendarClient();
  if (!cal) return null;

  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setHours(8, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 14); // Look 2 weeks ahead

    const busyRes = await cal.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: config.calendar.calendarId }],
      },
    });

    const busySlots = busyRes.data.calendars[config.calendar.calendarId]?.busy || [];
    const duration = config.calendar.appointmentDurationMinutes * 60 * 1000;
    const workHours = { start: 8, end: 17 }; // 8am - 5pm

    const available = [];
    const cursor = new Date(start);

    while (available.length < count && cursor < end) {
      const hour = cursor.getHours();
      const dayOfWeek = cursor.getDay();

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(workHours.start, 0, 0, 0);
        continue;
      }

      // Stay within work hours
      if (hour < workHours.start) {
        cursor.setHours(workHours.start, 0, 0, 0);
        continue;
      }
      if (hour >= workHours.end) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(workHours.start, 0, 0, 0);
        continue;
      }

      const slotEnd = new Date(cursor.getTime() + duration);
      const overlaps = busySlots.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return cursor < busyEnd && slotEnd > busyStart;
      });

      if (!overlaps && slotEnd.getHours() <= workHours.end) {
        available.push({
          start: new Date(cursor),
          end: slotEnd,
          label: formatSlotLabel(cursor),
        });
      }

      cursor.setMinutes(cursor.getMinutes() + 30);
    }

    return available;
  } catch (err) {
    console.error('Calendar error:', err.message);
    return null;
  }
}

/**
 * Create a hold event on the calendar
 */
async function createHold({ start, end, customerName, service, phone }) {
  const cal = getCalendarClient();
  if (!cal) return null;

  try {
    const res = await cal.events.insert({
      calendarId: config.calendar.calendarId,
      requestBody: {
        summary: `[HOLD] ${service} - ${customerName}`,
        description: `Customer: ${customerName}\nPhone: ${phone}\nService: ${service}\n\n⚠️ HOLD - Awaiting contractor confirmation`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        status: 'tentative',
        colorId: '5', // Yellow = tentative
      },
    });
    return res.data;
  } catch (err) {
    console.error('Calendar create error:', err.message);
    return null;
  }
}

function formatSlotLabel(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hours = date.getHours();
  const ampm = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const timeStr = minutes === '00' ? `${hour12}${ampm}` : `${hour12}:${minutes}${ampm}`;
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()} at ${timeStr}`;
}

module.exports = { getAvailableSlots, createHold };

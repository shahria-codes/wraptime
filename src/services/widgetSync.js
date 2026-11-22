import { Preferences } from '@capacitor/preferences';
import { format, addDays, parseISO, isSameDay } from 'date-fns';

const WIDGET_DATA_KEY = 'wraptime_widget_data';

/**
 * Sync shift data to native widget storage (iOS WidgetKit, macOS Desktop, Android AppWidget).
 */
export const syncWidgetData = async ({ userProfile, shifts = [] }) => {
  if (!userProfile) return;

  try {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    const myUid = userProfile.uid;
    const myName = userProfile.displayName || 'You';

    // Filter shifts for this employee
    const myShifts = shifts.filter(s =>
      s.userId === myUid ||
      (s.userDisplayName && userProfile.displayName && s.userDisplayName.trim().toLowerCase() === userProfile.displayName.trim().toLowerCase())
    );

    // 1. Today's Shift
    const todayShiftRaw = myShifts.find(s => s.date === todayStr) || null;
    let todayShift = null;
    if (todayShiftRaw) {
      // Find coworkers at the same branch today
      const coworkers = shifts
        .filter(s => s.date === todayStr && s.branch === todayShiftRaw.branch && s.userId !== myUid)
        .map(s => s.userDisplayName?.split(' ')[0] || 'Staff');

      const isCheckedIn = todayShiftRaw.status === 'checked-in' || !!todayShiftRaw.checkInTime;

      todayShift = {
        hasShift: true,
        branch: todayShiftRaw.branch || 'Branch',
        startTime: todayShiftRaw.startTime || '09:00',
        endTime: todayShiftRaw.endTime || '22:00',
        timeString: `${todayShiftRaw.startTime || '09:00'} - ${todayShiftRaw.endTime || '22:00'}`,
        status: isCheckedIn ? 'Checked In' : 'Scheduled',
        coworkers: coworkers.length > 0 ? coworkers.join(', ') : 'Solo Shift'
      };
    } else {
      todayShift = {
        hasShift: false,
        status: 'Off Duty Today'
      };
    }

    // 2. Tomorrow's Shift or Next Upcoming Shift
    const tomorrowShiftRaw = myShifts.find(s => s.date === tomorrowStr);
    const nextUpcomingRaw = tomorrowShiftRaw || myShifts
      .filter(s => s.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null;

    let nextShift = null;
    if (nextUpcomingRaw) {
      nextShift = {
        hasShift: true,
        date: nextUpcomingRaw.date,
        dayName: format(parseISO(nextUpcomingRaw.date), 'EEEE'),
        dateFormatted: format(parseISO(nextUpcomingRaw.date), 'MMM d'),
        isTomorrow: nextUpcomingRaw.date === tomorrowStr,
        branch: nextUpcomingRaw.branch || 'Branch',
        startTime: nextUpcomingRaw.startTime || '09:00',
        endTime: nextUpcomingRaw.endTime || '22:00',
        timeString: `${nextUpcomingRaw.startTime || '09:00'} - ${nextUpcomingRaw.endTime || '22:00'}`
      };
    } else {
      nextShift = {
        hasShift: false,
        status: 'No upcoming shifts scheduled'
      };
    }

    const widgetPayload = {
      employeeName: myName.split(' ')[0],
      todayShift,
      nextShift,
      updatedAt: new Date().toISOString()
    };

    // 1. Save to Capacitor Preferences (native SharedPreferences on Android, UserDefaults on iOS/macOS)
    await Preferences.set({
      key: WIDGET_DATA_KEY,
      value: JSON.stringify(widgetPayload)
    });

    // 2. Also keep a copy in browser localStorage for web/PWA reference
    try {
      localStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetPayload));
    } catch (_) {}

    return widgetPayload;
  } catch (err) {
    console.warn('Widget sync error:', err);
  }
};

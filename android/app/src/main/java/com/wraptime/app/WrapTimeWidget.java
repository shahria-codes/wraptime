package com.wraptime.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Android Home Screen Widget for WrapTime.
 * Displays today's shift details (branch, time, status, teammates) and next upcoming shift.
 */
public class WrapTimeWidget extends AppWidgetProvider {

    private static final String PREF_NAME = "CapacitorStorage";
    private static final String KEY_WIDGET_DATA = "wraptime_widget_data";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_wraptime);

        // Click to open main app
        Intent intent = new Intent(context, MainActivity.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        // Retrieve shift data from Capacitor Preferences
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String jsonStr = prefs.getString(KEY_WIDGET_DATA, null);

        if (jsonStr == null) {
            // Fallback check standard preferences
            SharedPreferences defaultPrefs = android.preference.PreferenceManager.getDefaultSharedPreferences(context);
            jsonStr = defaultPrefs.getString(KEY_WIDGET_DATA, null);
        }

        if (jsonStr != null && !jsonStr.trim().isEmpty()) {
            try {
                JSONObject root = new JSONObject(jsonStr);

                // Employee Name
                String empName = root.optString("employeeName", "Staff");
                views.setTextViewText(R.id.widget_employee_name, empName);

                // Today's Shift
                JSONObject today = root.optJSONObject("todayShift");
                if (today != null && today.optBoolean("hasShift", false)) {
                    views.setTextViewText(R.id.widget_today_branch, today.optString("branch", "Branch"));
                    views.setTextViewText(R.id.widget_today_time, today.optString("timeString", "09:00 - 22:00"));
                    views.setTextViewText(R.id.widget_today_coworkers, today.optString("coworkers", "Solo Shift"));
                    views.setTextViewText(R.id.widget_today_status, today.optString("status", "Scheduled"));
                } else {
                    views.setTextViewText(R.id.widget_today_branch, "Off Duty");
                    views.setTextViewText(R.id.widget_today_time, "No shift today");
                    views.setTextViewText(R.id.widget_today_coworkers, "Rest Day 🏖️");
                    views.setTextViewText(R.id.widget_today_status, "Off Duty");
                }

                // Next / Upcoming Shift
                JSONObject next = root.optJSONObject("nextShift");
                if (next != null && next.optBoolean("hasShift", false)) {
                    boolean isTomorrow = next.optBoolean("isTomorrow", false);
                    String dayName = isTomorrow ? "Tomorrow" : next.optString("dayName", "Upcoming");
                    views.setTextViewText(R.id.widget_upcoming_day, dayName);
                    views.setTextViewText(R.id.widget_upcoming_branch, next.optString("branch", "Branch"));
                    views.setTextViewText(R.id.widget_upcoming_time, next.optString("timeString", "09:00 - 22:00"));
                    views.setTextViewText(R.id.widget_upcoming_date, next.optString("dateFormatted", ""));
                } else {
                    views.setTextViewText(R.id.widget_upcoming_day, "No Upcoming");
                    views.setTextViewText(R.id.widget_upcoming_branch, "Schedule Clear");
                    views.setTextViewText(R.id.widget_upcoming_time, "-- : --");
                    views.setTextViewText(R.id.widget_upcoming_date, "");
                }

            } catch (Exception e) {
                views.setTextViewText(R.id.widget_today_branch, "WrapTime");
                views.setTextViewText(R.id.widget_today_time, "Tap to open app");
            }
        } else {
            // Placeholder state before first login or sync
            views.setTextViewText(R.id.widget_employee_name, "Staff");
            views.setTextViewText(R.id.widget_today_branch, "Open WrapTime");
            views.setTextViewText(R.id.widget_today_time, "to sync schedule");
            views.setTextViewText(R.id.widget_today_coworkers, "Tap to launch");
            views.setTextViewText(R.id.widget_today_status, "Sync Ready");

            views.setTextViewText(R.id.widget_upcoming_day, "Upcoming");
            views.setTextViewText(R.id.widget_upcoming_branch, "Schedule");
            views.setTextViewText(R.id.widget_upcoming_time, "Will update auto");
            views.setTextViewText(R.id.widget_upcoming_date, "");
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}

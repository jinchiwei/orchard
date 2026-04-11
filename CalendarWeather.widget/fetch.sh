#!/bin/bash
# CalendarWeather: Fetch calendar grid, upcoming events, and weather
# Output: JSON

TMPDIR="${TMPDIR:-/tmp}"
WEATHER_FILE="$TMPDIR/cw_weather.json"
EVENTS_FILE="$TMPDIR/cw_events.txt"
EVENTS_AS_FILE="$TMPDIR/cw_events_as.txt"

# Get weather (only re-fetch if cache is >15 min old or missing)
WEATHER_TMP="$TMPDIR/cw_weather_tmp.json"
NEED_FETCH=1
if [ -f "$WEATHER_FILE" ]; then
  AGE=$(( $(date +%s) - $(stat -f %m "$WEATHER_FILE") ))
  [ "$AGE" -lt 900 ] && NEED_FETCH=0
fi
if [ "$NEED_FETCH" -eq 1 ]; then
  curl -s --max-time 10 "https://api.open-meteo.com/v1/forecast?latitude=37.77&longitude=-122.39&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America/Los_Angeles&forecast_days=1" > "$WEATHER_TMP" 2>/dev/null
  if python3 -c "import json; json.load(open('$WEATHER_TMP'))['current']" 2>/dev/null; then
    mv "$WEATHER_TMP" "$WEATHER_FILE"
  else
    rm -f "$WEATHER_TMP"
  fi
fi

# Get calendar events via icalBuddy (handles recurring events properly)
# Excludes holiday/birthday calendars; cannot see Siri Suggestions
/opt/homebrew/bin/icalBuddy -f -nc -nrd -npn -b "" -iep "title,datetime" -po "title,datetime" -df "|||%a %m/%d" -tf "%I:%M%p" -eed -ec "Birthdays,Reminders" eventsFrom:today to:"today+7" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | sed 's/^[[:space:]]*//' | awk '/^\|\|\|/{printf "%s\n", prev $0; prev=""; next} {if(prev!="") print prev; prev=$0} END{if(prev!="") print prev}' > "$EVENTS_FILE" || true

# Get Siri Suggestions events via AppleScript (icalBuddy can't see these)
osascript -e '
tell application "Calendar"
    set today to current date
    set time of today to 0
    set nextWeek to today + (7 * days)
    set output to ""
    try
        set c to calendar "Siri Suggestions"
        set evts to (every event of c whose start date >= today and start date < nextWeek)
        repeat with e in evts
            set sd to start date of e
            set ed to end date of e
            set mo to (month of sd as integer)
            set dy to day of sd
            set dw to (weekday of sd as string)
            set shortDay to text 1 thru 3 of dw
            set dur to (ed - sd)
            if dur >= 86000 then
                set timeStr to "all day"
            else
                set h to (time of sd) div 3600
                set m to ((time of sd) mod 3600) div 60
                set mStr to m as string
                if m < 10 then set mStr to "0" & mStr
                if h > 12 then
                    set timeStr to ((h - 12) as string) & ":" & mStr & "p"
                else if h = 12 then
                    set timeStr to "12:" & mStr & "p"
                else if h = 0 then
                    set timeStr to "12:" & mStr & "a"
                else
                    set timeStr to (h as string) & ":" & mStr & "a"
                end if
            end if
            set moStr to mo as string
            if mo < 10 then set moStr to "0" & moStr
            set dyStr to dy as string
            if dy < 10 then set dyStr to "0" & dyStr
            set output to output & (summary of e) & "|||" & shortDay & " " & moStr & "/" & dyStr & "|||" & timeStr & linefeed
        end repeat
    end try
    return output
end tell
' > "$EVENTS_AS_FILE" 2>/dev/null

python3 -c "
import json, calendar, datetime

# Parse weather
try:
    with open('$WEATHER_FILE') as f:
        w = json.load(f)
    weather = {
        'temp': round(w['current']['temperature_2m']),
        'code': w['current']['weather_code'],
        'high': round(w['daily']['temperature_2m_max'][0]),
        'low': round(w['daily']['temperature_2m_min'][0]),
    }
except:
    weather = {'temp': 0, 'code': 0, 'high': 0, 'low': 0}

# Build calendar grid
today = datetime.date.today()
cal = calendar.Calendar(firstweekday=6)
weeks = cal.monthdayscalendar(today.year, today.month)
cal_data = {
    'month': today.strftime('%B'),
    'year': today.year,
    'today': today.day,
    'weeks': weeks,
}

# Parse events from icalBuddy (format: title|||datetime)
events = []
seen = set()
try:
    with open('$EVENTS_FILE') as f:
        raw = f.read().strip()
    for line in raw.split('\n'):
        line = line.strip()
        if not line:
            continue
        parts = line.split('|||')
        if len(parts) >= 2:
            name = parts[0].strip()
            dt = parts[1].strip()
            if ' at ' in dt:
                date_part, time_part = dt.rsplit(' at ', 1)
                t = time_part.strip()
                if t.startswith('0'):
                    t = t[1:]
                t = t.replace('AM', 'a').replace('PM', 'p')
            else:
                date_part = dt
                t = 'all day'
            try:
                dp = date_part.split()[-1]
                m, d = dp.split('/')
                sort_key = int(m) * 100 + int(d)
            except:
                sort_key = 0
            key = (name, date_part.strip())
            if key not in seen:
                seen.add(key)
                events.append({'name': name, 'date': date_part.strip(), 'time': t, 'sort': sort_key})
except:
    pass

# Parse events from AppleScript/Siri Suggestions (format: title|||date|||time)
try:
    with open('$EVENTS_AS_FILE') as f:
        raw = f.read().strip()
    for line in raw.split('\n'):
        line = line.strip()
        if not line:
            continue
        parts = line.split('|||')
        if len(parts) >= 3:
            name = parts[0].strip()
            date_part = parts[1].strip()
            t = parts[2].strip()
            try:
                dp = date_part.split()[-1]
                m, d = dp.split('/')
                sort_key = int(m) * 100 + int(d)
            except:
                sort_key = 0
            key = (name, date_part)
            if key not in seen:
                seen.add(key)
                events.append({'name': name, 'date': date_part, 'time': t, 'sort': sort_key})
except:
    pass

events.sort(key=lambda e: (e.get('sort', 0), e.get('time', '')))
# Strip sort key before output
for e in events:
    e.pop('sort', None)
print(json.dumps({'weather': weather, 'calendar': cal_data, 'events': events[:5]}))
"

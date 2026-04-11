-- Playbox: Get current playback info as JSON
-- Supports Spotify (native) and YouTube (via Chrome)
-- Priority: Spotify playing > YouTube playing > Spotify paused > YouTube paused

on esc(txt)
	set output to ""
	repeat with c in (characters of txt)
		if c as string is "\"" then
			set output to output & "\\\""
		else if c as string is "\\" then
			set output to output & "\\\\"
		else
			set output to output & (c as string)
		end if
	end repeat
	return output
end esc

on getSpotify()
	tell application "System Events"
		if (name of processes) contains "Spotify" then
			tell application "Spotify"
				if player state is playing or player state is paused then
					set t to current track
					set n to name of t
					set a to artist of t
					set al to album of t
					set art to artwork url of t
					set d to duration of t
					set p to player position
					set s to player state as string
					return "{\"name\":\"" & my esc(n) & "\",\"artist\":\"" & my esc(a) & "\",\"album\":\"" & my esc(al) & "\",\"artwork\":\"" & art & "\",\"duration\":" & d & ",\"position\":" & p & ",\"state\":\"" & s & "\",\"source\":\"spotify\"}"
				end if
			end tell
		end if
	end tell
	return ""
end getSpotify

on getYouTube()
	-- Use JXA to find YouTube tabs (0.6s for 39 tabs vs 2min with AppleScript)
	set pausedResult to ""
	tell application "System Events"
		if (name of processes) does not contain "Google Chrome" then return ""
	end tell
	try
		set tabIndices to do shell script "osascript -l JavaScript -e '
var c = Application(\"Google Chrome\");
var r = [];
var ws = c.windows();
for (var i = 0; i < ws.length; i++) {
	var ts = ws[i].tabs();
	for (var j = 0; j < ts.length; j++) {
		if (ts[j].url().indexOf(\"youtube.com/watch\") !== -1) r.push((i+1) + \",\" + (j+1));
	}
}
r.join(\"|\");
'"
	on error
		return ""
	end try
	if tabIndices is "" then return ""
	-- Now only execute JS on the matched YouTube tabs (via AppleScript)
	tell application "Google Chrome"
		set tabList to my splitText(tabIndices, "|")
		repeat with entry in tabList
			set {winIdx, tabIdx} to my splitTextToNums(entry, ",")
			try
				set t to tab tabIdx of window winIdx
				set jsResult to execute t javascript "
					(function() {
						var v = document.querySelector('video');
						if (!v) return 'none';
						var title = document.querySelector('#title h1 yt-formatted-string');
						var channel = document.querySelector('#channel-name yt-formatted-string a');
						var vid = new URL(window.location.href).searchParams.get('v');
						var thumb = vid ? 'https://img.youtube.com/vi/' + vid + '/maxresdefault.jpg' : '';
						return JSON.stringify({
							name: title ? title.textContent.trim() : document.title.replace(' - YouTube', ''),
							artist: channel ? channel.textContent.trim() : '',
							album: 'YouTube',
							artwork: thumb,
							duration: Math.round(v.duration * 1000),
							position: v.currentTime,
							state: v.paused ? 'paused' : 'playing',
							source: 'youtube'
						});
					})();
				"
				if jsResult is not "none" then
					if jsResult contains "\"playing\"" then
						return jsResult
					else if pausedResult is "" then
						set pausedResult to jsResult
					end if
				end if
			end try
		end repeat
	end tell
	if pausedResult is not "" then return pausedResult
	return ""
end getYouTube

on splitText(theText, theDelimiter)
	set oldDelims to AppleScript's text item delimiters
	set AppleScript's text item delimiters to theDelimiter
	set theItems to text items of theText
	set AppleScript's text item delimiters to oldDelims
	return theItems
end splitText

on splitTextToNums(theText, theDelimiter)
	set parts to my splitText(theText, theDelimiter)
	return {(item 1 of parts) as integer, (item 2 of parts) as integer}
end splitTextToNums

-- Main: check both sources, return both if paused so widget can pick last-played
set spotifyData to my getSpotify()

-- If Spotify is playing, return immediately
if spotifyData contains "\"playing\"" then return spotifyData

-- Check YouTube
set youtubeData to my getYouTube()

-- YouTube playing beats Spotify paused
if youtubeData contains "\"playing\"" then return youtubeData

-- Both paused or only one available -- return both so widget picks last-played
if spotifyData is not "" and youtubeData is not "" then
	return "{\"both\":[" & spotifyData & "," & youtubeData & "]}"
end if
if spotifyData is not "" then return spotifyData
if youtubeData is not "" then return youtubeData

return "{\"state\":\"closed\"}"

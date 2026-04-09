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
	set playingResult to ""
	set pausedResult to ""
	tell application "System Events"
		if (name of processes) contains "Google Chrome" then
			tell application "Google Chrome"
				repeat with w in windows
					repeat with t in tabs of w
						if URL of t contains "youtube.com/watch" then
							try
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
										set playingResult to jsResult
										return playingResult
									else if pausedResult is "" then
										set pausedResult to jsResult
									end if
								end if
							end try
						end if
					end repeat
				end repeat
			end tell
		end if
	end tell
	if playingResult is not "" then return playingResult
	if pausedResult is not "" then return pausedResult
	return ""
end getYouTube

-- Main: check both sources, prioritize what's actively playing
set spotifyData to my getSpotify()
set youtubeData to my getYouTube()

-- If Spotify is playing, always prefer it
if spotifyData is not "" then
	if spotifyData contains "\"playing\"" then
		return spotifyData
	end if
end if

-- If YouTube is playing, show that
if youtubeData is not "" then
	if youtubeData contains "\"playing\"" then
		return youtubeData
	end if
end if

-- Nothing actively playing - show whichever is paused (Spotify first)
if spotifyData is not "" then return spotifyData
if youtubeData is not "" then return youtubeData

return "{\"state\":\"closed\"}"

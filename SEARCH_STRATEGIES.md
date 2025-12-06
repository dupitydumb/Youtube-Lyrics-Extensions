# Lyrics Search Strategies Documentation

## Overview

The YouTube Lyrics Extension now uses an intelligent multi-strategy search system to handle various YouTube video title formats and find the most accurate lyrics matches.

## Title Parsing Intelligence

### Supported YouTube Title Formats

The `TitleParser` class intelligently handles these common formats:

1. **"Song - Artist"** (e.g., "Bohemian Rhapsody - Queen")
   - Confidence: 0.75-0.9
   - Most common format

2. **"Artist - Song"** (e.g., "Coldplay - Viva La Vida")
   - Confidence: 0.8-0.9
   - Detected when channel name matches first part

3. **"Song" only** (e.g., "Sparks" by channel "Coldplay")
   - Confidence: 0.8
   - Uses channel name as artist
   - Ideal for official artist channels

4. **"Song (feat. Artist)"** (e.g., "Old Town Road (feat. Billy Ray Cyrus)")
   - Confidence: 0.7
   - Extracts featuring artist info

5. **"Song | Additional Info"** (e.g., "Stress Out | Blurryface Album")
   - Confidence: 0.6
   - Splits on pipe separator

### Smart Artist Detection

The parser determines artist vs song by:
- **Channel name matching**: If channel name matches one part with >70% similarity
- **Length comparison**: Shorter parts are likely artist names
- **Word patterns**: Artist names typically don't contain common song words (the, a, my, etc.)
- **Capitalization**: Artist names tend to be properly capitalized

## Search Strategy Sequence

The system tries 7 different search strategies in order of confidence:

### Strategy 1: Parsed Full (Highest Confidence)
- **Query**: Parsed song + parsed artist
- **When**: Parser confidence > 60%
- **Example**: "Sparks" → `"Sparks Coldplay"`
- **Best for**: Official channel uploads, properly formatted titles

### Strategy 2: Formatted with Channel
- **Query**: Filtered title + channel name
- **Filters**: Removes "official", "video", "lyrics", etc.
- **Example**: "Stress Out [Official Video]" → `"stress out twenty one pilots"`
- **Best for**: User uploads with descriptive titles

### Strategy 3: Raw with Channel
- **Query**: Original title + channel name
- **No filtering**: Keeps all words
- **Example**: "Stress Out - Twenty One Pilots" → `"Stress Out - Twenty One Pilots fueld by rayman"`
- **Best for**: When filtering might remove important words

### Strategy 4: Parsed Song Only
- **Query**: Just the parsed song name
- **When**: Parser confidence > 70%
- **Example**: "Sparks - Coldplay" → `"Sparks"`
- **Best for**: Official uploads where artist is in channel name

### Strategy 5: Formatted Title
- **Query**: Filtered title only (no channel)
- **Removes**: Common video markers
- **Best for**: When channel name is noise

### Strategy 6: Aggressive Format
- **Query**: Maximum filtering (removes brackets, parentheses, Korean chars)
- **Example**: "Stress Out [Official Video] (Lyrics)" → `"stress out"`
- **Best for**: Very cluttered titles

### Strategy 7: Raw Title (Last Resort)
- **Query**: Original title as-is
- **No modifications**
- **Best for**: When everything else fails

## Fuzzy Matching Algorithm

The `findBestMatch()` function scores results based on:

### Scoring Components

1. **Artist Similarity** (60% weight)
   - Uses character overlap ratio
   - Bonus +20% for exact case-insensitive match
   - Handles variations like "Twenty One Pilots" vs "twenty one pilots"

2. **Song Similarity** (40% weight)
   - Character overlap comparison
   - Less weighted than artist

3. **Synced Lyrics Bonus** (+10%)
   - Prefers results with time-synced lyrics

### Confidence Threshold
- Minimum score: 0.3 (30%)
- Below threshold: Returns first result
- Above threshold: Returns best-scored match

## Examples

### Example 1: Official Artist Channel
```
YouTube Video:
- Title: "Sparks"
- Channel: "Coldplay"

Parser Output:
- Song: "Sparks"
- Artist: "Coldplay"
- Confidence: 0.8

Search Flow:
1. Strategy 1: "Sparks Coldplay" ✓ Success
```

### Example 2: User Upload
```
YouTube Video:
- Title: "Stress Out - Twenty One Pilots [Official Video]"
- Channel: "fueld by rayman"

Parser Output:
- Song: "Stress Out"
- Artist: "Twenty One Pilots"
- Confidence: 0.9

Search Flow:
1. Strategy 1: "Stress Out Twenty One Pilots" ✓ Success
```

### Example 3: Minimal Title
```
YouTube Video:
- Title: "Shape of You"
- Channel: "Ed Sheeran"

Parser Output:
- Song: "Shape of You"
- Artist: "Ed Sheeran"
- Confidence: 0.8

Search Flow:
1. Strategy 1: "Shape of You Ed Sheeran" ✓ Success
```

### Example 4: Complex Format
```
YouTube Video:
- Title: "Bad Guy (Official Video) - Billie Eilish | 4K"
- Channel: "Music Videos HD"

Parser Output:
- Song: "Bad Guy"
- Artist: "Billie Eilish"
- Confidence: 0.8

Search Flow:
1. Strategy 1: "Bad Guy Billie Eilish" ✓ Success
```

## Performance Optimizations

### Caching
- All successful queries are cached for 24 hours
- Cache key: Exact search query string
- Maximum 50 cached entries
- Automatic expiry cleanup

### Early Exit
- Search stops on first successful result
- No unnecessary API calls
- Typical success: Strategy 1-3

### Strategy Filtering
- Disabled strategies are skipped
- Empty queries are ignored
- Minimum 2 characters required

## Algorithm Details

### String Similarity Calculation
```javascript
similarity = intersection.size / union.size

Where:
- intersection = common characters between strings
- union = all unique characters in both strings
```

**Example:**
```
"Coldplay" vs "coldplay"
- Similarity: 1.0 (exact match)

"Twenty One Pilots" vs "twenty one pilots"
- Similarity: 1.0 (case-insensitive)

"Ed Sheeran" vs "Ed Sheeran Official"
- Similarity: ~0.7 (partial match)
```

### Video Marker Removal
Automatically removes these patterns:
- `[Official Video]`, `(Official Video)`
- `[Lyrics]`, `(Lyrics)`
- `[Audio]`, `(Audio)`
- `[HD]`, `[4K]`
- `[Visualizer]`
- And case-insensitive variations

## Future Improvements

Potential enhancements for consideration:

1. **Strategy Learning**: Cache which strategy works for specific channels
2. **Levenshtein Distance**: More sophisticated string matching
3. **Duration Matching**: Compare video length with song duration from API
4. **Manual Override**: UI button for manual search correction
5. **Alternative APIs**: Fallback to Genius, Musixmatch when lrclib fails
6. **Language Detection**: Special handling for non-English titles
7. **Collaboration Detection**: Better parsing of "feat.", "ft.", "with" patterns

## Testing Recommendations

Test with these title patterns:
- ✅ "Song - Artist"
- ✅ "Artist - Song"
- ✅ "Song" (official channel)
- ✅ "Song (Official Video)"
- ✅ "Song [Official Audio]"
- ✅ "Song (feat. Artist)"
- ✅ "Song | Album Name"
- ✅ Mixed case variations
- ✅ Non-English characters
- ✅ Very long titles
- ✅ Minimal titles

## Troubleshooting

### No lyrics found
- Check if song exists in lrclib.net database
- Try manual search on lrclib.net
- Video might be covers, remixes, or live versions

### Wrong song matched
- Artist name in video title might differ from database
- Try uploading from official channel
- Check for spelling variations

### Low confidence matches
- Extension will show multiple options when available
- Select correct version from song selector dropdown

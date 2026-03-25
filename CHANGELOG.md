# Changelog

## V1.0.7

### Added
- Feed list is collapsed to a nav drawer on smaller screens.

### Fixed
- Feed settings section is scrollable on smaller screens.
- Fix old HTML being cached after an update.
- Hopefully fix auto-updates.

## V1.0.6

### Added
- Custom feeds where articles are added manually.
- Changing episode play button to a generate button when audio hasn't been generated yet.
- Expandable episodes with more details and options.
- Option to archive an episode so it doesn't appear in the podcast feed.

### Fixed
- Setting feed generation mode to "every episode" doesn't immediately generate audio for existing episodes.

## V1.0.5

### Added
- Better episode description with link to source article.
- Episode generation queue to avoid hitting service limits.
- Estimated duration of episodes before the audio has been generated.
- Option to manually check for a new version from the settings dialog.

## V1.0.4

### Added
- Estimated progress for episodes currently being generated.
- Improved image descriptions with transition phrases and longer output.

## V1.0.3

### Added
- Can manually edit an episode's transcript.

### Fixed
- Database upgrade scripts load properly from compiled exe.

## V1.0.2

### Added
- Confirmation prompt when deleting a feed.
- Option to provide an OpenAI API or Gemini key to produce audio descriptions for images.
- Per-episode voice selection.
- Preview the transcript of an episode.
- Server address can start with https:// to indicate a secure connection.

### Fixed
- Gender in voice description is detected instead of guessing from name.
- New feed is selected after it's created.
- Settings dialog scrolls properly on smaller screens.
- Canceling settings dialog discards changes.
- Podcast RSS is valid now.
- Fixing restart after changing server configuration.

## V1.0.1

### Fixed
- Fixed "Cannot find module" error when starting standalone executable.

## v1.0.0
Initial release
- Basic feed management.
    - Generation mode: on demand or every episode.
    - Content source: feed article or source page.
    - Voice selection with filtering and previews.
- Support for multiple TTS providers: OpenAI, ElevenLabs, Inworld, and Lemonfox.
- Desktop integration for Windows with system-tray app and auto-updates.
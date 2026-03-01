# Changelog

## Unreleased

### Added
- Confirmation prompt when deleting a feed.

### Fixed
- Gender in voice description is detected instead of guessing from name.
- New feed is selected after it's created.

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
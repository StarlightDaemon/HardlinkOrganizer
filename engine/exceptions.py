"""
Custom exceptions for the Hardlink Organizer engine.

Using typed exceptions instead of sys.exit() allows the web layer to handle
failures gracefully without killing the server process.
"""


class HardlinkOrganizerError(Exception):
    """Base exception for all hardlink organizer errors."""


class ConfigError(HardlinkOrganizerError):
    """Raised when the configuration file is missing, invalid, or unreadable."""


class ScanError(HardlinkOrganizerError):
    """Raised when a scan operation cannot proceed (e.g. unknown source set)."""


class ValidationError(HardlinkOrganizerError):
    """Raised when a pre-execution validation check fails."""


class LinkError(HardlinkOrganizerError):
    """Raised when a link operation fails fatally before any files are written."""

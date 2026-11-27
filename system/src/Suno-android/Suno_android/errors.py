class SunoAndroidError(Exception):
    """Expected error suitable for a user-facing diagnostic."""


class ApkValidationError(SunoAndroidError):
    """The supplied APK failed the bounded pre-install checks."""


class RuntimeUnavailableError(SunoAndroidError):
    """The configured Android runtime is unavailable or unhealthy."""

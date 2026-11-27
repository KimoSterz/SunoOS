"""Typed errors for Mod inspection and resolution."""


class SunoModsError(Exception):
    """Base error suitable for a bounded user-facing explanation."""


class ManifestValidationError(SunoModsError):
    """The supplied Mod manifest is malformed or outside the contract."""


class CatalogError(SunoModsError):
    """The local catalog is ambiguous or malformed."""


class ResolutionError(SunoModsError):
    """A Mod cannot be resolved for the requested host state."""


class TrustError(SunoModsError):
    """A trust policy or cryptographic verification result is invalid."""


class StateError(SunoModsError):
    """Persistent Mod state is unsafe, malformed, stale, or inconsistent."""


class TransactionError(SunoModsError):
    """A bounded Mod lifecycle transaction cannot safely continue."""


class InventoryError(SunoModsError):
    """Read-only host inventory could not be collected safely."""


class CatalogUpdateError(SunoModsError):
    """Trusted catalog metadata or artifacts could not be refreshed safely."""

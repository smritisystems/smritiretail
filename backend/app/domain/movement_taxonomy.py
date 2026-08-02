"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 3.29.0
Created      : 2026-08-02
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Inventory Kernel — Movement Taxonomy & Behavior Registry
=========================================================

STATUS: FROZEN — Inventory Kernel v1.0 (RC2)

This module defines the canonical movement type taxonomy for the SMRITI
Inventory State Engine. Movement behaviors are declared as metadata rather
than encoded as imperative switch statements.

Architecture
------------

    MovementProvider (ABC)
            │
            ▼
    CoreMovementProvider         ← Standard RC2 movement types
    MedicalMovementProvider      ← SDK: registers QUARANTINE, RELEASE_QUARANTINE
    JewelleryMovementProvider    ← SDK: registers MELTING, REFINING
    FootwearMovementProvider     ← SDK: registers PAIR_SPLIT, PAIR_JOIN
            │
            ▼
    MovementTypeRegistry         ← Read-only after initialization
            │
            ▼
    InventoryStateService        ← Consumes registry; zero switch statements


State Engine Dispatch Pattern (RC2 canonical)
---------------------------------------------

    behavior = _REGISTRY.get(movement.movement_type)

    if behavior.affects_physical_stock:
        update_on_hand(delta)

    if behavior.affects_reservation:
        update_reserved(delta)

    if behavior.affects_channel_stock:
        update_channel(delta)

    if behavior.affects_transit:
        update_transit(delta)

    if behavior.affects_inventory_value:
        update_valuation(movement)


Platform Rule (FROZEN — Inventory Kernel v1.0)
----------------------------------------------
No engine may update `products.stock` directly except through the
Inventory State reconciliation pipeline (trg_inventory_state_reconciliation).
"""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from enum import Enum
from typing import ClassVar, Dict, List


# ---------------------------------------------------------------------------
# Movement Category
# ---------------------------------------------------------------------------

class MovementCategory(str, Enum):
    """High-level classification of a movement type.

    PHYSICAL movements affect actual warehouse stock quantities (products.stock).
    BUSINESS movements affect reservation / allocation / channel state only.
    """
    PHYSICAL = "PHYSICAL"
    BUSINESS = "BUSINESS"


# ---------------------------------------------------------------------------
# Movement Behavior — declarative metadata record (RC2 frozen schema)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class MovementBehavior:
    """
    Declarative behavior descriptor for a single movement type.

    Fields
    ------
    movement_type       : Canonical upper-case movement type string.
    category            : PHYSICAL or BUSINESS.
    direction           : +1 (inbound / receipt), -1 (outbound / issue),
                          0 (neutral / state-only).
                          For ADJUSTMENT the caller supplies a signed quantity;
                          direction is treated as +1 here and the sign is
                          embedded in the quantity value itself.
    affects_physical_stock  : True → trigger must update products.stock.
    affects_reservation     : True → update reserved_stock column.
    affects_channel_stock   : True → update channel stock projection.
    affects_transit         : True → movement represents in-transit quantity.
    affects_inventory_value : True → movement changes FIFO/WAC inventory value.
                              (Valuation engine is RC3 work; flag is frozen now
                              so future accounting integration has stable metadata.)
    description         : Human-readable summary for documentation & UI tooltips.
    """
    movement_type:           str
    category:                MovementCategory
    direction:               int             # +1, -1, or 0
    affects_physical_stock:  bool
    affects_reservation:     bool
    affects_channel_stock:   bool
    affects_transit:         bool
    affects_inventory_value: bool
    description:             str = field(default="", compare=False)

    def __post_init__(self) -> None:
        if self.direction not in (-1, 0, 1):
            raise ValueError(
                f"MovementBehavior.direction must be -1, 0, or 1; "
                f"got {self.direction!r} for movement_type={self.movement_type!r}"
            )


# ---------------------------------------------------------------------------
# MovementProvider — abstract plugin interface
# ---------------------------------------------------------------------------

class MovementProvider(abc.ABC):
    """
    Abstract base for movement type providers.

    Every provider exposes a list of MovementBehavior records.
    The Inventory Kernel loads providers at startup; the registry
    is read-only after initialization.

    SDK modules (Medical, Jewellery, Footwear, etc.) subclass this
    to register domain-specific movement types without touching
    core kernel logic.
    """

    @abc.abstractmethod
    def get_movement_behaviors(self) -> List[MovementBehavior]:
        """Return all MovementBehavior records owned by this provider."""
        ...


# ---------------------------------------------------------------------------
# CoreMovementProvider — RC2 frozen standard taxonomy
# ---------------------------------------------------------------------------

class CoreMovementProvider(MovementProvider):
    """
    Standard movement types for the SMRITI Inventory Kernel v1.0.

    Taxonomy is split into two groups:

    Physical movements  — affect products.stock (On Hand)
    Business movements  — affect reservation / channel / transit state

    Legacy types (IN, OUT, TRANSFER, RETURN, SALES) are retained for
    backward compatibility with existing stock_movements records written
    before RC2. They map to their canonical equivalents via direction flags.
    """

    def get_movement_behaviors(self) -> List[MovementBehavior]:
        return [

            # -----------------------------------------------------------
            # Physical Movements — affect On Hand (products.stock)
            # -----------------------------------------------------------

            MovementBehavior(
                movement_type="PURCHASE",
                category=MovementCategory.PHYSICAL,
                direction=+1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description="Goods received from supplier via Purchase Order / GRN.",
            ),
            MovementBehavior(
                movement_type="PURCHASE_RETURN",
                category=MovementCategory.PHYSICAL,
                direction=-1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description="Goods returned to supplier; reduces On Hand and valuation.",
            ),
            MovementBehavior(
                movement_type="SALE",
                category=MovementCategory.PHYSICAL,
                direction=-1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description="Goods issued to customer via Sales Invoice / POS.",
            ),
            MovementBehavior(
                movement_type="SALE_RETURN",
                category=MovementCategory.PHYSICAL,
                direction=+1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description="Goods returned by customer; increases On Hand.",
            ),
            MovementBehavior(
                movement_type="TRANSFER_OUT",
                category=MovementCategory.PHYSICAL,
                direction=-1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=True,
                affects_inventory_value=False,
                description="Stock dispatched from source location for inter-branch transfer.",
            ),
            MovementBehavior(
                movement_type="TRANSFER_IN",
                category=MovementCategory.PHYSICAL,
                direction=+1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=True,
                affects_inventory_value=False,
                description="Stock received at destination location after inter-branch transfer.",
            ),
            MovementBehavior(
                movement_type="ADJUSTMENT",
                category=MovementCategory.PHYSICAL,
                direction=+1,          # caller supplies signed quantity
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description=(
                    "Cycle-count or ad-hoc stock adjustment. "
                    "Quantity is signed: positive = gain, negative = loss."
                ),
            ),
            MovementBehavior(
                movement_type="PRODUCTION",
                category=MovementCategory.PHYSICAL,
                direction=+1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description="Finished goods receipt from manufacturing / assembly.",
            ),
            MovementBehavior(
                movement_type="OPENING",
                category=MovementCategory.PHYSICAL,
                direction=+1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description="Opening balance entry at system go-live or period start.",
            ),

            # -----------------------------------------------------------
            # Legacy Physical Types (backward compatibility — RC2)
            # These existed before RC2 canonical taxonomy was frozen.
            # New code must use canonical types above.
            # -----------------------------------------------------------

            MovementBehavior(
                movement_type="IN",
                category=MovementCategory.PHYSICAL,
                direction=+1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description="[LEGACY] Generic inbound movement. Use PURCHASE or TRANSFER_IN.",
            ),
            MovementBehavior(
                movement_type="OUT",
                category=MovementCategory.PHYSICAL,
                direction=-1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description="[LEGACY] Generic outbound movement. Use SALE or TRANSFER_OUT.",
            ),
            MovementBehavior(
                movement_type="TRANSFER",
                category=MovementCategory.PHYSICAL,
                direction=-1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=True,
                affects_inventory_value=False,
                description="[LEGACY] Undirected transfer. Use TRANSFER_OUT / TRANSFER_IN.",
            ),
            MovementBehavior(
                movement_type="RETURN",
                category=MovementCategory.PHYSICAL,
                direction=+1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description="[LEGACY] Generic return. Use PURCHASE_RETURN or SALE_RETURN.",
            ),
            MovementBehavior(
                movement_type="SALES",
                category=MovementCategory.PHYSICAL,
                direction=-1,
                affects_physical_stock=True,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=True,
                description="[LEGACY] Alias for SALE.",
            ),

            # -----------------------------------------------------------
            # Business Movements — affect reservation / channel state only
            # Do NOT update products.stock
            # -----------------------------------------------------------

            MovementBehavior(
                movement_type="RESERVE",
                category=MovementCategory.BUSINESS,
                direction=+1,
                affects_physical_stock=False,
                affects_reservation=True,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=False,
                description="Soft-reserve quantity against a Sales Order or quotation.",
            ),
            MovementBehavior(
                movement_type="UNRESERVE",
                category=MovementCategory.BUSINESS,
                direction=-1,
                affects_physical_stock=False,
                affects_reservation=True,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=False,
                description="Release a soft-reservation (cancellation or expiry).",
            ),
            MovementBehavior(
                movement_type="ALLOCATE",
                category=MovementCategory.BUSINESS,
                direction=+1,
                affects_physical_stock=False,
                affects_reservation=True,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=False,
                description="Hard-allocate reserved stock to a pick task or shipment.",
            ),
            MovementBehavior(
                movement_type="DEALLOCATE",
                category=MovementCategory.BUSINESS,
                direction=-1,
                affects_physical_stock=False,
                affects_reservation=True,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=False,
                description="Release a hard-allocation (order amendment or cancellation).",
            ),
            MovementBehavior(
                movement_type="PICK",
                category=MovementCategory.BUSINESS,
                direction=0,
                affects_physical_stock=False,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=False,
                description="WMS pick confirmation event. Audit trail only at this stage.",
            ),
            MovementBehavior(
                movement_type="PACK",
                category=MovementCategory.BUSINESS,
                direction=0,
                affects_physical_stock=False,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=False,
                affects_inventory_value=False,
                description="WMS pack confirmation event. Audit trail only at this stage.",
            ),
            MovementBehavior(
                movement_type="SHIP",
                category=MovementCategory.BUSINESS,
                direction=0,
                affects_physical_stock=False,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=True,
                affects_inventory_value=False,
                description="Shipment dispatched; goods are in transit.",
            ),
            MovementBehavior(
                movement_type="DISPATCH",
                category=MovementCategory.BUSINESS,
                direction=0,
                affects_physical_stock=False,
                affects_reservation=False,
                affects_channel_stock=False,
                affects_transit=True,
                affects_inventory_value=False,
                description="Generic dispatch event for non-channel orders.",
            ),
            MovementBehavior(
                movement_type="CHANNEL_DISPATCH",
                category=MovementCategory.BUSINESS,
                direction=-1,
                affects_physical_stock=False,
                affects_reservation=False,
                affects_channel_stock=True,
                affects_transit=False,
                affects_inventory_value=False,
                description="Marketplace channel dispatch; reduces channel-locked stock.",
            ),
        ]


# ---------------------------------------------------------------------------
# MovementTypeRegistry — read-only after initialization
# ---------------------------------------------------------------------------

class MovementTypeRegistry:
    """
    Central registry of all known MovementBehavior records.

    Lifecycle
    ---------
    1. Kernel initializes registry at startup by loading providers.
    2. After initialization, `_sealed = True`; no further providers may register.
    3. SDK providers must be loaded before sealing (container startup phase).

    Thread Safety
    -------------
    The registry is built once during process startup and is thereafter
    read-only. No locking is required for reads.
    """

    _behaviors: ClassVar[Dict[str, MovementBehavior]] = {}
    _sealed: ClassVar[bool] = False
    _UNKNOWN: ClassVar[MovementBehavior | None] = None

    @classmethod
    def register_provider(cls, provider: MovementProvider) -> None:
        """
        Load all behaviors from *provider* into the registry.

        Raises RuntimeError if the registry has already been sealed.
        Raises ValueError if a provider attempts to overwrite an existing type.
        """
        if cls._sealed:
            raise RuntimeError(
                "MovementTypeRegistry is sealed. Providers must be registered "
                "before the kernel is initialized."
            )
        for behavior in provider.get_movement_behaviors():
            key = behavior.movement_type.upper()
            if key in cls._behaviors:
                raise ValueError(
                    f"MovementTypeRegistry: duplicate movement_type {key!r} "
                    f"registered by {type(provider).__name__}."
                )
            cls._behaviors[key] = behavior

    @classmethod
    def seal(cls) -> None:
        """
        Seal the registry. No further providers can be registered.
        Called automatically after kernel initialization.
        """
        cls._sealed = True
        # Build the unknown sentinel once
        cls._UNKNOWN = MovementBehavior(
            movement_type="__UNKNOWN__",
            category=MovementCategory.PHYSICAL,
            direction=0,
            affects_physical_stock=False,
            affects_reservation=False,
            affects_channel_stock=False,
            affects_transit=False,
            affects_inventory_value=False,
            description="Sentinel for unrecognized movement types (no state update).",
        )

    @classmethod
    def get(cls, movement_type: str | None) -> MovementBehavior:
        """
        Resolve a movement_type string to its MovementBehavior.

        Returns the UNKNOWN sentinel for unrecognized or None types,
        ensuring the state engine never raises on unfamiliar data.
        """
        if not movement_type:
            return cls._UNKNOWN or cls._build_unknown()
        behavior = cls._behaviors.get(movement_type.upper())
        if behavior is None:
            return cls._UNKNOWN or cls._build_unknown()
        return behavior

    @classmethod
    def known_types(cls) -> List[str]:
        """Return a sorted list of all registered movement type strings."""
        return sorted(cls._behaviors.keys())

    @classmethod
    def is_sealed(cls) -> bool:
        return cls._sealed

    @staticmethod
    def _build_unknown() -> MovementBehavior:
        return MovementBehavior(
            movement_type="__UNKNOWN__",
            category=MovementCategory.PHYSICAL,
            direction=0,
            affects_physical_stock=False,
            affects_reservation=False,
            affects_channel_stock=False,
            affects_transit=False,
            affects_inventory_value=False,
            description="Sentinel for unrecognized movement types.",
        )


# ---------------------------------------------------------------------------
# Module-level initialization — load CoreMovementProvider and seal
# ---------------------------------------------------------------------------

def _initialize_registry() -> None:
    """
    Bootstrap the registry with the core movement taxonomy.
    Called once at module import time.
    SDK providers must call MovementTypeRegistry.register_provider()
    before the application starts handling requests.
    """
    MovementTypeRegistry.register_provider(CoreMovementProvider())
    MovementTypeRegistry.seal()


_initialize_registry()

"use client";

// Re-export shared types and constants
export * from "./widget-types";

/* Re-export split widget components.
   `RepairWidgets` і `InventoryWidgets` видалені: у першому жив лише
   `SLASupplyChainMonitor`, у другому — `StockAlerts`, і жоден із них не
   рендерився ніде. Низький запас показує `AttentionSection` на дашборді,
   а стан ремонтів — `RepairQueueCard`. */
export * from "./SalesWidgets";
export * from "./FinanceWidgets";
export * from "./IntelligenceWidgets";

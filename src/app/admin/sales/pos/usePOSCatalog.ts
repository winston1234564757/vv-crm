import { useState, useMemo } from "react";
import { Device, Accessory, Part, Service, CartItem } from "./pos-types";

export function usePOSCatalog(
  devices: Device[],
  accessories: Accessory[],
  parts: Part[],
  services: Service[],
  cart: CartItem[]
) {
  const [activeCategory, setActiveCategory] = useState<"device" | "accessory" | "part" | "service" | null>(null);
  const [activeAccessoryCategory, setActiveAccessoryCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const inStockDevices = useMemo(() => {
    const cartDeviceIds = new Set(cart.filter(c => c.item_type === "device").map(c => c.id));
    return devices.filter(d => d.status === "in_stock" && !cartDeviceIds.has(d.id));
  }, [devices, cart]);

  const activeAccessories = useMemo(() => {
    return accessories.filter(a => a.stock > 0 && a.status === "active");
  }, [accessories]);

  const activeParts = useMemo(() => {
    return parts.filter(p => p.stock > 0);
  }, [parts]);

  const activeServices = useMemo(() => {
    return services.filter(s => s.status === "active");
  }, [services]);

  const filteredCatalogItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (activeCategory === "device") {
      return inStockDevices.filter(d => 
        `${d.brand} ${d.model}`.toLowerCase().includes(query) || (d.imei && d.imei.includes(query))
      );
    }
    if (activeCategory === "accessory") {
      let filtered = activeAccessories;
      if (activeAccessoryCategory !== "all") {
        filtered = filtered.filter(a => a.type === activeAccessoryCategory);
      }
      return filtered.filter(a => 
        a.name.toLowerCase().includes(query) || (a.sku && a.sku.toLowerCase().includes(query))
      );
    }
    if (activeCategory === "part") {
      return activeParts.filter(p => 
        p.name.toLowerCase().includes(query) || (p.sku && p.sku.toLowerCase().includes(query))
      );
    }
    if (activeCategory === "service") {
      return activeServices.filter(s => s.name.toLowerCase().includes(query));
    }
    return [];
  }, [activeCategory, activeAccessoryCategory, searchQuery, inStockDevices, activeAccessories, activeParts, activeServices]);

  const recommendations = useMemo(() => {
    if (cart.length === 0) return [];

    const recs: Array<{
      item: Accessory | Part;
      type: "accessory" | "part";
      reason: string;
      isHighMargin: boolean;
    }> = [];

    const addedIds = new Set<string>();

    const checkHighMargin = (price: number, cost: number) => {
      if (!price || !cost) return false;
      return (price - cost) / cost >= 1.0; 
    };

    const hasChargingPort = cart.some(c => c.name.toLowerCase().includes("гнізд"));
    const hasScreen = cart.some(c => 
      c.name.toLowerCase().includes("екран") || 
      c.name.toLowerCase().includes("скло") || 
      c.name.toLowerCase().includes("диспл")
    );
    const hasBattery = cart.some(c => 
      c.name.toLowerCase().includes("акумул") || 
      c.name.toLowerCase().includes("батаре")
    );
    const hasDevice = cart.some(c => c.item_type === "device");

    const isAlreadyInCart = (id: string, type: string) => {
      return cart.some(c => c.id === id && c.item_type === type);
    };

    if (hasChargingPort) {
      accessories.forEach(acc => {
        if (acc.stock > 0 && acc.status === "active" && !isAlreadyInCart(acc.id, "accessory") && !addedIds.has(acc.id)) {
          const lowerName = acc.name.toLowerCase();
          if (
            lowerName.includes("кабель") || 
            lowerName.includes("зарядк") || 
            lowerName.includes("кабел") || 
            lowerName.includes("зарядн") || 
            lowerName.includes("usb") || 
            lowerName.includes("type-c") || 
            lowerName.includes("lightning")
          ) {
            recs.push({ 
              item: acc, 
              type: "accessory", 
              reason: "До ремонту гнізда (новий кабель / зарядний пристрій)",
              isHighMargin: checkHighMargin(acc.price, acc.cost_price)
            });
            addedIds.add(acc.id);
          }
        }
      });
    }

    if (hasScreen) {
      accessories.forEach(acc => {
        if (acc.stock > 0 && acc.status === "active" && !isAlreadyInCart(acc.id, "accessory") && !addedIds.has(acc.id)) {
          const lowerName = acc.name.toLowerCase();
          if (lowerName.includes("скло") || lowerName.includes("плівк") || lowerName.includes("захисн")) {
            recs.push({ 
              item: acc, 
              type: "accessory", 
              reason: "До заміни екрану (захисне скло / плівка)",
              isHighMargin: checkHighMargin(acc.price, acc.cost_price)
            });
            addedIds.add(acc.id);
          }
        }
      });
    }

    if (hasBattery) {
      accessories.forEach(acc => {
        if (acc.stock > 0 && acc.status === "active" && !isAlreadyInCart(acc.id, "accessory") && !addedIds.has(acc.id)) {
          const lowerName = acc.name.toLowerCase();
          if (
            lowerName.includes("powerbank") || 
            lowerName.includes("паверб") || 
            lowerName.includes("зарядк") || 
            lowerName.includes("зарядн") || 
            lowerName.includes("акумулятор")
          ) {
            recs.push({ 
              item: acc, 
              type: "accessory", 
              reason: "До нового акумулятора (павербанк / зарядка)",
              isHighMargin: checkHighMargin(acc.price, acc.cost_price)
            });
            addedIds.add(acc.id);
          }
        }
      });
    }

    if (hasDevice) {
      accessories.forEach(acc => {
        if (acc.stock > 0 && acc.status === "active" && !isAlreadyInCart(acc.id, "accessory") && !addedIds.has(acc.id)) {
          const lowerName = acc.name.toLowerCase();
          if (
            lowerName.includes("чохол") || 
            lowerName.includes("чехол") || 
            lowerName.includes("скло") || 
            lowerName.includes("кабель") || 
            lowerName.includes("плівк")
          ) {
            recs.push({ 
              item: acc, 
              type: "accessory", 
              reason: "Супутній аксесуар до придбаного пристрою",
              isHighMargin: checkHighMargin(acc.price, acc.cost_price)
            });
            addedIds.add(acc.id);
          }
        }
      });
    }

    if (recs.length === 0) {
      const topAccessories = [...accessories]
        .filter(acc => acc.stock > 0 && acc.status === "active" && !isAlreadyInCart(acc.id, "accessory"))
        .sort((a, b) => {
          const marginA = a.price - a.cost_price;
          const marginB = b.price - b.cost_price;
          return marginB - marginA; 
        })
        .slice(0, 3);
      
      topAccessories.forEach(acc => {
        recs.push({ 
          item: acc, 
          type: "accessory", 
          reason: "Рекомендований аксесуар з високою прибутковістю",
          isHighMargin: checkHighMargin(acc.price, acc.cost_price)
        });
      });
    }

    return recs.sort((a, b) => (b.isHighMargin ? 1 : 0) - (a.isHighMargin ? 1 : 0)).slice(0, 3);
  }, [cart, accessories, parts]);

  return {
    activeCategory,
    setActiveCategory,
    activeAccessoryCategory,
    setActiveAccessoryCategory,
    searchQuery,
    setSearchQuery,
    inStockDevices,
    activeAccessories,
    activeParts,
    activeServices,
    filteredCatalogItems,
    recommendations
  };
}

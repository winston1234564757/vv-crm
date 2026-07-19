import { motion } from "framer-motion";
import { IconSearch, IconDevice, IconAccessory, IconBox, IconRepair } from "@/components/icons";
import { Device, Accessory, Part, Service, CatalogItem } from "./pos-types";

interface POSCatalogProps {
  activeMobileTab: "catalog" | "cart";
  activeCategory: "device" | "accessory" | "part" | "service" | null;
  setActiveCategory: (category: "device" | "accessory" | "part" | "service" | null) => void;
  activeAccessoryCategory: string;
  setActiveAccessoryCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredCatalogItems: CatalogItem[];
  addToCart: (item: CatalogItem, type: "device" | "accessory" | "part" | "service") => void;
  inStockDevicesCount: number;
  activeServicesCount: number;
}

export function POSCatalog({
  activeMobileTab,
  activeCategory,
  setActiveCategory,
  activeAccessoryCategory,
  setActiveAccessoryCategory,
  searchQuery,
  setSearchQuery,
  filteredCatalogItems,
  addToCart,
  inStockDevicesCount,
  activeServicesCount
}: POSCatalogProps) {
  return (
    <div className={`${activeMobileTab === "catalog" ? "flex" : "hidden lg:flex"} w-full lg:w-[58%] flex-col gap-4 max-h-[85vh] overflow-y-auto pr-1`}>
      {/* Bento header and Navigation */}
      <div className="flex items-center justify-between bg-white border border-warm-border/50 p-4 rounded-xl">
        <div>
          <span className="text-[10px] font-bold text-violet tracking-wider uppercase">Візуальна Вітрина POS</span>
          <h1 className="text-lg font-bold text-text-primary mt-0.5 text-balance tracking-tight">
            {activeCategory === null ? "Каталог категорій" : 
             activeCategory === "device" ? "Смартфони та Девайси" :
             activeCategory === "accessory" ? "Складські Аксесуари" :
             activeCategory === "part" ? "Запчастини зі Складу" : "Послуги майстерні"}
          </h1>
        </div>

        {activeCategory !== null && (
          <button
            onClick={() => { setActiveCategory(null); setSearchQuery(""); }}
            className="btn-press flex items-center gap-2 rounded-xl bg-violet/10 hover:bg-violet/20 border border-violet/30 text-violet px-6 py-3 text-sm font-bold shadow-sm active:scale-95 transition-all duration-200"
          >
            ← Назад до категорій
          </button>
        )}
      </div>

      {/* Category listing (Bento Grid) */}
      {activeCategory === null ? (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.08 }
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
        >
          {/* Devices Category Card (Wide) */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ scale: 1.02, y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveCategory("device")}
            className="md:col-span-2 cursor-pointer relative overflow-hidden rounded-3xl min-h-[160px] bg-cyan text-white p-5 flex flex-col justify-between shadow-sm transition-all duration-300 group"
          >
            <div className="absolute right-4 bottom-2 opacity-15 transform translate-y-1 translate-x-1 group-hover:scale-110 transition-transform duration-300">
              <IconDevice size={130} />
            </div>
            <span className="bg-white/25 text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full w-max">
              {inStockDevicesCount} шт. в наявності
            </span>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Техніка</h3>
              <p className="text-xs text-white/80 mt-1">Телефони, планшети, унікальні IMEI товари</p>
            </div>
          </motion.div>

          {/* Accessories Category Card */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ scale: 1.02, y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveCategory("accessory")}
            className="cursor-pointer relative overflow-hidden rounded-3xl min-h-[160px] bg-violet text-white p-5 flex flex-col justify-between shadow-sm transition-all duration-300 group"
          >
            <div className="absolute right-3 bottom-1 opacity-20 group-hover:scale-110 transition-transform duration-300">
              <IconAccessory size={95} />
            </div>
            <span className="bg-white/25 text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full w-max">
              Активні товари
            </span>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Аксесуари</h3>
              <p className="text-[11px] text-white/85 mt-1">Скла, кабелі, чохли</p>
            </div>
          </motion.div>

          {/* Parts Category Card */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ scale: 1.02, y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveCategory("part")}
            className="cursor-pointer relative overflow-hidden rounded-3xl min-h-[160px] bg-amber text-white p-5 flex flex-col justify-between shadow-sm transition-all duration-300 group"
          >
            <div className="absolute right-3 bottom-1 opacity-20 group-hover:scale-110 transition-transform duration-300">
              <IconBox size={95} />
            </div>
            <span className="bg-white/25 text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full w-max">
              Склад деталей
            </span>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Запчастини</h3>
              <p className="text-[11px] text-white/85 mt-1">Окремий продаж деталей клієнту</p>
            </div>
          </motion.div>

          {/* Services Category Card (Wide) */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ scale: 1.02, y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveCategory("service")}
            className="md:col-span-2 cursor-pointer relative overflow-hidden rounded-3xl min-h-[160px] bg-emerald text-white p-5 flex flex-col justify-between shadow-sm transition-all duration-300 group"
          >
            <div className="absolute right-4 bottom-2 opacity-20 group-hover:scale-110 transition-transform duration-300">
              <IconRepair size={115} />
            </div>
            <span className="bg-white/25 text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full w-max">
              {activeServicesCount} послуг в каталозі
            </span>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Послуги</h3>
              <p className="text-xs text-white/85 mt-1">Роботи з наклеювання, чищення та налаштування</p>
            </div>
          </motion.div>

        </motion.div>
      ) : (
        /* Category's Products view */
        <div className="space-y-4">
          
          {/* Search Input for items */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
              <IconSearch size={15} />
            </span>
            <input
              type="text"
              placeholder="Пошук за назвою, брендом, моделлю чи кодом..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-warm-border bg-white pl-9 pr-4 py-3 text-sm text-text-primary outline-none focus:border-violet/40"
            />
          </div>

          {/* Accessory Subcategories */}
          {activeCategory === "accessory" && (
            <div className="flex flex-wrap gap-2 mb-2">
              {[
                { id: "all", label: "Всі" },
                { id: "case", label: "Чохли" },
                { id: "charger", label: "Зарядні" },
                { id: "cable", label: "Кабелі" },
                { id: "headphones", label: "Навушники" },
                { id: "screen_protector", label: "Скло" },
                { id: "other", label: "Інше" }
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveAccessoryCategory(sub.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    activeAccessoryCategory === sub.id
                      ? "bg-violet text-white shadow-sm"
                      : "bg-white border border-warm-border text-text-secondary hover:text-text-primary hover:border-violet/30"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {/* Grid display of filtered items */}
          {filteredCatalogItems.length === 0 ? (
            <div className="card text-center py-16 text-xs text-text-secondary/50 italic bg-white border-warm-border/50">
              Товарів у цій категорії не знайдено.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {filteredCatalogItems.map((item) => {
                const hasPhoto = !!(item.photo_urls && item.photo_urls.length > 0);
                const photoUrl = hasPhoto && item.photo_urls ? item.photo_urls[0] : "";
                
                // Safe fields casting
                let displayName = "";
                let displayImei = "";
                let displaySku = "";
                let displayStock: number | null = null;
                let displayPrice = 0;

                if (activeCategory === "device") {
                  const dev = item as Device;
                  displayName = `${dev.brand || ""} ${dev.model || ""}`.trim() || "Пристрій";
                  displayImei = dev.imei || "";
                  displayPrice = dev.price;
                } else if (activeCategory === "accessory") {
                  const acc = item as Accessory;
                  displayName = acc.name;
                  displaySku = acc.sku || "";
                  displayStock = acc.stock;
                  displayPrice = acc.price;
                } else if (activeCategory === "part") {
                  const prt = item as Part;
                  displayName = prt.name;
                  displaySku = prt.sku || "";
                  displayStock = prt.stock;
                  displayPrice = prt.price || 0;
                } else if (activeCategory === "service") {
                  const srv = item as Service;
                  displayName = srv.name;
                  displayPrice = srv.price;
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item, activeCategory)}
                    className="cursor-pointer border border-warm-border/50 bg-white hover:border-violet/30 hover:shadow-md rounded-xl p-3 flex flex-col justify-between gap-3 transition-all duration-200 group relative overflow-hidden active:scale-[0.97]"
                  >
                    {/* Product Visual element */}
                    <div className={`w-full h-32 rounded-xl flex items-center justify-center overflow-hidden border border-warm-border/20 relative ${
                      hasPhoto ? "bg-warm-surface" : 
                      activeCategory === "device" ? "bg-cyan/10 text-cyan" :
                      activeCategory === "accessory" ? "bg-gradient-to-br from-violet/10 to-iris/5 text-violet" :
                      activeCategory === "part" ? "bg-amber/10 text-amber" : 
                      "bg-emerald/10 text-emerald"
                    }`}>
                      {hasPhoto ? (
                        <img
                          src={photoUrl}
                          alt={displayName}
                          className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300 ease-out"
                        />
                      ) : (
                        <div className="group-hover:scale-110 transition-transform duration-300">
                          {activeCategory === "device" ? <IconDevice size={45} /> :
                           activeCategory === "accessory" ? <IconAccessory size={45} /> :
                           activeCategory === "part" ? <IconBox size={45} /> : <IconRepair size={45} />}
                        </div>
                      )}

                      {/* Quantity / stock indicators */}
                      {displayStock !== null && (
                        <span className={`absolute right-2 bottom-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          displayStock <= 2 ? "bg-rose/10 text-rose" : "bg-emerald/10 text-emerald"
                        }`}>
                          Стік: {displayStock} шт
                        </span>
                      )}
                    </div>

                    {/* Info details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-text-primary leading-tight line-clamp-2">
                          {displayName}
                        </h4>
                        {displayImei && (
                          <p className="text-[9px] text-text-secondary font-mono mt-1 truncate">
                            IMEI: {displayImei}
                          </p>
                        )}
                        {displaySku && (
                          <p className="text-[9px] text-text-secondary mt-1 truncate">
                            SKU: {displaySku}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-iris/5">
                        <span className="text-xs font-extrabold text-violet">
                          {displayPrice} ₴
                        </span>
                        <span className="text-[10px] text-violet font-semibold bg-violet/5 rounded-lg px-2.5 py-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                          + Додати
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
